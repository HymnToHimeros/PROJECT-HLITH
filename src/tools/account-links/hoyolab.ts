/**
 * The app side of the HoYoLAB link: reading the login values a player pastes,
 * keeping them on this device only when the player asks, and calling the
 * hoyolab server function (supabase/functions/hoyolab).
 *
 * Three ways to keep a login, chosen by the player:
 * - Use once (default): the values live only in the form until the request is sent.
 * - Remember on this device: kept in this browser under hlith.secret.hoyolab.accounts,
 *   never synced, never part of a backup (backups skip every hlith.secret.* key).
 * - Save on HLITH's server: encrypted in Supabase Vault, needed for the automatic
 *   check-in and codes (accounts.ts, migration 0003).
 * "Forget" deletes the device copy, or overwrites the server copy.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AccountLink, GameContract } from '../../core/contract';

export interface HoyoLogin {
  ltuid_v2: string;
  ltoken_v2: string;
  ltmid_v2?: string;
}

/**
 * Pull the values out of whatever was pasted: "name=value" pairs (a cookie line),
 * or just the bare values in any order (V1 accepted both).
 * ltuid_v2 = digits · ltoken_v2 = starts with v2_ · ltmid_v2 = ends with _hy.
 */
export function readLogin(text: string): { ok: true; login: HoyoLogin } | { ok: false; missing: ('ltuid_v2' | 'ltoken_v2')[] } {
  const found: Partial<HoyoLogin> = {};
  for (const part of text.split(/[;\n]/)) {
    const m = part.trim().match(/^(ltuid_v2|ltoken_v2|ltmid_v2)\s*[=:\t ]\s*"?([^"\s;]+)"?/);
    if (m?.[1] && m[2]) found[m[1] as keyof HoyoLogin] = m[2];
  }
  for (const token of text.split(/[\s;,]+/)) {
    const v = token.trim().replace(/^"|"$/g, '');
    if (!v || v.includes('=')) continue;
    if (!found.ltoken_v2 && /^v2_[\w\-.=+/]{10,600}$/.test(v)) found.ltoken_v2 = v;
    else if (!found.ltuid_v2 && /^\d{4,15}$/.test(v)) found.ltuid_v2 = v;
    else if (!found.ltmid_v2 && /^[0-9a-z]{4,30}_hy$/i.test(v)) found.ltmid_v2 = v;
  }
  const missing = (['ltuid_v2', 'ltoken_v2'] as const).filter((k) => !found[k]);
  if (missing.length || !found.ltuid_v2 || !found.ltoken_v2) return { ok: false, missing: [...missing] };
  return { ok: true, login: { ltuid_v2: found.ltuid_v2, ltoken_v2: found.ltoken_v2, ...(found.ltmid_v2 ? { ltmid_v2: found.ltmid_v2 } : {}) } };
}

// ── Remember on this device (opt-in) ─────────────────────────────
// One list of logins kept in this browser, each with a label and the games it was
// used for. Older copies of HLITH kept one login per game under KEY_V1; those are
// still read (shown as accounts) and only removed by Forget, never silently.

const KEY_V1 = 'hlith.secret.hoyolab';
const KEY = 'hlith.secret.hoyolab.accounts';

interface SavedV1 {
  login: HoyoLogin;
  uid?: string;
  savedAt: string;
}
export interface DeviceAccount {
  id: string;
  label: string;
  login: HoyoLogin;
  /** HLITH game ids this login was used for, with the UID when one was picked. */
  games: { gameId: string; uid?: string }[];
  savedAt: string;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown, empty: boolean): void {
  try {
    if (empty) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked: stays "use once" */
  }
}

/** Every login remembered on this device: the list, plus older per-game copies grouped by login. */
export function deviceAccounts(): DeviceAccount[] {
  const list = readJson<DeviceAccount[]>(KEY, []).filter((a) => a && a.login && Array.isArray(a.games));
  const legacy = readJson<Record<string, SavedV1>>(KEY_V1, {});
  const byLogin = new Map<string, DeviceAccount>();
  for (const [gameId, saved] of Object.entries(legacy)) {
    if (!saved?.login?.ltuid_v2) continue;
    const known = list.find((a) => a.login.ltuid_v2 === saved.login.ltuid_v2);
    const target = known ?? byLogin.get(saved.login.ltuid_v2);
    const game = { gameId, ...(saved.uid ? { uid: saved.uid } : {}) };
    if (target) {
      if (!target.games.some((g) => g.gameId === gameId)) target.games.push(game);
      continue;
    }
    byLogin.set(saved.login.ltuid_v2, { id: `v1:${saved.login.ltuid_v2}`, label: 'Saved login', login: saved.login, games: [game], savedAt: saved.savedAt });
  }
  return [...list, ...byLogin.values()];
}

/** Add or update a remembered login. Same login (ltuid_v2) = same account. */
export function saveDeviceAccount(input: { label: string; login: HoyoLogin; games: { gameId: string; uid?: string }[] }): DeviceAccount {
  const list = readJson<DeviceAccount[]>(KEY, []);
  const i = list.findIndex((a) => a.login.ltuid_v2 === input.login.ltuid_v2);
  const before = list[i];
  const games = [...(before?.games ?? [])];
  for (const g of input.games) {
    const at = games.findIndex((x) => x.gameId === g.gameId);
    if (at >= 0) games[at] = { ...games[at], ...g };
    else games.push(g);
  }
  const next: DeviceAccount = { id: before?.id ?? `d:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, label: input.label || before?.label || 'Main', login: input.login, games, savedAt: new Date().toISOString() };
  if (before) list[i] = next;
  else list.push(next);
  writeJson(KEY, list, false);
  return next;
}

/** Delete a remembered login from this browser (both the list and any older copy). */
export function forgetDeviceAccount(id: string): void {
  const all = deviceAccounts();
  const target = all.find((a) => a.id === id);
  if (!target) return;
  const list = readJson<DeviceAccount[]>(KEY, []).filter((a) => a.id !== id && a.login.ltuid_v2 !== target.login.ltuid_v2);
  writeJson(KEY, list, list.length === 0);
  const legacy = Object.fromEntries(Object.entries(readJson<Record<string, SavedV1>>(KEY_V1, {})).filter(([, v]) => v?.login?.ltuid_v2 !== target.login.ltuid_v2));
  writeJson(KEY_V1, legacy, Object.keys(legacy).length === 0);
}

/** The first login remembered on this device that was used for this game (Setup checklist, older callers). */
export function savedLogin(gameId: string): SavedV1 | null {
  const a = deviceAccounts().find((x) => x.games.some((g) => g.gameId === gameId));
  if (!a) return null;
  const uid = a.games.find((g) => g.gameId === gameId)?.uid;
  return { login: a.login, ...(uid ? { uid } : {}), savedAt: a.savedAt };
}

export function rememberLogin(gameId: string, login: HoyoLogin, uid?: string): void {
  const same = deviceAccounts().find((a) => a.login.ltuid_v2 === login.ltuid_v2);
  saveDeviceAccount({ label: same?.label ?? 'Main', login, games: [{ gameId, ...(uid ? { uid } : {}) }] });
}

/** Forget every remembered login used for this game. */
export function forgetLogin(gameId: string): void {
  for (const a of deviceAccounts()) if (a.games.some((g) => g.gameId === gameId)) forgetDeviceAccount(a.id);
}

// ── Talking to the server function ───────────────────────────────

export type Part = 'account' | 'stamina' | 'checkin' | 'roster' | 'endgame';

export interface HoyoAccount {
  uid: string;
  nickname: string;
  level: number | null;
  server: string;
}
export interface HoyoCharacter {
  id: string;
  name: string;
  level: number | null;
  dupes: number;
  weapon: { name: string; level: number | null } | null;
}
export interface HoyoEndgame {
  mode: string;
  label: string;
  season: 'current' | 'previous';
  hasData: boolean;
  stars?: number;
  score?: number;
  maxScore?: number;
  floor?: string;
  battles?: number;
}
export interface HoyoAnswer {
  account: HoyoAccount;
  readAt: string;
  stamina?: { current: number; max: number; fullInSeconds: number } | null;
  dailies?: { current: number; max: number } | null;
  checkin?: { checkedInToday: boolean; daysThisMonth: number | null; claimedNow: boolean; reward?: string };
  roster?: HoyoCharacter[];
  endgame?: HoyoEndgame[];
  problems: Partial<Record<Part, { code: string; text: string }>>;
}

export type HoyoResult = { ok: true; answer: HoyoAnswer } | { ok: false; text: string; accounts?: HoyoAccount[] };

/** This game's HoYoLAB link from its record, or null when it has none. */
export const hoyolabLink = (game: GameContract): AccountLink | null => game.accountLinks?.find((l) => l.provider === 'hoyolab' && l.config.gameBiz) ?? null;

export async function askHoyolab(
  client: SupabaseClient,
  game: GameContract,
  args: { login: HoyoLogin; uid?: string | undefined; want: Part[]; claim?: boolean } | { linkId: string; uid?: string | undefined; want: Part[]; claim?: boolean },
): Promise<HoyoResult> {
  const link = hoyolabLink(game);
  if (!link) return { ok: false, text: 'This game has no HoYoLAB link.' };
  // A saved account is named by its id: the server reads its login from Vault.
  const who = 'linkId' in args ? { linkId: args.linkId } : { login: args.login };
  const { data, error } = await client.functions.invoke<HoyoAnswer>('hoyolab', {
    body: { gameBiz: link.config.gameBiz, ...who, ...(args.uid ? { uid: args.uid } : {}), want: args.want, claim: args.claim === true },
  });
  if (error || !data) {
    const body: unknown = error && 'context' in error && error.context instanceof Response ? await error.context.json().catch(() => null) : null;
    const o = body && typeof body === 'object' ? (body as { error?: unknown; accounts?: unknown }) : {};
    const text = typeof o.error === 'string' ? o.error : 'HoYoLAB couldn’t be reached. Try again in a minute.';
    return Array.isArray(o.accounts) ? { ok: false, text, accounts: o.accounts as HoyoAccount[] } : { ok: false, text };
  }
  return { ok: true, answer: data };
}

/** "2 h 05 min" until stamina is full, from seconds. */
export function fullIn(seconds: number): string {
  if (seconds <= 0) return 'Full now';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h ? `Full in ${h} h ${String(m).padStart(2, '0')} min` : `Full in ${m} min`;
}
