// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { exchangeForU8Token, type ExchangeDeps } from '../supabase/functions/_shared/endfieldWebSignin';

function fakeDeps(responses: Record<string, { ok: boolean; status: number; body: unknown }>): ExchangeDeps & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    fetch: async (url: string) => {
      calls.push(url);
      const key = Object.keys(responses).find((k) => url.startsWith(k));
      const r = key ? responses[key] : { ok: false, status: 404, body: {} };
      const res = r ?? { ok: false, status: 404, body: {} };
      return { ok: res.ok, status: res.status, json: async () => res.body };
    },
  };
}

describe('exchangeForU8Token', () => {
  const GRANT_GLOBAL = 'https://as.gryphline.com/user/oauth2/v2/grant';
  const BINDING_GLOBAL = 'https://binding-api-account-prod.gryphline.com/account/binding/v1/binding_list';
  const U8_GLOBAL = 'https://binding-api-account-prod.gryphline.com/account/binding/v1/u8_token_by_uid';

  const GRANT_CN = 'https://as.hypergryph.com/user/oauth2/v2/grant';
  const BINDING_CN = 'https://binding-api-account-prod.hypergryph.com/account/binding/v1/binding_list';
  const U8_CN = 'https://binding-api-account-prod.hypergryph.com/account/binding/v1/u8_token_by_uid';

  it('exchanges a global account token for a u8 token and link', async () => {
    const deps = fakeDeps({
      [GRANT_GLOBAL]: { ok: true, status: 200, body: { status: 0, data: { token: 'oauth-tok' } } },
      [BINDING_GLOBAL]: {
        ok: true,
        status: 200,
        body: {
          status: 0,
          data: {
            list: [{
              appCode: 'endfield',
              bindingList: [{ uid: '12345', roles: [{ serverId: 'terra1', serverName: 'Global', nickName: 'Player', roleId: 'r1' }] }],
            }],
          },
        },
      },
      [U8_GLOBAL]: { ok: true, status: 200, body: { status: 0, data: { token: 'u8-final' } } },
    });

    const result = await exchangeForU8Token('my-account-token', 'global', deps);
    expect(result).toEqual({
      ok: true,
      uid: '12345',
      link: { host: 'ef-webview.gryphline.com', region: 'global', token: 'u8-final', serverId: 'terra1' },
    });
    expect(deps.calls).toHaveLength(3);
    expect(deps.calls[0]).toContain('as.gryphline.com');
    expect(deps.calls[1]).toContain('binding_list');
    expect(deps.calls[2]).toContain('u8_token_by_uid');
  });

  it('exchanges a CN account token', async () => {
    const deps = fakeDeps({
      [GRANT_CN]: { ok: true, status: 200, body: { status: 0, data: { token: 'oauth-cn' } } },
      [BINDING_CN]: {
        ok: true,
        status: 200,
        body: {
          status: 0,
          data: {
            list: [{
              appCode: 'endfield',
              bindingList: [{ uid: '99', roles: [{ serverId: '1', serverName: 'China', nickName: 'P', roleId: 'r2' }] }],
            }],
          },
        },
      },
      [U8_CN]: { ok: true, status: 200, body: { status: 0, data: { token: 'u8-cn' } } },
    });

    const result = await exchangeForU8Token('cn-token', 'cn', deps);
    expect(result).toEqual({
      ok: true,
      uid: '99',
      link: { host: 'ef-webview.hypergryph.com', region: 'cn', token: 'u8-cn', serverId: '1' },
    });
    expect(deps.calls[0]).toContain('as.hypergryph.com');
  });

  it('returns expired when the grant fails with 401', async () => {
    const deps = fakeDeps({
      [GRANT_GLOBAL]: { ok: false, status: 401, body: {} },
    });
    const result = await exchangeForU8Token('bad', 'global', deps);
    expect(result).toEqual({ ok: false, error: 'expired' });
  });

  it('returns expired when the grant body says status != 0', async () => {
    const deps = fakeDeps({
      [GRANT_GLOBAL]: { ok: true, status: 200, body: { status: 1, msg: 'invalid token' } },
    });
    const result = await exchangeForU8Token('bad', 'global', deps);
    expect(result).toEqual({ ok: false, error: 'expired' });
  });

  it('returns no-binding when the binding list has no Endfield account', async () => {
    const deps = fakeDeps({
      [GRANT_GLOBAL]: { ok: true, status: 200, body: { status: 0, data: { token: 'oauth' } } },
      [BINDING_GLOBAL]: {
        ok: true,
        status: 200,
        body: { status: 0, data: { list: [{ appCode: 'arknights', bindingList: [] }] } },
      },
    });
    const result = await exchangeForU8Token('tok', 'global', deps);
    expect(result).toEqual({ ok: false, error: 'no-binding' });
  });

  it('returns server when a network call fails', async () => {
    const deps: ExchangeDeps = {
      fetch: async () => { throw new Error('network'); },
    };
    const result = await exchangeForU8Token('tok', 'global', deps);
    expect(result).toEqual({ ok: false, error: 'server' });
  });

  it('uses the default serverId for CN when no role serverId', async () => {
    const deps = fakeDeps({
      [GRANT_CN]: { ok: true, status: 200, body: { status: 0, data: { token: 'oauth' } } },
      [BINDING_CN]: {
        ok: true,
        status: 200,
        body: {
          status: 0,
          data: { list: [{ appCode: 'endfield', bindingList: [{ uid: '50', roles: [{}] }] }] },
        },
      },
      [U8_CN]: { ok: true, status: 200, body: { status: 0, data: { token: 'u8-cn2' } } },
    });
    const result = await exchangeForU8Token('tok', 'cn', deps);
    if (!result.ok) throw new Error('expected ok');
    expect(result.link.serverId).toBe('1');
  });

  it('only contacts allowed hosts', async () => {
    const deps = fakeDeps({
      [GRANT_GLOBAL]: { ok: true, status: 200, body: { status: 0, data: { token: 'oauth' } } },
      [BINDING_GLOBAL]: {
        ok: true,
        status: 200,
        body: {
          status: 0,
          data: {
            list: [{
              appCode: 'endfield',
              bindingList: [{ uid: '1', roles: [{ serverId: 's1' }] }],
            }],
          },
        },
      },
      [U8_GLOBAL]: { ok: true, status: 200, body: { status: 0, data: { token: 'u8' } } },
    });
    await exchangeForU8Token('tok', 'global', deps);
    for (const url of deps.calls) {
      const host = new URL(url).hostname;
      expect(['as.gryphline.com', 'binding-api-account-prod.gryphline.com']).toContain(host);
    }
  });
});
