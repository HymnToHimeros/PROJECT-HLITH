/**
 * Exchange an Endfield account_token (from the web account page) for a u8_token
 * that the existing fetchHistory() accepts.
 *
 * Three steps:
 *   1. OAuth grant  → oauthToken
 *   2. Binding list → uid + serverId
 *   3. u8_token     → the token fetchHistory needs
 *
 * Pure logic; `fetch` is injected so the module is testable without network.
 * Only the hosts below are ever contacted.
 *
 * Reference: bhaoo/endfield-gacha useGachaAuth.ts (MIT, v0.7.0).
 */

import type { ParsedLink } from './endfieldGachaLog.ts';

type Region = 'global' | 'cn';

const REGION_CONFIG: Record<Region, { authHost: string; bindingHost: string; webviewHost: string; appCode: string; defaultServerId: string }> = {
  global: {
    authHost: 'as.gryphline.com',
    bindingHost: 'binding-api-account-prod.gryphline.com',
    webviewHost: 'ef-webview.gryphline.com',
    appCode: '3dacefa138426cfe',
    defaultServerId: '',
  },
  cn: {
    authHost: 'as.hypergryph.com',
    bindingHost: 'binding-api-account-prod.hypergryph.com',
    webviewHost: 'ef-webview.hypergryph.com',
    appCode: 'be36d44aa36bfb5b',
    defaultServerId: '1',
  },
};

const ALLOWED_HOSTS = new Set(
  Object.values(REGION_CONFIG).flatMap((c) => [c.authHost, c.bindingHost]),
);

export type ExchangeError = 'expired' | 'no-binding' | 'server';

export const EXCHANGE_ERROR_TEXT: Record<ExchangeError, string> = {
  expired: 'That token has expired. Visit the account page again, copy a fresh token and try once more.',
  'no-binding': 'No Endfield account found for this token. Make sure you picked the right region (CN or Global) and that this account has played Endfield.',
  server: 'The Endfield account server returned an error. Try again in a minute.',
};

export interface ExchangeDeps {
  fetch: (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
}

interface BindingRole {
  serverId?: string;
  serverName?: string;
  nickName?: string;
  roleId?: string;
}

function allowedUrl(url: string): boolean {
  try {
    return ALLOWED_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

export async function exchangeForU8Token(
  accountToken: string,
  region: Region,
  deps: ExchangeDeps,
): Promise<{ ok: true; link: ParsedLink; uid: string } | { ok: false; error: ExchangeError }> {
  const cfg = REGION_CONFIG[region];

  // Step 1: OAuth grant
  const grantUrl = `https://${cfg.authHost}/user/oauth2/v2/grant`;
  if (!allowedUrl(grantUrl)) return { ok: false, error: 'server' };
  let grantRes;
  try {
    grantRes = await deps.fetch(grantUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: accountToken, appCode: cfg.appCode, type: 1 }),
    });
  } catch {
    return { ok: false, error: 'server' };
  }
  if (!grantRes.ok) return { ok: false, error: grantRes.status === 401 ? 'expired' : 'server' };
  const grantBody = (await grantRes.json()) as { status?: number; data?: { token?: string }; msg?: string };
  if (grantBody.status !== 0 || !grantBody.data?.token) return { ok: false, error: 'expired' };
  const oauthToken = grantBody.data.token;

  // Step 2: Binding list → uid + roles (serverId)
  const bindingUrl = `https://${cfg.bindingHost}/account/binding/v1/binding_list?${new URLSearchParams({ token: oauthToken, appCode: 'endfield' })}`;
  if (!allowedUrl(bindingUrl)) return { ok: false, error: 'server' };
  let bindRes;
  try {
    bindRes = await deps.fetch(bindingUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return { ok: false, error: 'server' };
  }
  if (!bindRes.ok) return { ok: false, error: 'server' };
  const bindBody = (await bindRes.json()) as { status?: number; data?: { list?: { appCode?: string; bindingList?: { uid?: string; roles?: BindingRole[] }[] }[] } };
  if (bindBody.status !== 0) return { ok: false, error: 'expired' };

  const appEntry = bindBody.data?.list?.find((x) => x.appCode === 'endfield') ?? bindBody.data?.list?.[0];
  const binding = appEntry?.bindingList?.[0];
  const uid = String(binding?.uid ?? '').trim();
  if (!uid) return { ok: false, error: 'no-binding' };

  const role = binding?.roles?.[0];
  const serverId = String(role?.serverId ?? '').trim() || cfg.defaultServerId;
  if (!serverId) return { ok: false, error: 'no-binding' };

  // Step 3: u8_token from uid + oauthToken
  const u8Url = `https://${cfg.bindingHost}/account/binding/v1/u8_token_by_uid`;
  if (!allowedUrl(u8Url)) return { ok: false, error: 'server' };
  let u8Res;
  try {
    u8Res = await deps.fetch(u8Url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, token: oauthToken }),
    });
  } catch {
    return { ok: false, error: 'server' };
  }
  if (!u8Res.ok) return { ok: false, error: 'server' };
  const u8Body = (await u8Res.json()) as { status?: number; data?: { token?: string } };
  if (u8Body.status !== 0 || !u8Body.data?.token) return { ok: false, error: 'expired' };

  return {
    ok: true,
    uid,
    link: {
      host: cfg.webviewHost,
      region,
      token: u8Body.data.token,
      serverId,
    },
  };
}
