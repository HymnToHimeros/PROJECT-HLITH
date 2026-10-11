// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findDestructive, userTables, wallProblems } from './lib/migration-rules';

const DIR = resolve(__dirname, '../supabase/migrations');
const sql = readFileSync(join(DIR, '0015_moderation.sql'), 'utf8');
const all = readdirSync(DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(join(DIR, f), 'utf8'))
  .join('\n');
const body = (src: string, fn: string) => src.match(new RegExp(`create or replace function public\\.${fn}\\([\\s\\S]*?end \\$\\$;`))?.[0] ?? '';
const arrayIn = (block: string) => [...(block.match(/array\[([\s\S]*?)\]/)?.[1] ?? '').matchAll(/'(\w+)'/g)].map((m) => m[1] as string);
const [bannedBlock = '', silencedBlock = ''] = sql.match(/do \$\$[\s\S]*?end \$\$;/g) ?? [];

describe('moderation: silence, ban, remove (0015, T60b)', () => {
  it('only adds, and its tables are walled off with no write policies', () => {
    expect(findDestructive(sql)).toEqual([]);
    expect(wallProblems(sql)).toEqual([]);
    expect(sql).not.toMatch(/create policy "[^"]*" on public\.(account_restrictions|moderation_actions) for (insert|update|delete|all)/i);
    expect(sql).toMatch(/"account restrictions: owner reads" on public\.account_restrictions for select to authenticated using \(public\.is_owner\(\)\);/);
    expect(sql).toMatch(/"moderation log: owner reads" on public\.moderation_actions for select to authenticated using \(public\.is_owner\(\)\);/);
  });

  it('a banned account is refused on every table with people’s data: reading, adding and changing', () => {
    // The 0015 list, plus tables added later with their own "banned: no reading" policy.
    const later = [...all.matchAll(/create policy "banned: no reading" on public\.(\w+) as restrictive/g)].map((m) => m[1] as string);
    const covered = [...arrayIn(bannedBlock), ...later];
    const people = userTables(all).filter((t) => !['account_restrictions', 'moderation_actions'].includes(t));
    expect(people.filter((t) => !covered.includes(t))).toEqual([]);
    expect(bannedBlock).toMatch(/as restrictive for select to authenticated using \(not \(select public\.is_banned\(\)\)\)/);
    expect(bannedBlock).toMatch(/as restrictive for insert to authenticated with check \(not \(select public\.is_banned\(\)\)\)/);
    expect(bannedBlock).toMatch(/as restrictive for update to authenticated using \(not \(select public\.is_banned\(\)\)\) with check/);
  });

  it('stored files follow the same rules: every bucket refuses a banned account, avatars refuse new pictures while silenced', () => {
    // No bucket filter on the ban: it covers every bucket, including ones added later.
    expect(sql).toMatch(/"banned: no reading files" on storage\.objects as restrictive for select to authenticated\s+using \(not \(select public\.is_banned\(\)\)\);/);
    expect(sql).toMatch(/"banned: no adding files" on storage\.objects as restrictive for insert to authenticated\s+with check \(not \(select public\.is_banned\(\)\)\);/);
    expect(sql).toMatch(/"banned: no changing files" on storage\.objects as restrictive for update to authenticated\s+using \(not \(select public\.is_banned\(\)\)\) with check \(not \(select public\.is_banned\(\)\)\);/);
    // Nothing anywhere lets people delete files.
    expect(all).not.toMatch(/on storage\.objects for (delete|all)\b/i);
    expect(sql).toMatch(/"silenced: no new profile pictures" on storage\.objects as restrictive for insert to authenticated\s+with check \(bucket_id <> 'avatars' or not \(select public\.is_silenced\(\)\)\);/);
    expect(sql).toMatch(/"silenced: no changing profile pictures" on storage\.objects as restrictive for update/);
  });

  it('only the server itself can ask which accounts are banned (for its scheduled jobs)', () => {
    expect(sql).toContain('revoke all on function public.banned_among(uuid[]) from public, anon, authenticated;');
    expect(sql).toContain('grant execute on function public.banned_among(uuid[]) to service_role;');
  });

  it('a silenced account can’t write to any community or sharing table, now or later', () => {
    const covered = arrayIn(silencedBlock);
    const facing = [...all.matchAll(/create table public\.((?:community|share)_\w+)/g)].map((m) => m[1] as string);
    expect(facing.length).toBeGreaterThan(0);
    expect(facing.filter((t) => !covered.includes(t))).toEqual([]);
  });

  it('the profile card shown with shared teams is the same as before, plus hidden while silenced or banned', () => {
    const before = body(readFileSync(join(DIR, '0011_profile_card.sql'), 'utf8'), 'profile_card');
    const now = body(sql, 'profile_card');
    const check = / {2}if exists \(select 1 from public\.account_restrictions where user_id = p_user and \(silenced_until > now\(\) or banned_until > now\(\)\)\) then\n {4}return null;\n {2}end if;\n/;
    expect(now).toMatch(check);
    const strip = (s: string) => s.replace(/^\s*--.*$/gm, '').replace(/\s+/g, ' ');
    expect(strip(now.replace(check, ''))).toBe(strip(before));
  });

  it('owner-only, never on yourself or another owner, durations only 24 h, 7 days or no end', () => {
    for (const fn of ['owner_users', 'owner_moderation_log', 'moderate']) expect(body(sql, fn), fn).toMatch(/if not public\.is_owner\(\) then\s+raise exception 'owner only'/);
    const m = body(sql, 'moderate');
    expect(m).toMatch(/if p_user = auth\.uid\(\) then\s+raise exception 'not on your own account'/);
    expect(m).toMatch(/if exists \(select 1 from public\.owners where user_id = p_user\) then\s+raise exception 'not on an owner account'/);
    expect(m).toMatch(/p_hours not in \(24, 168\)/);
  });

  it('Remove is a permanent ban plus the normal 30-day deletion, and Undo cancels both; nothing is deleted now', () => {
    const m = body(sql, 'moderate');
    expect(m).toMatch(/elsif p_action = 'remove' then\s+update public\.account_restrictions set banned_until = 'infinity'/);
    expect(m).toMatch(/insert into public\.account_deletion_requests[\s\S]*now\(\) \+ interval '30 days'[\s\S]*'removed-by-owner'/);
    expect(m).toMatch(/elsif p_action = 'undo_remove' then[\s\S]*set cancelled_at = now\(\)[\s\S]*set banned_until = null/);
    expect(m).not.toMatch(/delete from/i);
  });

  it('the owner’s list of users never includes email addresses', () => {
    const users = body(sql, 'owner_users');
    expect(users).not.toMatch(/\bemail\b/i);
    expect(users).toMatch(/'methods', coalesce\(u\.raw_app_meta_data -> 'providers'/);
  });

  it('every function is for signed-in callers only', () => {
    for (const f of ['is_banned()', 'is_silenced()', 'my_standing()', 'owner_users()', 'owner_moderation_log()', 'moderate(uuid, text, int, text)']) {
      expect(sql, f).toContain(`revoke execute on function public.${f} from public, anon;`);
      expect(sql, f).toContain(`grant execute on function public.${f} to authenticated;`);
    }
  });
});
