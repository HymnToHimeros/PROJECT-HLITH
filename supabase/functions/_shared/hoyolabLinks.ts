/**
 * Saved HoYoLAB accounts: what the hoyolab server function accepts besides a plain
 * reading, and how a new login becomes a saved account. Pure, so the tests can
 * check it without a server.
 */
import { checkLogin, type FoundAccount, type GameBiz, type Login } from './hoyolab.ts';
import { checkRedeemLogin, readCodes, type RedeemLogin } from './hoyolabAuto.ts';

const GAME_BIZ: GameBiz[] = ['hkrpg_global', 'nap_global'];
const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export type Action =
  /** Save a new login on the server, or replace the login of saved account `linkId`. */
  | { action: 'save'; linkId: string | null; label: string; login: Login; games: GameBiz[] }
  /** Add / replace (redeem set) or clear (redeem null) the separate code login. */
  | { action: 'redeem-login'; linkId: string; redeem: RedeemLogin | null }
  /** Check in and try codes now for the caller's saved accounts (or just one). */
  | { action: 'run'; linkId: string | null; checkin: boolean; redeem: boolean }
  /** Pasted codes, kept for the caller's saved accounts. */
  | { action: 'add-codes'; gameBiz: GameBiz; codes: string[] };

export type ActionError = 'bad-request' | 'bad-login' | 'bad-redeem-login' | 'no-codes';

export const ACTION_ERROR_TEXT: Record<ActionError, string> = {
  'bad-request': 'HLITH sent something the server didn’t understand. Reload the page and try again.',
  'bad-login': 'Send both login values: ltuid_v2 (a number) and ltoken_v2 (starts with v2_).',
  'bad-redeem-login': 'Send all three code login values: account_id_v2 (a number), account_mid_v2 (ends in _hy) and cookie_token_v2 (starts with v2_).',
  'no-codes': 'No codes found. Codes are letters and digits, e.g. STARRAILGIFT.',
};

/** null = not an action (a plain reading, handled by parseRequest). */
export function parseAction(body: unknown): { ok: true; action: Action } | { ok: false; error: ActionError } | null {
  const o = obj(body);
  if (typeof o.action !== 'string') return null;
  const linkId = isUuid(o.linkId) ? o.linkId : null;
  if (o.linkId !== undefined && o.linkId !== null && !linkId) return { ok: false, error: 'bad-request' };
  switch (o.action) {
    case 'save': {
      const login = checkLogin(o.login);
      if (!login) return { ok: false, error: 'bad-login' };
      const games = Array.isArray(o.games) ? GAME_BIZ.filter((g) => (o.games as unknown[]).includes(g)) : [];
      if (!games.length) return { ok: false, error: 'bad-request' };
      return { ok: true, action: { action: 'save', linkId, label: cleanLabel(o.label), login, games } };
    }
    case 'redeem-login': {
      if (!linkId) return { ok: false, error: 'bad-request' };
      if (o.redeem === null) return { ok: true, action: { action: 'redeem-login', linkId, redeem: null } };
      const redeem = checkRedeemLogin(o.redeem);
      return redeem ? { ok: true, action: { action: 'redeem-login', linkId, redeem } } : { ok: false, error: 'bad-redeem-login' };
    }
    case 'run':
      return { ok: true, action: { action: 'run', linkId, checkin: o.checkin !== false, redeem: o.redeem !== false } };
    case 'add-codes': {
      const gameBiz = GAME_BIZ.find((g) => g === o.gameBiz);
      if (!gameBiz) return { ok: false, error: 'bad-request' };
      const codes = typeof o.codes === 'string' ? readCodes(o.codes).slice(0, 30) : [];
      return codes.length ? { ok: true, action: { action: 'add-codes', gameBiz, codes } } : { ok: false, error: 'no-codes' };
    }
    default:
      return { ok: false, error: 'bad-request' };
  }
}

/** 1–40 visible characters; empty becomes "Main". */
export function cleanLabel(raw: unknown): string {
  // Line breaks and tabs become spaces; other control characters are dropped.
  const visible = typeof raw === 'string' ? [...raw.replace(/\s+/g, ' ')].filter((ch) => ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) !== 127).join('') : '';
  const s = visible.replace(/\s+/g, ' ').trim().slice(0, 40);
  return s || 'Main';
}

/** What a saved account covers: one entry per game account found on the login. */
export interface StoredGame {
  gameBiz: GameBiz;
  uid: string;
  region: string;
  nickname: string;
  server: string;
  level: number | null;
}

export function storedGames(found: Partial<Record<GameBiz, FoundAccount[]>>): StoredGame[] {
  return GAME_BIZ.flatMap((gameBiz) => (found[gameBiz] ?? []).map((f) => ({ gameBiz, uid: f.account.uid, region: f.region, nickname: f.account.nickname, server: f.account.server, level: f.account.level })));
}
