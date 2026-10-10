/**
 * Several HoYoLAB logins per player ("Main", "Alt"…), each covering one or more
 * games and UIDs. Two places a login can live:
 * - on this device (hoyolab.ts, browser storage), or
 * - on HLITH's server, encrypted in Supabase Vault (migration 0003). Only these can
 *   do the automatic daily check-in and codes, because the server needs the login
 *   when nobody has the site open.
 * Every game's data stays in that game's own roster and records: an account only
 * says which login reads which game.
 *
 * Pure helpers first (tested), then the calls to HLITH's server.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { GameContract } from '../../core/contract';
import { deviceAccounts, hoyolabLink, type DeviceAccount, type HoyoLogin } from './hoyolab';

export interface CoveredGame {
  gameId: string;
  uid?: string;
  nickname?: string;
  server?: string;
}

export interface LinkedAccount {
  id: string;
  label: string;
  where: 'server' | 'device';
  /** The HoYoLAB account number (ltuid_v2). Shown masked. */
  hoyolabId: string;
  games: CoveredGame[];
  autoCheckin: boolean;
  autoRedeem: boolean;
  hasRedeemLogin: boolean;
  /** Device accounts only: the login itself, sent per request. Server accounts never have it in the browser. */
  login?: HoyoLogin;
}

/** "Main" for the first, then "Alt", "Alt 2", "Alt 3"… skipping labels already used. */
export function nextLabel(used: string[]): string {
  const taken = new Set(used.map((u) => u.trim().toLowerCase()));
  if (!taken.has('main')) return 'Main';
  if (!taken.has('alt')) return 'Alt';
  for (let n = 2; ; n++) if (!taken.has(`alt ${n}`)) return `Alt ${n}`;
}

/** "1234•••89": enough to tell two logins apart, not the whole number. */
export function maskId(id: string): string {
  return id.length <= 6 ? id : `${id.slice(0, 4)}•••${id.slice(-2)}`;
}

/** Accounts that cover this game, in list order. */
export function accountsFor(accounts: LinkedAccount[], gameId: string): LinkedAccount[] {
  return accounts.filter((a) => a.games.some((g) => g.gameId === gameId));
}

/** gameBiz → HLITH game id, from the game records (tools never name a game themselves). */
export function bizMap(games: GameContract[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const g of games) {
    const biz = hoyolabLink(g)?.config.gameBiz;
    if (biz) out.set(biz, g.id);
  }
  return out;
}

export interface ServerRow {
  id: string;
  label: string;
  hoyolab_id: string;
  games: unknown;
  has_redeem_login: boolean;
  auto_checkin: boolean;
  auto_redeem: boolean;
  forgotten_at: string | null;
}

/** Saved rows → accounts. Forgotten rows stay in the database (never wiped) but leave the list. */
export function fromServerRows(rows: ServerRow[], games: GameContract[]): LinkedAccount[] {
  const map = bizMap(games);
  return rows
    .filter((r) => !r.forgotten_at)
    .map((r) => ({
      id: r.id,
      label: r.label,
      where: 'server' as const,
      hoyolabId: r.hoyolab_id,
      games: (Array.isArray(r.games) ? r.games : []).flatMap((g): CoveredGame[] => {
        const o = g && typeof g === 'object' ? (g as Record<string, unknown>) : {};
        const gameId = map.get(String(o.gameBiz));
        if (!gameId) return [];
        return [{ gameId, ...(typeof o.uid === 'string' ? { uid: o.uid } : {}), ...(typeof o.nickname === 'string' && o.nickname ? { nickname: o.nickname } : {}), ...(typeof o.server === 'string' && o.server ? { server: o.server } : {}) }];
      }),
      autoCheckin: r.auto_checkin,
      autoRedeem: r.auto_redeem,
      hasRedeemLogin: r.has_redeem_login,
    }));
}

export function fromDevice(list: DeviceAccount[]): LinkedAccount[] {
  return list.map((a) => ({ id: a.id, label: a.label, where: 'device', hoyolabId: a.login.ltuid_v2, games: a.games, autoCheckin: false, autoRedeem: false, hasRedeemLogin: false, login: a.login }));
}

/** One list: server accounts first, then this device's; a device copy of a login already saved on the server is not shown twice. */
export function mergeAccounts(server: LinkedAccount[], device: LinkedAccount[]): LinkedAccount[] {
  const onServer = new Set(server.map((a) => a.hoyolabId));
  return [...server, ...device.filter((d) => !onServer.has(d.hoyolabId))];
}

/** Which account feeds each game's roster in "import every game": the first that covers it, unless the player picked another. */
export function importSources(accounts: LinkedAccount[], games: GameContract[], picked: Record<string, string> = {}): { game: GameContract; account: LinkedAccount; uid: string | undefined; choices: LinkedAccount[] }[] {
  return games.flatMap((game) => {
    const choices = accountsFor(accounts, game.id);
    const account = choices.find((a) => a.id === picked[game.id]) ?? choices[0];
    if (!account) return [];
    return [{ game, account, uid: account.games.find((g) => g.gameId === game.id)?.uid, choices }];
  });
}

// ── Results of automatic runs ────────────────────────────────────

export interface CheckinRow {
  link_id: string;
  game_biz: string;
  ran_at: string;
  started_by: 'auto' | 'manual';
  status: 'claimed' | 'already' | 'error';
  message: string | null;
  reward: string | null;
}
export interface RedemptionRow {
  link_id: string;
  game_biz: string;
  game_uid: string;
  code: string;
  ran_at: string;
  status: string;
  message: string | null;
}

const two = (n: number) => String(n).padStart(2, '0');

/** "today 05:02", "yesterday 05:02" or "8 Oct 05:02", in the player's own time. */
export function when(iso: string, nowMs: number): string {
  const d = new Date(iso);
  const time = `${two(d.getHours())}:${two(d.getMinutes())}`;
  const day = (t: Date) => `${t.getFullYear()}-${t.getMonth()}-${t.getDate()}`;
  const now = new Date(nowMs);
  if (day(d) === day(now)) return `today ${time}`;
  if (day(d) === day(new Date(nowMs - 86_400_000))) return `yesterday ${time}`;
  return `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })} ${time}`;
}

/**
 * The line under a game in an account card:
 * "Last automatic check-in: today 05:02 · got 20 × Stellar Jade", or its error,
 * or null when there's no automatic check-in on record yet.
 */
export function lastCheckinLine(rows: CheckinRow[], linkId: string, gameBiz: string, nowMs: number): { text: string; ok: boolean } | null {
  const last = rows.filter((r) => r.link_id === linkId && r.game_biz === gameBiz).sort((a, b) => b.ran_at.localeCompare(a.ran_at))[0];
  if (!last) return null;
  const who = last.started_by === 'auto' ? 'Last automatic check-in' : 'Last check-in (by you)';
  const at = when(last.ran_at, nowMs);
  if (last.status === 'claimed') return { text: `${who}: ${at}${last.reward ? ` · got ${last.reward}` : ' · claimed'}`, ok: true };
  if (last.status === 'already') return { text: `${who}: ${at} · was already done today`, ok: true };
  return { text: `${who} failed: ${at} · ${last.message ?? 'HoYoLAB returned an error.'}`, ok: false };
}

export const REDEEM_WORD: Record<string, string> = {
  redeemed: 'redeemed',
  'already-used': 'already used',
  expired: 'expired',
  invalid: 'not valid',
  'region-locked': 'other region',
  'level-too-low': 'level too low',
  cooldown: 'waiting',
  login: 'login expired',
  captcha: 'needs you',
  error: 'error',
};

/** Latest answer per code and game account, newest first. */
export function latestRedemptions(rows: RedemptionRow[], linkId: string, limit = 8): RedemptionRow[] {
  const seen = new Set<string>();
  return rows
    .filter((r) => r.link_id === linkId)
    .sort((a, b) => b.ran_at.localeCompare(a.ran_at))
    .filter((r) => {
      const k = `${r.game_uid}:${r.code}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, limit);
}

// ── The separate code login (hoyoverse.com) ──────────────────────

export interface RedeemLogin {
  account_id_v2: string;
  account_mid_v2: string;
  cookie_token_v2: string;
}

type RedeemKey = keyof RedeemLogin;
const REDEEM_KEYS: RedeemKey[] = ['account_id_v2', 'account_mid_v2', 'cookie_token_v2'];

/** name=value lines or bare values: account_id_v2 = digits, account_mid_v2 = ends in _hy, cookie_token_v2 = starts with v2_. */
export function readRedeemLogin(text: string): { ok: true; login: RedeemLogin } | { ok: false; missing: RedeemKey[] } {
  const found: Partial<RedeemLogin> = {};
  for (const part of text.split(/[;\n]/)) {
    const m = part.trim().match(/^(account_id_v2|account_mid_v2|cookie_token_v2)\s*[=:\t ]\s*"?([^"\s;]+)"?/);
    if (m?.[1] && m[2]) found[m[1] as RedeemKey] = m[2];
  }
  for (const token of text.split(/[\s;,]+/)) {
    const v = token.trim().replace(/^"|"$/g, '');
    if (!v || v.includes('=')) continue;
    if (!found.cookie_token_v2 && /^v2_[\w\-.=+/]{10,600}$/.test(v)) found.cookie_token_v2 = v;
    else if (!found.account_id_v2 && /^\d{4,15}$/.test(v)) found.account_id_v2 = v;
    else if (!found.account_mid_v2 && /^[0-9a-z]{4,30}_hy$/i.test(v)) found.account_mid_v2 = v;
  }
  const missing = REDEEM_KEYS.filter((k) => !found[k]);
  if (missing.length || !found.account_id_v2 || !found.account_mid_v2 || !found.cookie_token_v2) return { ok: false, missing };
  return { ok: true, login: { account_id_v2: found.account_id_v2, account_mid_v2: found.account_mid_v2, cookie_token_v2: found.cookie_token_v2 } };
}

/**
 * The code login must be the same HoYoverse account as the saved login: its
 * account_id_v2 is the same number as the account's HoYoLAB ID (ltuid_v2).
 * HLITH's server checks this too (and ltmid_v2 against account_mid_v2).
 */
export const sameAccount = (redeem: RedeemLogin, hoyolabId: string): boolean => redeem.account_id_v2 === hoyolabId;

/** True when HoYoverse's latest answer for this account's codes was "login not accepted". */
export function codeLoginRefused(rows: RedemptionRow[], linkId: string): RedemptionRow | null {
  const last = latestRedemptions(rows, linkId, 1)[0];
  return last?.status === 'login' ? last : null;
}

/** Gift codes are letters and digits; pasted text is split on anything else. */
export function readCodes(text: string): string[] {
  return [...new Set(text.toUpperCase().split(/[^A-Z0-9]+/).filter((c) => /^[A-Z0-9]{4,30}$/.test(c)))];
}

// ── Talking to HLITH's server ────────────────────────────────────

const SERVER_COLUMNS = 'id,label,hoyolab_id,games,has_redeem_login,auto_checkin,auto_redeem,forgotten_at';

async function errorText(error: unknown, fallback: string): Promise<string> {
  const ctx = error && typeof error === 'object' && 'context' in error ? (error as { context: unknown }).context : null;
  const body: unknown = ctx instanceof Response ? await ctx.json().catch(() => null) : null;
  return body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string' ? (body as { error: string }).error : fallback;
}

async function action<T>(client: SupabaseClient, body: Record<string, unknown>): Promise<{ ok: true; data: T } | { ok: false; text: string }> {
  const { data, error } = await client.functions.invoke<T>('hoyolab', { body });
  if (error || data === null) return { ok: false, text: await errorText(error, 'HLITH’s server couldn’t be reached. Try again in a minute.') };
  return { ok: true, data };
}

export interface ServerState {
  accounts: LinkedAccount[];
  checkins: CheckinRow[];
  redemptions: RedemptionRow[];
  /** How many codes the public list has per gameBiz (what HLITH will try). */
  publicCodes: Record<string, number>;
}

export async function loadServer(client: SupabaseClient, games: GameContract[]): Promise<ServerState | { error: string }> {
  const [links, checkins, redemptions, codes] = await Promise.all([
    client.from('hoyolab_links').select(SERVER_COLUMNS).order('created_at'),
    client.from('hoyolab_checkins').select('link_id,game_biz,ran_at,started_by,status,message,reward').order('ran_at', { ascending: false }).limit(60),
    client.from('hoyolab_redemptions').select('link_id,game_biz,game_uid,code,ran_at,status,message').order('ran_at', { ascending: false }).limit(200),
    client.from('hoyolab_codes').select('game_biz').gte('last_seen', new Date(Date.now() - 3 * 86_400_000).toISOString()),
  ]);
  if (links.error) return { error: 'Your saved accounts couldn’t be loaded. Try again in a minute.' };
  const publicCodes: Record<string, number> = {};
  for (const c of (codes.data ?? []) as { game_biz: string }[]) publicCodes[c.game_biz] = (publicCodes[c.game_biz] ?? 0) + 1;
  return {
    accounts: fromServerRows((links.data ?? []) as ServerRow[], games),
    checkins: (checkins.data ?? []) as CheckinRow[],
    redemptions: (redemptions.data ?? []) as RedemptionRow[],
    publicCodes,
  };
}

export const loadDevice = (): LinkedAccount[] => fromDevice(deviceAccounts());

/** Save a login on the server (new account, or a fresh login for `linkId`). The server checks it with HoYoLAB first. */
export function saveOnServer(client: SupabaseClient, args: { label: string; login: HoyoLogin; gameBiz: string[]; linkId?: string }) {
  return action<{ linkId: string }>(client, { action: 'save', label: args.label, login: args.login, games: args.gameBiz, ...(args.linkId ? { linkId: args.linkId } : {}) });
}

export async function updateAccount(client: SupabaseClient, id: string, change: Partial<{ label: string; auto_checkin: boolean; auto_redeem: boolean }>): Promise<string | null> {
  const { error } = await client.from('hoyolab_links').update(change).eq('id', id);
  return error ? 'That change couldn’t be saved. Try again.' : null;
}

/** Overwrites the saved login(s) in Vault and switches everything off. The row and its results stay. */
export async function forgetOnServer(client: SupabaseClient, id: string): Promise<string | null> {
  const { error } = await client.rpc('hoyolab_link_forget', { p_link: id });
  return error ? 'Forgetting didn’t go through. Try again; until it does, the login stays saved.' : null;
}

export const setRedeemLogin = (client: SupabaseClient, linkId: string, redeem: RedeemLogin | null) => action<{ ok: true }>(client, { action: 'redeem-login', linkId, redeem });

export const runNow = (client: SupabaseClient, linkId?: string) => action<{ checkins: number; redemptions: number; stoppedEarly: boolean }>(client, { action: 'run', ...(linkId ? { linkId } : {}) });

export const addCodes = (client: SupabaseClient, gameBiz: string, codes: string) => action<{ codes: string[] }>(client, { action: 'add-codes', gameBiz, codes });
