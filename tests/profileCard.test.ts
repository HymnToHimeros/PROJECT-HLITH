// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BADGES, SERVER_CHECKED } from '../src/tools/account/badges';

const sql = readFileSync(resolve(__dirname, '../supabase/migrations/0011_profile_card.sql'), 'utf8');

describe('the profile card the server gives others (0011_profile_card.sql, T52)', () => {
  it('checks exactly the badges the app says it checks', () => {
    const inSql = new Set(['seated', ...[...sql.matchAll(/'([a-z-]+)'::text/g)].map((m) => m[1]), ...(sql.includes("array['owner']") ? ['owner'] : [])]);
    expect([...inSql].sort()).toEqual([...SERVER_CHECKED].sort());
    expect(SERVER_CHECKED.every((id) => BADGES.some((b) => b.id === id))).toBe(true);
  });

  it('is for signed-in callers only and answers only when the person switched their card on', () => {
    expect(sql).toMatch(/revoke execute on function public\.profile_card\(uuid\) from public, anon;/);
    expect(sql).toMatch(/grant execute on function public\.profile_card\(uuid\) to authenticated;/);
    expect(sql).toMatch(/if auth\.uid\(\) is null then/);
    expect(sql).toMatch(/if \(priv -> 'card'\) is distinct from 'true'::jsonb then\s+return null;/);
  });

  it('owner-only things come from public.owners, never from the profile', () => {
    expect(sql).toMatch(/owner := exists \(select 1 from public\.owners where user_id = p_user\);/);
    expect(sql).toMatch(/if frame = 'sky' and not owner then frame := 'none'; end if;/);
    expect(sql).toMatch(/'owner_title', case when owner then/);
  });
});
