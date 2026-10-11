// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { bannedAmong, withoutBanned } from '../supabase/functions/_shared/moderation';

const fn = (name: string) => readFileSync(resolve(__dirname, `../supabase/functions/${name}/index.ts`), 'utf8');

describe('scheduled jobs skip suspended accounts (T60b)', () => {
  it('asks the server which accounts are banned, once, and keeps only the others', async () => {
    const rpc = vi.fn(async () => ({ data: ['u2'], error: null }));
    const out = await withoutBanned({ rpc }, [
      { id: 'a', user_id: 'u1' },
      { id: 'b', user_id: 'u2' },
      { id: 'c', user_id: 'u1' },
    ]);
    expect(out.map((l) => l.id)).toEqual(['a', 'c']);
    expect(rpc).toHaveBeenCalledWith('banned_among', { p_users: ['u1', 'u2'] });
  });

  it('stops rather than act for someone when the answer can’t be read', async () => {
    await expect(bannedAmong({ rpc: async () => ({ data: null, error: { message: 'down' } }) }, ['u1'])).rejects.toThrow(/suspended accounts/);
    expect(await bannedAmong({ rpc: async () => Promise.reject(new Error('never called')) }, [])).toEqual(new Set());
  });

  it('the HoYoLAB daily run and the calendar feed (a link, not a sign-in) both check', () => {
    expect(fn('hoyolab-daily')).toMatch(/const links = await withoutBanned\(db, await activeLinks\(db\)\);/);
    const ics = fn('ics-feed');
    expect(ics).toMatch(/select\('user_id, schedule, feed_enabled'\)/);
    expect(ics).toMatch(/if \(\(await bannedAmong\(db, \[String\(data\.user_id\)\]\)\)\.size\) return text\('This calendar is paused\.', 403\);/);
  });

  it('every other server function that acts for a person goes through requireUser (which refuses banned accounts)', () => {
    for (const name of ['assistant', 'delete-account', 'evening-message', 'export-data', 'gacha-import', 'hoyolab']) expect(fn(name), name).toMatch(/requireUser\(/);
  });
});
