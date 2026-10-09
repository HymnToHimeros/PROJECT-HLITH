/**
 * Your own game data: bank log and imported pulls, per game. Kept on this
 * device for now (mirrored to the account's bank_ledger and pulls tables next).
 * Append-only: entries and pulls are never edited or removed, only added.
 */
import { useSyncExternalStore } from 'react';
import type { GameId, PullRecord } from '../contract';
import { known, unknown, type Known } from '../contract/known';

export interface LedgerEntry {
  id: string;
  at: string; // ISO
  currency: string;
  kind: 'have' | 'earned' | 'bought' | 'spent';
  /** 'have': the balance you saw. Others: the amount that changed (always positive). */
  amount: number;
  note?: string;
}

export interface GameUserData {
  ledger: LedgerEntry[];
  pulls: PullRecord[];
  /** Income row id → when that pass runs out. */
  passes: Record<string, string>;
  paidExtras: boolean;
}

interface Store {
  version: 1;
  games: Record<GameId, GameUserData>;
}

const KEY = 'hlith.userdata';
export const EMPTY_GAME: GameUserData = { ledger: [], pulls: [], passes: {}, paidExtras: false };

let unreadable = false;

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { version: 1, games: {}, ...(JSON.parse(raw) as Partial<Store>) };
  } catch {
    // Unreadable: work in memory and never overwrite the stored copy.
    unreadable = true;
  }
  return { version: 1, games: {} };
}

let store: Store = typeof localStorage === 'undefined' ? { version: 1, games: {} } : read();
const listeners = new Set<() => void>();

function save(): void {
  if (unreadable) {
    listeners.forEach((l) => l());
    return; // keep the old copy untouched
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* storage full or private mode: keep working in memory */
  }
  listeners.forEach((l) => l());
}

export function gameData(id: GameId): GameUserData {
  return store.games[id] ?? EMPTY_GAME;
}

function update(id: GameId, change: (g: GameUserData) => GameUserData): void {
  store = { ...store, games: { ...store.games, [id]: change(gameData(id)) } };
  save();
}

export function addLedgerEntry(game: GameId, entry: Omit<LedgerEntry, 'id'>): void {
  const id = `${Date.parse(entry.at)}-${Math.random().toString(36).slice(2, 8)}`;
  update(game, (g) => ({ ...g, ledger: [...g.ledger, { ...entry, id }] }));
}

/** Add pulls; ones already stored (same game pull id) are ignored. Returns how many were new. */
export function addPulls(game: GameId, incoming: PullRecord[]): number {
  let added = 0;
  update(game, (g) => {
    const seen = new Set(g.pulls.map((p) => p.id));
    const fresh = incoming.filter((p) => !seen.has(p.id));
    added = fresh.length;
    return { ...g, pulls: [...g.pulls, ...fresh].sort((a, b) => a.time.localeCompare(b.time) || a.id.length - b.id.length || a.id.localeCompare(b.id)) };
  });
  return added;
}

export function setPaidExtras(game: GameId, on: boolean): void {
  update(game, (g) => ({ ...g, paidExtras: on }));
}

export function setPass(game: GameId, rowId: string, until: string | null): void {
  update(game, (g) => {
    const rest = Object.fromEntries(Object.entries(g.passes).filter(([k]) => k !== rowId));
    return { ...g, passes: until ? { ...rest, [rowId]: until } : rest };
  });
}

export function useGameData(id: GameId): GameUserData {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => gameData(id),
    () => gameData(id),
  );
}

/**
 * Balances from the bank log: the latest "have" per currency plus changes
 * logged after it. A currency with no "have" entry is unknown.
 */
export function balances(ledger: LedgerEntry[]): Known<Record<string, number>> {
  const sorted = [...ledger].sort((a, b) => a.at.localeCompare(b.at));
  const out: Record<string, number> = {};
  let latest = '';
  for (const e of sorted) {
    if (e.kind === 'have') {
      out[e.currency] = e.amount;
    } else if (e.currency in out) {
      out[e.currency] = (out[e.currency] ?? 0) + (e.kind === 'spent' ? -e.amount : e.amount);
    } else continue;
    latest = e.at;
  }
  return Object.keys(out).length ? known(out, 'user', latest) : unknown('enter-manually');
}

/** Test helper. */
export function resetUserData(): void {
  store = { version: 1, games: {} };
  listeners.forEach((l) => l());
}
