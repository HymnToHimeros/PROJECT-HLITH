// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEGAL_VERSIONS } from '../config/legal/versions';
import { BLOCKED, checkUsername, RESERVED, RESERVED_WORDS, usernameKey } from '../src/core/auth/username';
import { findDestructive, userTables, wallProblems } from './lib/migration-rules';

const DIR = resolve(__dirname, '../supabase/migrations');
const sql = readFileSync(join(DIR, '0016_first_run.sql'), 'utf8');
const all = readdirSync(DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(join(DIR, f), 'utf8'))
  .join('\n');
const body = (src: string, fn: string) => src.match(new RegExp(`create or replace function public\\.${fn}\\([\\s\\S]*?(?:end \\$\\$;|\\$\\$;)`))?.[0] ?? '';
const words = (fn: string, nth = 0) => [...([...body(sql, fn).matchAll(/array\[([^\]]*)\]/g)][nth]?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1] as string);

describe('first run: accept the Terms and Privacy policy, choose a username (0016, T62)', () => {
  it('only adds; the new table is walled off and has no write policy at all', () => {
    expect(findDestructive(sql)).toEqual([]);
    expect(wallProblems(sql)).toEqual([]);
    expect(sql).not.toMatch(/on public\.account_identity for (insert|update|delete|all)\b/i);
    expect(sql).toMatch(/"account identity: see your own" on public\.account_identity for select to authenticated using \(user_id = \(select auth\.uid\(\)\)\);/);
  });

  it('the server’s versions are the app’s (config/legal/versions.ts)', () => {
    expect(sql).toContain(`public.terms_version() returns int language sql immutable as $$ select ${LEGAL_VERSIONS.terms} $$;`);
    expect(sql).toContain(`public.privacy_version() returns int language sql immutable as $$ select ${LEGAL_VERSIONS.privacy} $$;`);
    // Only the current versions can be accepted.
    expect(body(sql, 'accept_legal')).toMatch(/if p_terms is distinct from public\.terms_version\(\) or p_privacy is distinct from public\.privacy_version\(\) then\s+raise exception/);
  });

  it('until both are done, no table with app data can be added to or changed, nor files; deletion requests stay possible', () => {
    const block = sql.match(/do \$\$[\s\S]*?end \$\$;/)?.[0] ?? '';
    const covered = [...(block.match(/array\[([\s\S]*?)\]/)?.[1] ?? '').matchAll(/'(\w+)'/g)].map((m) => m[1] as string);
    const exempt = ['account_deletion_requests', 'account_identity', 'account_restrictions', 'moderation_actions', 'owners'];
    expect(userTables(all).filter((t) => !exempt.includes(t) && !covered.includes(t))).toEqual([]);
    expect(covered).not.toContain('account_deletion_requests');
    expect(block).toMatch(/as restrictive for insert to authenticated with check \(\(select public\.has_accepted\(\)\)\)/);
    expect(block).toMatch(/as restrictive for update to authenticated using \(\(select public\.has_accepted\(\)\)\) with check/);
    expect(sql).toMatch(/"first run: accept first \(adding files\)" on storage\.objects as restrictive for insert/);
    expect(body(sql, 'has_accepted')).toMatch(/username is not null\s+and terms_version >= public\.terms_version\(\) and privacy_version >= public\.privacy_version\(\)/);
  });

  it('usernames: unique ignoring case, 3–20 letters, numbers, _ and .', () => {
    expect(sql).toContain('create unique index account_identity_username_unique on public.account_identity (lower(username));');
    expect(sql).toContain("username text check (username ~ '^[A-Za-z0-9_.]{3,20}$')");
    expect(checkUsername('ab')).toBe('invalid');
    expect(checkUsername('a'.repeat(21))).toBe('invalid');
    expect(checkUsername('Mira!')).toBe('invalid');
    expect(checkUsername('mira.rose_7')).toBe('ok');
  });

  it('names that could pass for HLIÐSKJÁLF or its staff are refused, also hidden with dots or look-alike digits', () => {
    expect(words('username_reserved').sort()).toEqual([...RESERVED].sort());
    expect(words('username_reserved', 1)).toEqual([...RESERVED_WORDS]);
    for (const n of ['owner', 'TheOwner', 'Admin_Mira', 'hlith.fan', 'h_l_i_t_h', 'm0d3rat0r', 'Support', 'staff99', 'official.news', 'SYSTEM', 'hlidskjalf', 'project.hlith']) expect(checkUsername(n), n).toBe('reserved');
  });

  it('“mod” only as a word of its own, not inside words like model or modern', () => {
    for (const n of ['mod', 'Mod_Mira', 'mira.mod', 'mod123', 'm0d', 'x_m0d_y']) expect(checkUsername(n), n).toBe('reserved');
    for (const n of ['model', 'modern', 'Commodore', 'mode_7', 'nomad']) expect(checkUsername(n), n).toBe('ok');
  });

  it('the owner may use reserved names (checked on the server), but never slurs', () => {
    expect(body(sql, 'username_status')).toMatch(/if public\.username_reserved\(p_name\) and not public\.is_owner\(\) then return 'reserved'; end if;/);
    for (const n of ['HLITH', 'hlidskjalf.owner', 'Admin', 'mod']) expect(checkUsername(n, true), n).toBe('ok');
    expect(checkUsername('fuck_it', true)).toBe('blocked');
    expect(body(sql, 'my_gate')).toMatch(/'owner', public\.is_owner\(\),/);
  });

  it('slurs and swearing are refused; ordinary words that contain a short one are not', () => {
    expect(words('username_blocked').sort()).toEqual([...BLOCKED].sort());
    for (const n of ['fuck_it', 'F.u.c.k', 'sh1t', 'nazi_fan']) expect(checkUsername(n), n).toBe('blocked');
    for (const n of ['therapist', 'peacock', 'spicy', 'swank', 'Dickens', 'Scarlet']) expect(checkUsername(n), n).toBe('ok');
    expect(usernameKey('M1.r_4')).toBe('mira');
  });

  it('a username changes at most once every 30 days (the first choice is free), and the old name is freed', () => {
    const set = body(sql, 'set_username');
    expect(set).toMatch(/me\.username_changed_at > now\(\) - interval '30 days' then\s+raise exception 'you can change your username again on %'/);
    expect(set).toMatch(/username_changed_at = case when public\.account_identity\.username is null then public\.account_identity\.username_changed_at else now\(\) end/);
    expect(set).toMatch(/exception when unique_violation then/);
  });

  it('the owner’s lists, Members and the profile card show the username', () => {
    expect(body(sql, 'owner_users')).toMatch(/'name', coalesce\(i\.username, left\(p\.display_name, 40\)\)/);
    expect(body(sql, 'owner_members')).toMatch(/'name', coalesce\(ai\.username/);
    expect(body(sql, 'owner_invites')).toMatch(/'used_by_name', coalesce\(ui\.username/);
    expect(body(sql, 'owner_moderation_log')).toMatch(/'name', coalesce\(pi\.username[\s\S]*'by_name', coalesce\(bi\.username/);
    // The card is 0015's, plus the username.
    const before = body(readFileSync(join(DIR, '0015_moderation.sql'), 'utf8'), 'profile_card');
    const now = body(sql, 'profile_card');
    const added = /\n {4}'username', \(select username from public\.account_identity where user_id = p_user\),/;
    expect(now).toMatch(added);
    expect(now.replace(added, '')).toBe(before);
  });

  it('every new function is for signed-in callers only', () => {
    for (const f of ['username_status(text)', 'has_accepted()', 'my_gate()', 'accept_legal(int, int)', 'set_username(text)']) {
      expect(sql, f).toContain(`revoke execute on function public.${f} from public, anon;`);
      expect(sql, f).toContain(`grant execute on function public.${f} to authenticated;`);
    }
  });
});
