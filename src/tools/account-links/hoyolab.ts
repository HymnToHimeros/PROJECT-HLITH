/**
 * The app side of the HoYoLAB link: reading the login values a player pastes,
 * keeping them on this device only when the player asks, and calling the
 * hoyolab server function (supabase/functions/hoyolab).
 *
 * Default is "use once": the values live only in the form until the request is
 * sent, then they are cleared. "Remember on this device" stores them in this
 * browser under hlith.secret.hoyolab: never synced, never part of a backup
 * (backups must skip every hlith.secret.* key), deleted by "Forget".
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

const KEY = 'hlith.secret.hoyolab';
interface Saved {
  login: HoyoLogin;
  uid?: string;
  savedAt: string;
}

function readAll(): Record<string, Saved> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, Saved>) : {};
  } catch {
    return {};
  }
}

export function savedLogin(gameId: string): Saved | null {
  return readAll()[gameId] ?? null;
}

export function rememberLogin(gameId: string, login: HoyoLogin, uid?: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [gameId]: { login, ...(uid ? { uid } : {}), savedAt: new Date().toISOString() } }));
  } catch {
    /* storage blocked: stays "use once" */
  }
}

export function forgetLogin(gameId: string): void {
  try {
    const rest = Object.fromEntries(Object.entries(readAll()).filter(([k]) => k !== gameId));
    if (Object.keys(rest).length) localStorage.setItem(KEY, JSON.stringify(rest));
    else localStorage.removeItem(KEY);
  } catch {
    /* nothing stored */
  }
}

/** Other games that have a login remembered on this device (for "use the same login"). */
export function otherSaved(gameId: string): string[] {
  return Object.keys(readAll()).filter((k) => k !== gameId);
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
  checkin?: { checkedInToday: boolean; daysThisMonth: number | null; claimedNow: boolean };
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
  args: { login: HoyoLogin; uid?: string | undefined; want: Part[]; claim?: boolean },
): Promise<HoyoResult> {
  const link = hoyolabLink(game);
  if (!link) return { ok: false, text: 'This game has no HoYoLAB link.' };
  const { data, error } = await client.functions.invoke<HoyoAnswer>('hoyolab', {
    body: { gameBiz: link.config.gameBiz, login: args.login, ...(args.uid ? { uid: args.uid } : {}), want: args.want, claim: args.claim === true },
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
