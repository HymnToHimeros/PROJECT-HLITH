/**
 * Your own game data, per game: bank log, imported pulls, event and backlog
 * progress, roster, farm targets, teams and today's ticks. Kept on this
 * device for now (mirrored to the account's bank_ledger and pulls tables next).
 * Append-only: entries and pulls are never edited or removed, only added.
 */
import { useSyncExternalStore } from 'react';
import type { GameId, PullRecord } from '../contract';
import { known, unknown, type Known } from '../contract/known';
import { mergeAdd } from './merge';

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
  /** Event id → your state and claimed login days. Missing = open, nothing claimed. */
  events: Record<string, EventProgress>;
  /** Backlog item id → how many done. */
  backlog: Record<string, number>;
  /** Backlog categories whose rewards you don't count toward pulls. */
  backlogOff: string[];
  /** Character id → owned / wanted / dupes. */
  roster: Record<string, RosterEntry>;
  /** Characters you're farming for, in order. */
  farm: string[];
  /** Your own teams. */
  teams: UserTeam[];
  /** Task id → when you ticked it (Today). A tick counts until the next reset. */
  ticks: Record<string, string>;
}

export interface EventProgress {
  state: 'open' | 'done' | 'skipped';
  daysClaimed?: number;
}
export interface RosterEntry {
  owned: boolean;
  wanted: boolean;
  dupes: number;
}
export interface UserTeam {
  id: string;
  name: string;
  members: string[];
}

interface Store {
  version: 1;
  games: Record<GameId, GameUserData>;
}

const KEY = 'hlith.userdata';
export const EMPTY_GAME: GameUserData = {
  ledger: [],
  pulls: [],
  passes: {},
  paidExtras: false,
  events: {},
  backlog: {},
  backlogOff: [],
  roster: {},
  farm: [],
  teams: [],
  ticks: {},
};

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

const cache = new Map<GameId, { raw: GameUserData | undefined; full: GameUserData }>();

/** Your data for one game. Fields added in later versions start empty; nothing stored is dropped. */
export function gameData(id: GameId): GameUserData {
  const raw = store.games[id];
  const hit = cache.get(id);
  if (hit && hit.raw === raw) return hit.full;
  const full = raw ? { ...EMPTY_GAME, ...raw } : EMPTY_GAME;
  cache.set(id, { raw, full });
  return full;
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

export function setEventProgress(game: GameId, eventId: string, progress: EventProgress): void {
  update(game, (g) => ({ ...g, events: { ...g.events, [eventId]: progress } }));
}

export function setBacklogDone(game: GameId, itemId: string, done: number): void {
  update(game, (g) => ({ ...g, backlog: { ...g.backlog, [itemId]: Math.max(0, done) } }));
}

export function setBacklogCategory(game: GameId, category: string, counted: boolean): void {
  update(game, (g) => ({ ...g, backlogOff: counted ? g.backlogOff.filter((c) => c !== category) : [...new Set([...g.backlogOff, category])] }));
}

export function setRosterEntry(game: GameId, characterId: string, entry: RosterEntry): void {
  update(game, (g) => ({ ...g, roster: { ...g.roster, [characterId]: entry } }));
}

export function setFarm(game: GameId, characterIds: string[]): void {
  update(game, (g) => ({ ...g, farm: [...new Set(characterIds)] }));
}

/** Add or change one of your teams (teams are never removed by list updates). */
export function saveTeam(game: GameId, team: UserTeam): void {
  update(game, (g) => ({ ...g, teams: [...g.teams.filter((t) => t.id !== team.id), team] }));
}

export function setTick(game: GameId, taskId: string, at: string | null): void {
  update(game, (g) => {
    const rest = Object.fromEntries(Object.entries(g.ticks).filter(([k]) => k !== taskId));
    return { ...g, ticks: at ? { ...rest, [taskId]: at } : rest };
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

/** Everything stored, exactly as saved (Account → Backup → Export my data). */
export function allUserData(): { version: 1; games: Record<GameId, GameUserData> } {
  return store;
}

/**
 * Restore from a backup: adds what's missing, never removes or overwrites
 * (see merge.ts). Returns how many items were added.
 */
export function mergeIntoUserData(games: Record<GameId, unknown>): number {
  const count = { added: 0 };
  let next = store.games;
  for (const [id, incoming] of Object.entries(games)) {
    if (typeof incoming !== 'object' || incoming === null || Array.isArray(incoming)) continue;
    const merged = mergeAdd(store.games[id] ?? ({} as GameUserData), incoming, count);
    if (merged !== store.games[id]) next = { ...next, [id]: merged };
  }
  if (next !== store.games) {
    store = { ...store, games: next };
    save();
  }
  return count.added;
}

/** Test helper. */
export function resetUserData(): void {
  store = { version: 1, games: {} };
  cache.clear();
  listeners.forEach((l) => l());
}
