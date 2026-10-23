// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { definerFunctions, findDestructive, revokedFromAnon, tmpObjects, userTables, wallProblems } from './lib/migration-rules';

const DIR = resolve(__dirname, '../supabase/migrations');

describe('migrations never wipe user data', () => {
  it('no migration drops, deletes, truncates, renames or cascades', () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith('.sql'));
    const found = files.flatMap((f) =>
      findDestructive(readFileSync(join(DIR, f), 'utf8')).map((label) => `${f}: ${label}`),
    );
    expect(found).toEqual([]);
  });
});

describe('every user table is walled off and cannot be deleted from', () => {
  const sql = readdirSync(DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(join(DIR, f), 'utf8'))
    .join('\n');

  it('finds the user tables', () => {
    expect(userTables(sql)).toEqual(expect.arrayContaining(['profiles', 'roster', 'progress', 'bank_ledger', 'pulls', 'plans']));
  });

  it('has row-level security on and no delete policy on every one', () => {
    expect(wallProblems(sql)).toEqual([]);
  });

  it('the checker catches a missing wall and a delete policy', () => {
    const bad = 'create table public.x (\n  user_id uuid\n);\ncreate policy "d" on public.x for delete using (true);';
    expect(wallProblems(bad)).toEqual(['x: row-level security is off', 'x: has a delete policy']);
  });
});

describe('no temporary objects ship (T80)', () => {
  it('no migration creates a function or policy named _tmp…', () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith('.sql'));
    expect(files.flatMap((f) => tmpObjects(readFileSync(join(DIR, f), 'utf8')).map((o) => `${f}: ${o}`))).toEqual([]);
  });

  it('the left-over _tmp SQL runner and anon write policy are dropped', () => {
    const sql = readFileSync(join(DIR, '0021_drop_tmp_objects.sql'), 'utf8');
    expect(sql).toMatch(/drop function if exists public\._tmp_exec_sql\(text\);/);
    expect(sql).toMatch(/drop policy if exists _tmp_anon_upsert on public\.owner_theme_drafts;/);
  });

  it('the checker catches them, however written, and ignores drops and comments', () => {
    expect(tmpObjects('create or replace function public._tmp_exec_sql(q text) returns void security definer as $$ begin execute q; end $$;')).toEqual(['function _tmp_exec_sql']);
    expect(tmpObjects('CREATE FUNCTION "public"."_tmp_x"() returns int as $$ select 1 $$;')).toEqual(['function _tmp_x']);
    expect(tmpObjects('create policy _tmp_anon_upsert on public.t for all to anon using (true);')).toEqual(['policy _tmp_anon_upsert']);
    expect(tmpObjects('create policy "_tmp read" on public.t for select using (true);')).toEqual(['policy _tmp']);
    expect(tmpObjects('drop function if exists public._tmp_exec_sql(text);\n-- create function public._tmp_y()')).toEqual([]);
    expect(tmpObjects('create function public.tmp_ok() returns int as $$ select 1 $$;')).toEqual([]);
  });
});

describe('signed-out visitors can call no SECURITY DEFINER function (advisor 0028)', () => {
  /** Meant for everyone: row-level policies call it, and it only answers true/false for the caller. */
  const OPEN = ['is_owner'];
  it('every SECURITY DEFINER function has EXECUTE taken from anon/public, except the open list', () => {
    const sql = readdirSync(DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .map((f) => readFileSync(join(DIR, f), 'utf8'))
      .join('\n');
    const revoked = revokedFromAnon(sql);
    expect(definerFunctions(sql).filter((f) => !revoked.has(f) && !OPEN.includes(f))).toEqual([]);
  });
  it('each function 0024 takes from anon already refused signed-out callers itself, so nothing anyone uses breaks', () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
    const latest = (name: string) => {
      let body = '';
      for (const f of files) {
        const sql = readFileSync(join(DIR, f), 'utf8');
        for (const m of sql.matchAll(new RegExp(String.raw`create\s+(?:or\s+replace\s+)?function\s+public\.${name}\s*\([\s\S]*?\$\$([\s\S]*?)\$\$`, 'gi'))) body = m[1] ?? '';
      }
      return body;
    };
    const ownerOnly = /if\s+not\s+public\.is_owner\(\)\s+then\s+raise\s+exception\s+'owner only'/i;
    const signedIn = /(auth\.uid\(\)|\bme\b)\s+is\s+null\s+then\s+raise\s+exception\s+'sign in first'/i;
    const revoked = ['owner_reward_items', 'add_reward_item', 'grant_reward', 'revoke_reward', 'owner_reward_grants', 'create_reward_claim', 'cancel_reward_claim', 'owner_reward_claims', 'claim_reward', 'my_rewards', 'owner_theme_drafts'];
    const unguarded = revoked.filter((f) => {
      const body = latest(f);
      return !body || !(ownerOnly.test(body) || signedIn.test(body));
    });
    expect(unguarded).toEqual([]);
    // create_profile is the sign-up trigger (fires on auth.users), never called by anyone.
    expect(readFileSync(join(DIR, '0001_init.sql'), 'utf8')).toMatch(/create trigger on_auth_user_created after insert on auth\.users for each row execute function public\.create_profile\(\);/);
  });

  it('the checker reads both', () => {
    const sql = 'create function public.a() returns int language sql security definer as $$ select 1 $$;\ncreate function public.b() returns int language sql as $$ select 1 $$;\nrevoke execute on function public.a() from public, anon;';
    expect(definerFunctions(sql)).toEqual(['a']);
    expect([...revokedFromAnon(sql)]).toEqual(['a']);
    expect([...revokedFromAnon('revoke execute on function public.c(int) from authenticated;')]).toEqual([]);
  });
});

describe('link/result tables have only the grants they need (0023)', () => {
  const sql = readFileSync(join(DIR, '0023_harden_link_grants.sql'), 'utf8');
  const tables = ['skport_links', 'skport_checkins', 'hoyolab_links', 'hoyolab_checkins', 'hoyolab_redemptions', 'hoyolab_my_codes', 'hoyolab_codes'];

  it.each(tables)('revokes all from anon and authenticated on %s', (table) => {
    expect(sql).toContain(`revoke all on public.${table} from anon, authenticated;`);
  });

  it('re-grants only column select and column update on skport_links', () => {
    expect(sql).toMatch(/grant select \(id,.*updated_at\) on public\.skport_links to authenticated;/);
    expect(sql).toMatch(/grant update \(label, auto_checkin\) on public\.skport_links to authenticated;/);
  });

  it('re-grants only column select and column update on hoyolab_links', () => {
    expect(sql).toMatch(/grant select \(id,.*updated_at\) on public\.hoyolab_links to authenticated;/);
    expect(sql).toMatch(/grant update \(label, auto_checkin, auto_redeem\) on public\.hoyolab_links to authenticated;/);
  });

  it('re-grants only select on server-written result tables', () => {
    for (const t of ['skport_checkins', 'hoyolab_checkins', 'hoyolab_redemptions']) {
      expect(sql).toContain(`grant select on public.${t} to authenticated;`);
    }
  });

  it('does not grant delete, truncate, trigger or references anywhere', () => {
    expect(sql.toLowerCase()).not.toMatch(/grant\b[^;]*(delete|truncate|trigger|references)/);
  });
});

describe('scheduler_trusted_sources has only the grants it needs (0027)', () => {
  const sql = readFileSync(join(DIR, '0027_trusted_sources.sql'), 'utf8');

  it('revokes all from anon and authenticated', () => {
    expect(sql).toContain('revoke all on public.scheduler_trusted_sources from anon, authenticated;');
  });

  it('re-grants only select, insert, delete to authenticated', () => {
    expect(sql).toContain('grant select, insert, delete on public.scheduler_trusted_sources to authenticated;');
  });

  it('does not grant update or truncate', () => {
    expect(sql.toLowerCase()).not.toMatch(/grant\b[^;]*(update|truncate)[^;]*scheduler_trusted_sources/);
  });

  it('findings_auto_approve uses empty search_path', () => {
    expect(sql).toMatch(/findings_auto_approve[\s\S]*?set search_path = ''/);
  });
});

describe('the migration checker itself', () => {
  it('flags destructive statements', () => {
    expect(findDestructive('DROP TABLE roster;')).toEqual(['DROP TABLE']);
    expect(findDestructive('alter table pulls drop column rarity;')).toEqual(['DROP COLUMN']);
    expect(findDestructive('delete from progress where 1=1;')).toEqual(['DELETE FROM']);
    expect(findDestructive('TRUNCATE bank_ledger;')).toEqual(['TRUNCATE']);
    expect(findDestructive('alter table roster rename to chars;')).toEqual(['RENAME (breaks existing data paths)']);
    expect(findDestructive('user_id uuid references auth.users on delete cascade')).toEqual(['ON DELETE CASCADE']);
  });

  it('allows additive statements and ignores comments', () => {
    expect(findDestructive('create table plans (id uuid primary key);')).toEqual([]);
    expect(findDestructive('alter table roster add column wanted boolean default false;')).toEqual([]);
    expect(findDestructive('-- never DROP TABLE here\n/* DELETE FROM x */ select 1;')).toEqual([]);
  });
});
