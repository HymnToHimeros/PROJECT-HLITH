// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findDestructive } from './lib/migration-rules';

const DIR = resolve(__dirname, '../supabase/migrations');
const sql = readFileSync(join(DIR, '0018_card_extras.sql'), 'utf8');
const body = (src: string, fn: string) => src.match(new RegExp(`create or replace function public\\.${fn}\\([\\s\\S]*?end \\$\\$;`))?.[0] ?? '';

describe('more on the profile card (0018, T64 B2)', () => {
  it('only adds', () => {
    expect(findDestructive(sql)).toEqual([]);
  });

  it('nobody can call the counting function directly; only the card uses it', () => {
    expect(sql).toContain('revoke execute on function public.pull_numbers(jsonb) from public, anon, authenticated;');
    expect(body(sql, 'profile_card')).toContain('nums := public.pull_numbers(pulls);');
  });

  it('counts like the app: a guaranteed result is no 50/50, and the luckiest pull skips the count before the first top', () => {
    const f = body(sql, 'pull_numbers');
    expect(f).toMatch(/if guaranteed then\s+guaranteed := false;\s+elsif r -> 'featured' = 'true'::jsonb then\s+won := won \+ 1;\s+elsif r -> 'featured' = 'false'::jsonb then\s+lost := lost \+ 1;\s+guaranteed := true;/);
    expect(f).toMatch(/if counting and \(best is null or since < /);
  });

  it('each new part shows only when its switch allows it, and the shelf holds only badges the server can see', () => {
    const f = body(sql, 'profile_card');
    expect(f).toContain("'shelf', case when (priv -> 'badges') is distinct from 'false'::jsonb then shelf end,");
    expect(f).toContain("'luckiest', case when (priv -> 'luck') is distinct from 'false'::jsonb then luckiest end,");
    expect(f).toMatch(/if \(priv -> 'showcase'\) is distinct from 'false'::jsonb and jsonb_typeof\(look -> 'best_team'\) = 'object' then/);
    expect(f).toMatch(/\) s where b = any \(badges\);/);
  });

  it('the card is otherwise 0017’s', () => {
    const before = body(readFileSync(join(DIR, '0017_owner_look.sql'), 'utf8'), 'profile_card');
    const now = body(sql, 'profile_card');
    // Everything 0017 returned is still returned the same way.
    for (const line of before.split('\n').filter((l) => /^ {4}'[a-z_]+', /.test(l) && !l.includes("'stats'"))) expect(now).toContain(line);
    expect(now).toContain("if exists (select 1 from public.account_restrictions where user_id = p_user and (silenced_until > now() or banned_until > now())) then");
  });
});
