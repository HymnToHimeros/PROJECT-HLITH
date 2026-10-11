// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findDestructive, wallProblems } from './lib/migration-rules';

const sql = readFileSync(resolve(__dirname, '../supabase/migrations/0014_community_members.sql'), 'utf8');
const body = (fn: string) => {
  const m = sql.match(new RegExp(`create or replace function public\\.${fn}\\([\\s\\S]*?end \\$\\$;`));
  return m?.[0] ?? '';
};

describe('community groundwork: testers and invite links (0014, T60)', () => {
  it('both tables are walled off: row-level security on, no delete, update or insert policy', () => {
    expect(sql).toMatch(/alter table public\.community_members enable row level security;/);
    expect(sql).toMatch(/alter table public\.community_invites enable row level security;/);
    expect(sql).not.toMatch(/create policy[^;]*for (insert|update|delete|all)\b/i);
    expect(wallProblems(sql)).toEqual([]);
  });

  it('members see only their own row; only the owner reads every member and every invite', () => {
    expect(sql).toMatch(/"community members: see yourself" on public\.community_members for select to authenticated\s+using \(user_id = \(select auth\.uid\(\)\)\);/);
    expect(sql).toMatch(/"community members: owner reads" on public\.community_members for select to authenticated\s+using \(public\.is_owner\(\)\);/);
    expect(sql).toMatch(/"community invites: owner reads" on public\.community_invites for select to authenticated\s+using \(public\.is_owner\(\)\);/);
  });

  it('the owner counts as everything; a removed tester is not a member', () => {
    expect(body('is_member')).toMatch(/select public\.is_owner\(\)\s+or exists \(select 1 from public\.community_members where user_id = \(select auth\.uid\(\)\) and removed_at is null\);/);
    expect(body('is_tester')).toMatch(/public\.is_owner\(\)/);
    expect(body('is_tester')).toMatch(/removed_at is null and role = 'tester'/);
  });

  it('owner-only functions refuse everyone else on the server', () => {
    for (const fn of ['create_invite', 'cancel_invite', 'owner_invites', 'owner_members', 'remove_member']) {
      expect(body(fn), fn).toMatch(/if not public\.is_owner\(\) then\s+raise exception 'owner only' using errcode = '42501';/);
    }
    expect(body('community_home')).toMatch(/if not public\.is_member\(\) then\s+raise exception 'members only'/);
  });

  it('an invite secret is never stored, only its hash, and is handed out once', () => {
    expect(sql).toMatch(/token_hash text not null unique/);
    expect(sql).not.toMatch(/\btoken text\b/);
    expect(body('create_invite')).toMatch(/values \(public\.invite_hash\(secret\)/);
    expect(body('create_invite')).toMatch(/return jsonb_build_object\('id', row_id, 'token', secret\);/);
    expect(body('owner_invites')).not.toMatch(/token/);
  });

  it('a link works once: cancelled or used links are refused, and accepting uses it up', () => {
    const accept = body('accept_invite');
    expect(accept).toMatch(/if me is null then/);
    expect(accept).toMatch(/for update;/);
    expect(accept).toMatch(/if not found or inv\.cancelled_at is not null or inv\.used_at is not null then\s+raise exception/);
    expect(accept).toMatch(/update public\.community_invites set used_by = me, used_at = now\(\) where id = inv\.id;/);
    expect(body('cancel_invite')).toMatch(/where id = p_id and used_at is null and cancelled_at is null;/);
    expect(sql).toMatch(/constraint community_invites_one_end check \(used_at is null or cancelled_at is null\)/);
  });

  it('removing a member or cancelling a link marks it; nothing is deleted by the app', () => {
    expect(body('remove_member')).toMatch(/update public\.community_members set removed_at = now\(\)/);
    expect(findDestructive(sql)).toEqual([]);
  });

  it('every function is for signed-in callers only, never anonymous visitors', () => {
    const fns = ['is_member()', 'is_tester()', 'create_invite(text)', 'cancel_invite(uuid)', 'owner_invites()', 'owner_members()', 'remove_member(uuid)', 'invite_status(text)', 'accept_invite(text)', 'community_home()'];
    for (const f of fns) {
      expect(sql, f).toContain(`revoke execute on function public.${f} from public, anon;`);
      expect(sql, f).toContain(`grant execute on function public.${f} to authenticated;`);
    }
  });
});
