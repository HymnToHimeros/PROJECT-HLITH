// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { USER_TABLES } from '../supabase/functions/_shared/accountPlan';
import { BACKUP_TABLES } from '../supabase/functions/_shared/backupPlan';
import { PURGE_BY_COLUMN, PURGE_TABLES } from '../supabase/functions/_shared/purgePlan';
import { REWARD_POOL } from '../src/tools/account/rewards/pool';
import { findDestructive, wallProblems } from './lib/migration-rules';

const DIR = resolve(__dirname, '../supabase/migrations');
const sql = readFileSync(join(DIR, '0019_rewards.sql'), 'utf8');
const body = (src: string, fn: string) => src.match(new RegExp(`create or replace function public\\.${fn}\\([\\s\\S]*?(?:end \\$\\$;|\\$\\$;)`))?.[0] ?? '';
const OWNER_ONLY = ['owner_reward_items', 'add_reward_item', 'grant_reward', 'revoke_reward', 'owner_reward_grants', 'create_reward_claim', 'cancel_reward_claim', 'owner_reward_claims', 'owner_moderation_log'];

describe('rewards (0019, T67)', () => {
  it('only adds; every table is walled off and none has a write policy (only the functions write)', () => {
    expect(findDestructive(sql)).toEqual([]);
    expect(wallProblems(sql)).toEqual([]);
    for (const t of ['reward_items', 'reward_claims', 'reward_grants', 'reward_log']) expect(sql).toContain(`alter table public.${t} enable row level security;`);
    expect(sql).not.toMatch(/on public\.reward_\w+ for (insert|update|delete|all)\b/i);
  });

  it('people read only their own grants and the items they hold; the owner reads everything; a banned account reads nothing', () => {
    expect(sql).toContain('"reward grants: see your own" on public.reward_grants for select to authenticated\n  using (user_id = (select auth.uid()));');
    expect(sql).toMatch(/"reward items: holders read" on public\.reward_items for select to authenticated\s+using \(exists \(select 1 from public\.reward_grants g where g\.item_id = reward_items\.id and g\.user_id = \(select auth\.uid\(\)\) and g\.revoked_at is null\)\);/);
    for (const t of ['reward_items', 'reward_claims', 'reward_grants', 'reward_log']) expect(sql).toMatch(new RegExp(`on public\\.${t} for select to authenticated\\s+using \\(public\\.is_owner\\(\\)\\);`));
    expect(sql).toContain('create policy "banned: no reading" on public.reward_grants as restrictive');
    expect(sql).toContain('create policy "banned: no reading" on public.reward_log as restrictive');
  });

  it('the owner’s own badges, frames and name styles can never be given: only reward-pool pictures of the same kind', () => {
    expect(sql).toContain("art text not null check (art ~ '^r-(badge|frame|name)-[a-z0-9-]{1,40}$'),");
    expect(sql).toContain("constraint reward_items_art_kind check (split_part(art, '-', 2) = kind)");
    for (const r of REWARD_POOL) {
      expect(r.art).toMatch(/^r-(badge|frame|name)-[a-z0-9-]{1,40}$/);
      expect(r.art.split('-')[1]).toBe(r.kind);
    }
  });

  it('every owner function refuses anyone else', () => {
    for (const fn of OWNER_ONLY) expect(body(sql, fn), fn).toMatch(/if not public\.is_owner\(\) then\s+raise exception 'owner only'/);
  });

  it('claim codes: only a hash is kept; banned and not-yet-set-up accounts are refused, silenced ones may claim', () => {
    const create = body(sql, 'create_reward_claim');
    expect(create).toContain('values (p_item, public.invite_hash(code),');
    expect(create).toContain("return jsonb_build_object('id', row_id, 'code', code);");
    const claim = body(sql, 'claim_reward');
    expect(claim).toMatch(/if public\.is_banned\(\) then\s+raise exception/);
    expect(claim).toMatch(/if not public\.has_accepted\(\) then\s+raise exception/);
    expect(claim).not.toContain('is_silenced');
    expect(claim).toContain('where token_hash = public.invite_hash(public.reward_code_key(p_code)) for update;');
    expect(claim).toMatch(/if c\.uses >= c\.max_uses then/);
    expect(claim).toMatch(/if c\.expires_at is not null and c\.expires_at <= now\(\) then/);
    // Direct grants follow the same rule for the account they go to.
    expect(body(sql, 'grant_reward')).toMatch(/if not public\.reward_eligible\(target\) then/);
    expect(body(sql, 'reward_eligible')).toContain('banned_until > now()');
    expect(sql).toContain('revoke execute on function public.reward_eligible(uuid) from public, anon, authenticated;');
  });

  it('every grant, claim, revoke, item and code is logged, and the owner’s log lists rewards with moderation', () => {
    for (const [fn, action] of [
      ['add_reward_item', 'reward_item'],
      ['grant_reward', 'reward_grant'],
      ['revoke_reward', 'reward_revoke'],
      ['create_reward_claim', 'reward_code'],
      ['cancel_reward_claim', 'reward_code_cancel'],
      ['claim_reward', 'reward_claim'],
    ] as const)
      expect(body(sql, fn), fn).toMatch(new RegExp(`insert into public\\.reward_log \\(action[^)]*\\) values \\('${action}'`));
    const log = body(sql, 'owner_moderation_log');
    expect(log).toContain('from (select * from public.moderation_actions order by created_at desc limit 300) a');
    expect(log).toContain('from (select * from public.reward_log order by created_at desc limit 300) l');
    expect(log).toContain('union all');
  });

  it('the card shows a worn reward only while it is held; otherwise the card is 0018’s', () => {
    const before = body(readFileSync(join(DIR, '0018_card_extras.sql'), 'utf8'), 'profile_card');
    const now = body(sql, 'profile_card');
    expect(now).toContain("join public.reward_grants gr on gr.item_id = i.id and gr.user_id = p_user and gr.revoked_at is null");
    expect(now).toContain("continue when k = 'badge' and (priv -> 'badges') = 'false'::jsonb;");
    expect(now.replace(/ {2}-- T67:[\s\S]*?end if;\n\n/, '').replace("  rewards jsonb := '{}'::jsonb;\n  k text;\n  rid text;\n  ritem jsonb;\n", '').replace("    'featured', featured,\n    'rewards', rewards\n", "    'featured', featured\n")).toBe(before);
  });

  it('grants are exported, purged and backed up; the log is purged with the account', () => {
    for (const t of ['reward_grants', 'reward_log']) {
      expect(USER_TABLES).toContain(t);
      expect(PURGE_TABLES).toContain(t);
    }
    expect(PURGE_BY_COLUMN).toContainEqual({ table: 'reward_log', column: 'created_by' });
    for (const t of ['reward_items', 'reward_claims', 'reward_grants', 'reward_log']) expect(BACKUP_TABLES).toContain(t);
  });
});
