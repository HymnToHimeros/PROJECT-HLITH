/**
 * Live stamina for Today: one HoYoLAB read per game that has a linked account
 * (saved on HLITH's server or remembered on this device), kept for a few minutes,
 * then counted forward honestly until the next read.
 *
 * Honest data:
 * - Nothing is shown until HoYoLAB has answered at least once (the last answer is
 *   kept in this browser with its read time, so a reload shows it as "read at …").
 * - Between reads the number is counted forward only with the regeneration rate in
 *   the game's record (StaminaPool.minutesPerPoint), and only while that rate agrees
 *   with HoYoLAB's own "full in" time. Otherwise the value is shown "as of" the read.
 * - An error is shown as the reason HoYoLAB or HLITH gave, never as a number.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameContract, GameId, StaminaPool } from '../../core/contract';
import { backend } from '../../core/data/backend';
import { accountsFor, type LinkedAccount } from './accounts';
import { askHoyolab, hoyolabLink, type HoyoLogin } from './hoyolab';
import { askSkport, skportLink, type SkportLinkedAccount } from './skport';
import { useAccounts } from './useAccounts';

/** One HoYoLAB answer for a game's main stamina pool. */
export interface StaminaReading {
  current: number;
  max: number;
  /** HoYoLAB's own "full in" at the moment of the read. */
  fullInSeconds: number;
  /** ISO time HoYoLAB answered. */
  readAt: string;
}

export type LiveStamina =
  /** No way to read it: device-only copy, signed out with no device login, or no linked account for this game. */
  | { state: 'none' }
  | { state: 'loading'; provider?: 'hoyolab' | 'skport' }
  | { state: 'ok'; reading: StaminaReading; refreshing: boolean; provider?: 'hoyolab' | 'skport' }
  | { state: 'error'; text: string; reading?: StaminaReading; provider?: 'hoyolab' | 'skport' };

/** Re-read when the last answer is older than this. */
export const STAMINA_TTL_MS = 5 * 60_000;
const CACHE_KEY = 'hlith.cache.stamina';

// ── Pure: counting forward ───────────────────────────────────────

export interface ProjectedStamina {
  value: number;
  max: number;
  /** Seconds until full from `now`, or null when it can't be said. */
  fullInSeconds: number | null;
  /** True when the value was counted forward from the read with the game's rate. */
  projected: boolean;
}

/**
 * The value at `now`. Counts forward only when the game record's rate matches
 * HoYoLAB's own "full in" (within one point's time); else returns the read as is.
 * Above the cap (stamina can overflow) nothing regenerates.
 */
export function projectStamina(r: StaminaReading, pool: Pick<StaminaPool, 'minutesPerPoint'> | undefined, now: number): ProjectedStamina {
  const readMs = Date.parse(r.readAt);
  const elapsed = Number.isFinite(readMs) ? Math.max(0, (now - readMs) / 1000) : 0;
  if (r.current >= r.max) return { value: r.current, max: r.max, fullInSeconds: 0, projected: false };
  const remaining = Math.max(0, r.fullInSeconds - elapsed);
  const perPoint = pool && pool.minutesPerPoint > 0 ? pool.minutesPerPoint * 60 : null;
  const missing = r.max - r.current;
  // The record's rate must agree with HoYoLAB's own count: (missing points) × rate ≈ full in.
  const agrees = perPoint !== null && r.fullInSeconds > 0 && Math.abs(missing * perPoint - r.fullInSeconds) <= perPoint;
  if (!agrees || perPoint === null) {
    return { value: r.current, max: r.max, fullInSeconds: r.fullInSeconds > 0 ? remaining : null, projected: false };
  }
  const value = remaining <= 0 ? r.max : Math.min(r.max, Math.max(r.current, r.max - Math.ceil(remaining / perPoint)));
  return { value, max: r.max, fullInSeconds: remaining, projected: elapsed >= 1 };
}

const two = (n: number) => String(n).padStart(2, '0');
/** "14:02" in the player's own time. */
export const clock = (iso: string) => {
  const d = new Date(iso);
  return `${two(d.getHours())}:${two(d.getMinutes())}`;
};

/** "Full in 5 h 47 min" style, from seconds. */
export function fullInText(seconds: number | null): string | null {
  if (seconds === null) return null;
  if (seconds <= 0) return 'Full now';
  const h = Math.floor(seconds / 3600);
  const m = Math.ceil((seconds % 3600) / 60);
  if (m === 60) return `Full in ${h + 1} h 00 min`;
  return h ? `Full in ${h} h ${two(m)} min` : `Full in ${m} min`;
}

// ── Cache (memory + this browser) ────────────────────────────────

const memory = new Map<string, StaminaReading>();

const cacheId = (gameId: GameId, account: LinkedAccount) => `${gameId}:${account.where}:${account.hoyolabId}`;

function readCache(): Record<string, StaminaReading> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const o: unknown = raw ? JSON.parse(raw) : {};
    return o && typeof o === 'object' ? (o as Record<string, StaminaReading>) : {};
  } catch {
    return {};
  }
}

const isReading = (r: unknown): r is StaminaReading =>
  !!r && typeof r === 'object' && ['current', 'max', 'fullInSeconds'].every((k) => typeof (r as Record<string, unknown>)[k] === 'number') && typeof (r as StaminaReading).readAt === 'string';

export function cachedReading(id: string): StaminaReading | null {
  const m = memory.get(id);
  if (m) return m;
  const c = readCache()[id];
  return isReading(c) ? c : null;
}

export function saveReading(id: string, r: StaminaReading): void {
  memory.set(id, r);
  try {
    const all = readCache();
    all[id] = r;
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch {
    /* storage blocked: memory only */
  }
}

/** Tests only. */
export function clearStaminaCache(): void {
  memory.clear();
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

// ── The hook ─────────────────────────────────────────────────────

export interface StaminaSource {
  game: GameContract;
  provider: 'hoyolab' | 'skport';
  account: LinkedAccount;
  skportAccount?: SkportLinkedAccount;
  uid: string | undefined;
}

/** Which linked account reads each game's stamina: the first that covers it. */
export function staminaSources(games: GameContract[], accounts: LinkedAccount[], skportAccounts: SkportLinkedAccount[] = []): StaminaSource[] {
  return games.flatMap((game): StaminaSource[] => {
    if (!game.stamina[0]) return [];
    // SKPort (Endfield)
    const sp = skportLink(game);
    if (sp?.supports.includes('stamina')) {
      const sa = skportAccounts.find((a) => a.gameId === game.id && (a.where === 'server' || a.token));
      if (sa) return [{ game, provider: 'skport', account: { id: sa.id, label: sa.label, where: sa.where, hoyolabId: sa.skportUid, games: [{ gameId: game.id }], autoCheckin: sa.autoCheckin, autoRedeem: false, hasRedeemLogin: false }, skportAccount: sa, uid: sa.skportUid }];
    }
    // HoYoLAB
    const link = hoyolabLink(game);
    if (!link?.supports.includes('stamina')) return [];
    const account = accountsFor(accounts, game.id).find((a) => a.where === 'server' || a.login);
    return account ? [{ game, provider: 'hoyolab', account, uid: account.games.find((g) => g.gameId === game.id)?.uid }] : [];
  });
}

/** A fresh HoYoLAB answer: the reading before it (if any), the new one, and the daily activity. */
export type OnReading = (game: GameContract, previous: StaminaReading | null, next: StaminaReading, dailies: { current: number; max: number } | null | undefined) => void;

/** Live stamina per game id, plus a way to read one game again now. `onReading` hears every fresh answer. */
export function useLiveStamina(games: GameContract[], onReading?: OnReading): { stamina: Record<GameId, LiveStamina>; retry: (gameId: GameId) => void } {
  const { accounts, blocker, signedIn, server, loadError } = useAccounts(games);
  // Signed in: wait for the server's list, so a device login isn't read first and then replaced.
  const pending = !blocker && signedIn && !server && !loadError;
  const skportAccounts = useMemo(() => server?.skportAccounts ?? [], [server]);
  const sources = useMemo(() => (blocker || pending ? [] : staminaSources(games, accounts, skportAccounts)), [games, accounts, skportAccounts, blocker, pending]);
  const [state, setState] = useState<Record<GameId, LiveStamina>>({});
  const inFlight = useRef(new Set<string>());
  const hear = useRef(onReading);
  useEffect(() => {
    hear.current = onReading;
  }, [onReading]);

  const read = useCallback(async (src: ReturnType<typeof staminaSources>[number], force: boolean) => {
    if (!backend) return;
    const id = cacheId(src.game.id, src.account);
    const cached = cachedReading(id);
    if (!force && cached && Date.now() - Date.parse(cached.readAt) < STAMINA_TTL_MS) {
      setState((s) => ({ ...s, [src.game.id]: { state: 'ok', reading: cached, refreshing: false } }));
      return;
    }
    if (inFlight.current.has(id)) return;
    inFlight.current.add(id);
    const prov = src.provider;
    setState((s) => ({ ...s, [src.game.id]: cached ? { state: 'ok', reading: cached, refreshing: true, provider: prov } : { state: 'loading', provider: prov } }));
    let next: LiveStamina;
    if (prov === 'skport') {
      const sa = src.skportAccount;
      const args = sa?.where === 'server' ? { linkId: sa.id, want: ['stamina' as const] } : { accountToken: sa?.token ?? '', want: ['stamina' as const] };
      const res = await askSkport(backend, args);
      inFlight.current.delete(id);
      if (!res.ok) next = { state: 'error', text: res.text, provider: prov, ...(cached ? { reading: cached } : {}) };
      else if (res.answer.stamina) {
        const reading: StaminaReading = { ...res.answer.stamina, readAt: res.answer.readAt };
        saveReading(id, reading);
        hear.current?.(src.game, cached, reading, undefined);
        next = { state: 'ok', reading, refreshing: false, provider: prov };
      } else next = { state: 'error', text: res.answer.problems.stamina?.text ?? 'SKPort answered without a stamina value.', provider: prov, ...(cached ? { reading: cached } : {}) };
    } else {
      const base = { uid: src.uid, want: ['stamina' as const] };
      const res = await askHoyolab(backend, src.game, src.account.where === 'server' ? { linkId: src.account.id, ...base } : { login: src.account.login as HoyoLogin, ...base });
      inFlight.current.delete(id);
      if (!res.ok) next = { state: 'error', text: res.text, provider: prov, ...(cached ? { reading: cached } : {}) };
      else if (res.answer.stamina) {
        const reading: StaminaReading = { ...res.answer.stamina, readAt: res.answer.readAt };
        saveReading(id, reading);
        hear.current?.(src.game, cached, reading, res.answer.dailies);
        next = { state: 'ok', reading, refreshing: false, provider: prov };
      } else next = { state: 'error', text: res.answer.problems.stamina?.text ?? 'HoYoLAB answered without a stamina value.', provider: prov, ...(cached ? { reading: cached } : {}) };
    }
    setState((s) => ({ ...s, [src.game.id]: next }));
  }, []);

  // Read once on open (or use a fresh cached answer), and again when the answer gets old.
  const key = sources.map((s) => cacheId(s.game.id, s.account)).join('|');
  useEffect(() => {
    const readAll = () => {
      for (const src of sources) void read(src, false);
    };
    const first = setTimeout(readAll, 0);
    const t = setInterval(readAll, STAMINA_TTL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, read]);

  const retry = useCallback(
    (gameId: GameId) => {
      const src = sources.find((s) => s.game.id === gameId);
      if (src) void read(src, true);
    },
    [sources, read],
  );

  const stamina: Record<GameId, LiveStamina> = {};
  for (const g of games) {
    const src = sources.find((s) => s.game.id === g.id);
    // Before the first read finishes, a kept answer is shown with its read time.
    const kept = src ? cachedReading(cacheId(g.id, src.account)) : null;
    const hasStaminaLink = hoyolabLink(g)?.supports.includes('stamina') || skportLink(g)?.supports.includes('stamina');
    stamina[g.id] = src ? (state[g.id] ?? (kept ? { state: 'ok', reading: kept, refreshing: false, provider: src.provider } : { state: 'loading', provider: src.provider })) : pending && hasStaminaLink ? { state: 'loading' } : { state: 'none' };
  }
  return { stamina, retry };
}
