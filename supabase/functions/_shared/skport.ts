/**
 * Reads a player's own SKPort data: live sanity (stamina), account level and
 * daily check-in for Arknights: Endfield. Pure logic shared by the skport
 * server function and tests; `fetch` and crypto helpers are passed in.
 *
 * SKPort is Gryphline's community platform (global counterpart of HyperGryph's
 * SKLand for CN). There is no official public API; everything below is
 * reverse-engineered from community sources:
 *   - AixLnyt/skport-api-docs (GitHub, MIT) — endpoint catalogue, signing
 *   - canaria3406/skport-auto-sign — check-in reference implementation
 *   - yeci226/endfield-discord-bot — three-tier auth documentation
 *   - cptmacp gist — inline V2 signing code
 * All endpoints and the signing algorithm are UNOFFICIAL and may break.
 *
 * Safety:
 * - Only the hosts in ALLOWED_HOSTS are ever contacted.
 * - The player's account token, cred and salt are used for this one request.
 *   They are never logged, never sent back in the answer, and never included
 *   in error messages.
 */

export type SkportError = 'bad-request' | 'login' | 'expired' | 'no-account' | 'pick-role' | 'busy' | 'server';
export type Part = 'account' | 'stamina' | 'checkin';

export const ALLOWED_HOSTS = new Set(['zonai.skport.com', 'as.gryphline.com']);

export interface Stamina {
  current: number;
  max: number;
  fullInSeconds: number;
}

export interface CheckinInfo {
  checkedInToday: boolean;
  daysThisMonth: number | null;
  claimedNow: boolean;
}

export interface Answer {
  account: { uid: string; nickname: string; level: number | null; worldLevel: number | null; server: string };
  readAt: string;
  stamina?: Stamina | null;
  checkin?: CheckinInfo | null;
  problems: Partial<Record<Part, { code: SkportError; text: string }>>;
}

export interface BoundRole {
  uid: string;
  nickname: string;
  level: number;
  serverId: string;
  serverName: string;
}

export interface Deps {
  fetch: (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
  hmacSha256: (key: string, data: string) => Promise<string>;
  md5: (s: string) => string;
  now: () => number;
}

interface Cred {
  cred: string;
  salt: string;
}

function allowedUrl(url: string): boolean {
  try {
    return ALLOWED_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

// ── Token exchange (ACCOUNT_TOKEN → cred → salt) ─────────────────

async function exchangeToken(accountToken: string, deps: Deps): Promise<{ ok: true; cred: Cred } | { ok: false; error: SkportError }> {
  // Step 1: OAuth grant — exchange account token for a code
  const grantUrl = 'https://as.gryphline.com/user/oauth2/v2/grant';
  if (!allowedUrl(grantUrl)) return { ok: false, error: 'server' };
  let grantRes;
  try {
    grantRes = await deps.fetch(grantUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountToken}` },
      body: JSON.stringify({ appCode: '4ca99fa6b56cc2ba', token: accountToken, type: 0 }),
    });
  } catch {
    return { ok: false, error: 'server' };
  }
  if (!grantRes.ok) return { ok: false, error: grantRes.status === 401 ? 'expired' : 'server' };
  const grantBody = (await grantRes.json()) as { status?: number; data?: { code?: string } };
  if (grantBody.status !== 0 || !grantBody.data?.code) return { ok: false, error: 'expired' };
  const code = grantBody.data.code;

  // Step 2: Generate cred from the OAuth code
  const credUrl = 'https://zonai.skport.com/web/v1/user/auth/generate_cred_by_code';
  if (!allowedUrl(credUrl)) return { ok: false, error: 'server' };
  let credRes;
  try {
    credRes = await deps.fetch(credUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 1, code }),
    });
  } catch {
    return { ok: false, error: 'server' };
  }
  if (!credRes.ok) return { ok: false, error: 'server' };
  const credBody = (await credRes.json()) as { code?: number; data?: { cred?: string } };
  if (credBody.code !== 0 || !credBody.data?.cred) return { ok: false, error: 'expired' };
  const cred = credBody.data.cred;

  // Step 3: Refresh to get the signing salt
  const refreshUrl = 'https://zonai.skport.com/web/v1/auth/refresh';
  if (!allowedUrl(refreshUrl)) return { ok: false, error: 'server' };
  let refreshRes;
  try {
    refreshRes = await deps.fetch(refreshUrl, {
      method: 'GET',
      headers: { cred },
    });
  } catch {
    return { ok: false, error: 'server' };
  }
  if (!refreshRes.ok) return { ok: false, error: 'server' };
  const refreshBody = (await refreshRes.json()) as { code?: number; data?: { token?: string } };
  if (refreshBody.code !== 0 || !refreshBody.data?.token) return { ok: false, error: 'expired' };

  return { ok: true, cred: { cred, salt: refreshBody.data.token } };
}

// ── V2 request signing ───────────────────────────────────────────

async function signV2(path: string, body: string, cred: Cred, deps: Deps): Promise<{ sign: string; timestamp: string; headers: Record<string, string> }> {
  const timestamp = String(Math.floor(deps.now() / 1000));
  const headerObj = { platform: '3', timestamp, dId: '', vName: '1.0.0' };
  const headerJson = JSON.stringify(headerObj);
  const payload = path + body + timestamp + headerJson;
  const hmac = await deps.hmacSha256(cred.salt, payload);
  const sign = deps.md5(hmac);
  return {
    sign,
    timestamp,
    headers: {
      cred: cred.cred,
      sign,
      timestamp,
      platform: '3',
      vName: '1.0.0',
      'Content-Type': 'application/json',
      Origin: 'https://game.skport.com',
      Referer: 'https://game.skport.com/',
    },
  };
}

// ── API call helper ──────────────────────────────────────────────

interface ApiResult { code: number; data?: unknown; message?: string }

async function call(
  method: 'GET' | 'POST',
  url: string,
  body: string,
  cred: Cred,
  deps: Deps,
  extra?: Record<string, string>,
): Promise<{ ok: true; data: unknown } | { ok: false; error: SkportError }> {
  if (!allowedUrl(url)) return { ok: false, error: 'server' };
  const parsed = new URL(url);
  const path = parsed.pathname + parsed.search;
  const signed = await signV2(path, body, cred, deps);
  const headers = { ...signed.headers, ...(extra ?? {}) };
  let res;
  try {
    res = await deps.fetch(url, { method, headers, body: method === 'POST' ? body : undefined });
  } catch {
    return { ok: false, error: 'server' };
  }
  if (!res.ok) return { ok: false, error: res.status === 429 ? 'busy' : 'server' };
  let json: ApiResult;
  try {
    json = (await res.json()) as ApiResult;
  } catch {
    return { ok: false, error: 'server' };
  }
  if (json.code === 10002 || json.code === 10000) return { ok: false, error: 'expired' };
  if (json.code !== 0 && json.code !== 10001) return { ok: false, error: 'server' };
  return { ok: true, data: json.data };
}

// ── Bound roles (account discovery) ──────────────────────────────

export async function findRoles(cred: Cred, deps: Deps): Promise<{ ok: true; roles: BoundRole[] } | { ok: false; error: SkportError }> {
  const url = 'https://zonai.skport.com/api/v1/game/player/binding';
  const res = await call('GET', url, '', cred, deps);
  if (!res.ok) return res;
  const data = res.data as { list?: Array<{ bindingList?: Array<{ uid?: string; nickName?: string; level?: number; serverId?: string; serverName?: string; isDefault?: boolean }> }> };
  const roles: BoundRole[] = [];
  for (const game of data.list ?? []) {
    for (const b of game.bindingList ?? []) {
      if (b.uid) roles.push({ uid: b.uid, nickname: b.nickName ?? '', level: b.level ?? 0, serverId: b.serverId ?? '', serverName: b.serverName ?? '' });
    }
  }
  return { ok: true, roles };
}

// ── Card detail (stamina + account level) ────────────────────────

interface CardDetail {
  base?: { name?: string; level?: number; worldLevel?: number; roleId?: string; serverName?: string };
  dungeon?: { curStamina?: number; maxStamina?: number; maxTs?: number };
}

async function readCard(role: BoundRole, cred: Cred, deps: Deps): Promise<{ ok: true; detail: CardDetail } | { ok: false; error: SkportError }> {
  const url = `https://zonai.skport.com/api/v1/game/endfield/card/detail?roleId=${encodeURIComponent(role.uid)}&serverId=${encodeURIComponent(role.serverId)}`;
  const gameRole = `3_${role.uid}_${role.serverId}`;
  const res = await call('GET', url, '', cred, deps, { 'sk-game-role': gameRole });
  if (!res.ok) return res;
  return { ok: true, detail: (res.data ?? {}) as CardDetail };
}

// ── Check-in ─────────────────────────────────────────────────────

async function readCheckin(role: BoundRole, cred: Cred, deps: Deps): Promise<CheckinInfo | null> {
  const gameRole = `3_${role.uid}_${role.serverId}`;
  const url = 'https://zonai.skport.com/web/v1/game/endfield/attendance';
  const res = await call('GET', url, '', cred, deps, { 'sk-game-role': gameRole });
  if (!res.ok) return null;
  const data = res.data as { calendar?: Array<{ checked?: boolean }>; hasSigned?: boolean };
  const signed = data.calendar?.filter((d) => d.checked).length ?? null;
  return { checkedInToday: data.hasSigned === true, daysThisMonth: signed, claimedNow: false };
}

export async function claimCheckin(role: BoundRole, cred: Cred, deps: Deps): Promise<{ ok: true; alreadyClaimed: boolean } | { ok: false; error: SkportError }> {
  const gameRole = `3_${role.uid}_${role.serverId}`;
  const url = 'https://zonai.skport.com/web/v1/game/endfield/attendance';
  const res = await call('POST', url, '{}', cred, deps, { 'sk-game-role': gameRole });
  if (!res.ok) return res;
  return { ok: true, alreadyClaimed: false };
}

// ── Main orchestrator ────────────────────────────────────────────

export interface ReadRequest {
  accountToken: string;
  uid?: string;
  want: Part[];
  claim?: boolean;
}

export function parseRequest(body: Record<string, unknown>): { ok: true; request: ReadRequest } | { ok: false; error: SkportError } {
  const accountToken = typeof body.accountToken === 'string' ? body.accountToken.trim() : '';
  if (!accountToken) return { ok: false, error: 'bad-request' };
  const want: Part[] = Array.isArray(body.want) ? (body.want as string[]).filter((p): p is Part => ['account', 'stamina', 'checkin'].includes(p as string)) : ['account', 'stamina'];
  const uid = typeof body.uid === 'string' ? body.uid : undefined;
  const claim = body.claim === true;
  return { ok: true, request: { accountToken, uid, want, claim } };
}

export async function readSkport(
  req: ReadRequest,
  deps: Deps,
): Promise<{ ok: true; answer: Answer } | { ok: false; error: SkportError; roles?: BoundRole[] }> {
  const ex = await exchangeToken(req.accountToken, deps);
  if (!ex.ok) return ex;
  const cred = ex.cred;

  const rolesResult = await findRoles(cred, deps);
  if (!rolesResult.ok) return rolesResult;
  if (rolesResult.roles.length === 0) return { ok: false, error: 'no-account' };

  let role: BoundRole;
  if (req.uid) {
    const found = rolesResult.roles.find((r) => r.uid === req.uid);
    if (!found) return { ok: false, error: 'no-account' };
    role = found;
  } else if (rolesResult.roles.length === 1) {
    role = rolesResult.roles[0] as BoundRole;
  } else {
    return { ok: false, error: 'pick-role', roles: rolesResult.roles };
  }

  const answer: Answer = {
    account: { uid: role.uid, nickname: role.nickname, level: null, worldLevel: null, server: role.serverName },
    readAt: new Date(deps.now()).toISOString(),
    problems: {},
  };

  // Card detail: stamina + account level
  if (req.want.includes('account') || req.want.includes('stamina')) {
    const card = await readCard(role, cred, deps);
    if (card.ok) {
      const base = card.detail.base;
      if (base) {
        answer.account.level = base.level ?? null;
        answer.account.worldLevel = base.worldLevel ?? null;
        if (base.name) answer.account.nickname = base.name;
        if (base.serverName) answer.account.server = base.serverName;
      }
      if (req.want.includes('stamina')) {
        const d = card.detail.dungeon;
        if (d && typeof d.curStamina === 'number' && typeof d.maxStamina === 'number') {
          const fullInSeconds = typeof d.maxTs === 'number' ? Math.max(0, Math.floor(d.maxTs - deps.now() / 1000)) : 0;
          answer.stamina = { current: d.curStamina, max: d.maxStamina, fullInSeconds };
        } else {
          answer.stamina = null;
        }
      }
    } else {
      if (req.want.includes('stamina')) answer.problems.stamina = { code: card.error, text: ERROR_TEXT[card.error] };
      if (req.want.includes('account')) answer.problems.account = { code: card.error, text: ERROR_TEXT[card.error] };
    }
  }

  // Check-in
  if (req.want.includes('checkin')) {
    const info = await readCheckin(role, cred, deps);
    if (info) {
      if (req.claim && !info.checkedInToday) {
        const claimed = await claimCheckin(role, cred, deps);
        if (claimed.ok) {
          info.checkedInToday = true;
          info.claimedNow = true;
          if (info.daysThisMonth !== null) info.daysThisMonth++;
        }
      }
      answer.checkin = info;
    } else {
      answer.problems.checkin = { code: 'server', text: ERROR_TEXT.server };
    }
  }

  return { ok: true, answer };
}

export const ERROR_TEXT: Record<SkportError, string> = {
  'bad-request': 'Send JSON with an account token.',
  login: 'That account token is not valid. Copy it from your SKPort cookies or the cookie_store page.',
  expired: 'That account token has expired. Log in to SKPort again and copy a fresh one.',
  'no-account': 'No Endfield account found on this SKPort login. Make sure you bound your game account in SKPort.',
  'pick-role': 'More than one Endfield account is bound. Pick which one to use.',
  busy: 'SKPort is limiting requests right now. Try again in a few minutes.',
  server: 'SKPort returned an error. Try again later.',
};
