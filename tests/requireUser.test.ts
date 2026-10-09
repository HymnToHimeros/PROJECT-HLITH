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
});
