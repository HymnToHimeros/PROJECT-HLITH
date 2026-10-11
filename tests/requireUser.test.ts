// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { requireUser } from '../supabase/functions/_shared/requireUser';

const env = { url: 'https://p.supabase.co', key: 'public-key' };
const JWT = 'aaa.bbb.ccc';
const auth = (status: number, body: unknown) => async () => ({ ok: status === 200, json: async () => body });

describe('requireUser', () => {
  it('accepts a signed-in user confirmed by Supabase Auth', async () => {
    expect(await requireUser(`Bearer ${JWT}`, env, auth(200, { id: 'u1', role: 'authenticated' }))).toEqual({ ok: true, userId: 'u1' });
  });
  it('refuses no header, the public key, or a non-JWT', async () => {
    const never = async () => {
      throw new Error('should not call Auth');
    };
    expect(await requireUser(null, env, never)).toEqual({ ok: false });
    expect(await requireUser('Bearer sb_publishable_xyz', env, never)).toEqual({ ok: false });
  });
  it('refuses tokens Supabase Auth rejects, and anonymous roles', async () => {
    expect(await requireUser(`Bearer ${JWT}`, env, auth(401, {}))).toEqual({ ok: false });
    expect(await requireUser(`Bearer ${JWT}`, env, auth(200, { id: 'x', role: 'anon' }))).toEqual({ ok: false });
  });
  it('refuses when the server is misconfigured or Auth is unreachable', async () => {
    expect(await requireUser(`Bearer ${JWT}`, { url: undefined, key: 'k' }, auth(200, { id: 'u', role: 'authenticated' }))).toEqual({ ok: false });
    expect(await requireUser(`Bearer ${JWT}`, env, async () => Promise.reject(new Error('down')))).toEqual({ ok: false });
  });
  it('refuses a banned account, even with a session from before the ban (T60b)', async () => {
    const now = Date.parse('2026-10-11T12:00:00Z');
    // Auth's own ban…
    expect(await requireUser(`Bearer ${JWT}`, env, auth(200, { id: 'u1', role: 'authenticated', banned_until: '2026-10-12T00:00:00Z' }), { now })).toEqual({ ok: false, banned: true });
    // …a ban that already ran out doesn't count…
    const past = (url: string) => (url.endsWith('/rpc/is_banned') ? { ok: true, json: async () => false } : { ok: true, json: async () => ({ id: 'u1', role: 'authenticated', banned_until: '2026-10-01T00:00:00Z' }) });
    expect(await requireUser(`Bearer ${JWT}`, env, async (u) => past(u), { now })).toEqual({ ok: true, userId: 'u1' });
    // …and HLITH's ban, asked as the caller.
    const calls: { url: string; method?: string }[] = [];
    const hlith = async (url: string, init: { method?: string }) => {
      calls.push({ url, method: init.method });
      return url.endsWith('/rpc/is_banned') ? { ok: true, json: async () => true } : { ok: true, json: async () => ({ id: 'u1', role: 'authenticated' }) };
    };
    expect(await requireUser(`Bearer ${JWT}`, env, hlith, { now })).toEqual({ ok: false, banned: true });
    expect(calls.at(-1)).toEqual({ url: 'https://p.supabase.co/rest/v1/rpc/is_banned', method: 'POST' });
    // Only Export my data lets a banned account through, to download its own data.
    expect(await requireUser(`Bearer ${JWT}`, env, hlith, { now, allowBanned: true })).toEqual({ ok: true, userId: 'u1', banned: true });
  });

  it('only Export my data lets banned accounts through; every other server function refuses them', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const dir = resolve(__dirname, '../supabase/functions');
    const users = readdirSync(dir).filter((f) => !f.startsWith('_')).filter((f) => {
      try {
        return readFileSync(resolve(dir, f, 'index.ts'), 'utf8').includes('requireUser(');
      } catch {
        return false;
      }
    });
    const allowing = users.filter((f) => readFileSync(resolve(dir, f, 'index.ts'), 'utf8').includes('allowBanned: true'));
    expect(users.length).toBeGreaterThan(4);
    expect(allowing).toEqual(['export-data']);
  });
});
