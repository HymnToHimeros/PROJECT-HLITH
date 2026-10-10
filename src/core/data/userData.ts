/**
 * Your own game data, per game: bank log, imported pulls, event and backlog
 * progress, roster, farm targets, teams and today's ticks. Kept on this
 * device for now (mirrored to the account's bank_ledger and pulls tables next).
 * Append-only: entries and pulls are never edited or removed, only added.
 */
import { useSyncExternalStore } from 'react';
import type { BacklogItem, Banner, GameEvent, GameId, PullRecord } from '../contract';
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
  /**
   * This entry cancels an earlier one (by id): both are then left out of the
   * balance. How an undo works without ever removing an entry.
   */
  reverses?: string;
}

export interface GameUserData {
  ledger: LedgerEntry[];
  pulls: PullRecord[];
  /** Income row id → when that pass runs out. */
  passes: Record<string, string>;
  paidExtras: boolean;
  /** Paid rows switched off one by one (income row ids). Missing = none. */
  paidOff?: string[];
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
  /** Edit mode: your own events, banners and backlog items, and your changes and hides on built-in ones. */
  ownItems: OwnItems;
  /** Your own plans (Calendar), including Assistant proposals you approved. Undone plans stay, marked undone. */
  plans: UserPlan[];
  /** Every change the Assistant made with your approval, with the value before, for Undo. Never removed. */
  assistantActions: AssistantAction[];
  /**
   * Pity you entered yourself, per banner type (for players who can't import history).
   * A history import takes over once it knows the state. Missing = not entered.
   */
  pityManual?: Record<string, { pity: number; guaranteed: boolean; at: string }>;
}

/** The lists Edit mode can add to, change and hide in. */
export interface OwnItemTypes {
  events: GameEvent;
  banners: Banner;
  backlog: BacklogItem;
}
export type OwnKind = keyof OwnItemTypes;
export const OWN_KINDS: OwnKind[] = ['events', 'banners', 'backlog'];

/**
 * One Edit mode entry. `mine: true` is an item you added (all its fields are
 * yours); `mine: false` is your change to a built-in item with the same id
 * (only the fields you changed). `hidden` hides it from the list; nothing is
 * ever deleted, so it can always be shown again.
 */
export interface OwnItemEdit<T> {
  id: string;
  mine: boolean;
  fields: Partial<T>;
  hidden: boolean;
  /** When you last changed it (ISO). */
  at: string;
}
export type OwnItems = { [K in OwnKind]: Record<string, OwnItemEdit<OwnItemTypes[K]>> };

export interface UserPlan {
  id: string;
  title: string;
  /** ISO date-time the plan is for. */
  start: string;
  end?: string;
  note?: string;
  /** A route: stops in order, each with its own small steps. */
  steps?: { title: string; minutes?: number; items?: string[] }[];
  source: 'user' | 'assistant';
  status: 'active' | 'undone';
  at: string;
}

export interface AssistantAction {
  /** The Assistant's proposal id (one action per proposal). */
  id: string;
  at: string;
  tool: string;
  /** One line in plain words: what changed. */
  summary: string;
  input: unknown;
  /** What was there before, so Undo can put it back (or the ledger entry to cancel). */
  before: unknown;
  status: 'applied' | 'undone';
  undoneAt?: string;
}

export interface EventProgress {
  state: 'open' | 'done' | 'skipped';
  daysClaimed?: number;
}
export interface RosterEntry {
  owned: boolean;
  wanted: boolean;
  dupes: number;
  /** The game's second upgrade track (`GameContract.potential`); missing = not set. */
  potential?: number;
}
export interface UserTeam {
  id: string;
  name: string;
  members: string[];
}

interface Store {
  version: 1;
  /** When this data last changed (epoch ms). Sync keeps the newer copy; missing = never changed. */
  updatedAt?: number;
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
  ownItems: { events: {}, banners: {}, backlog: {} },
  plans: [],
  assistantActions: [],
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
  const full = raw ? { ...EMPTY_GAME, ...raw, ownItems: { ...EMPTY_GAME.ownItems, ...raw.ownItems } } : EMPTY_GAME;
  cache.set(id, { raw, full });
  return full;
}

function update(id: GameId, change: (g: GameUserData) => GameUserData): void {
  store = { ...store, updatedAt: Date.now(), games: { ...store.games, [id]: change(gameData(id)) } };
  save();
}

/** Add a bank log entry. Returns its id. */
export function addLedgerEntry(game: GameId, entry: Omit<LedgerEntry, 'id'>): string {
  const id = `${Date.parse(entry.at)}-${Math.random().toString(36).slice(2, 8)}`;
  update(game, (g) => ({ ...g, ledger: [...g.ledger, { ...entry, id }] }));
  return id;
}

/** Cancel a bank log entry by adding a correcting one (the original stays). Returns the new id, or null if there is nothing to cancel. */
export function reverseLedgerEntry(game: GameId, entryId: string, at: string, note = 'Undo'): string | null {
  const original = gameData(game).ledger.find((e) => e.id === entryId);
  if (!original || gameData(game).ledger.some((e) => e.reverses === entryId)) return null;
  return addLedgerEntry(game, { at, currency: original.currency, kind: original.kind, amount: original.amount, note, reverses: entryId });
}

/** Add pulls; ones already stored (same game pull id) are ignored. Returns how many were new. */
export function addPulls(game: GameId, incoming: PullRecord[]): number {
  return importPulls(game, incoming).length;
}

/** Add pulls; returns the ids that were new, so "Undo this import" can remove exactly those. */
export function importPulls(game: GameId, incoming: PullRecord[]): string[] {
  let added: string[] = [];
  update(game, (g) => {
    const seen = new Set(g.pulls.map((p) => p.id));
    const fresh = incoming.filter((p) => !seen.has(p.id));
    added = fresh.map((p) => p.id);
    return { ...g, pulls: [...g.pulls, ...fresh].sort((a, b) => a.time.localeCompare(b.time) || a.id.length - b.id.length || a.id.localeCompare(b.id)) };
  });
  return added;
}

export function setPaidExtras(game: GameId, on: boolean): void {
  update(game, (g) => ({ ...g, paidExtras: on }));
}

/** Count one paid extra or not. Switching one on also switches paid extras on. */
export function setPaidRow(game: GameId, rowId: string, on: boolean): void {
  update(game, (g) => {
    const off = (g.paidOff ?? []).filter((id) => id !== rowId);
    return on ? { ...g, paidExtras: true, paidOff: off } : { ...g, paidOff: [...off, rowId] };
  });
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

/** Delete one of your teams (you asked for it). Returns the team, so Undo can save it back. */
export function deleteTeam(game: GameId, teamId: string): UserTeam | null {
  const team = gameData(game).teams.find((t) => t.id === teamId) ?? null;
  if (team) update(game, (g) => ({ ...g, teams: g.teams.filter((t) => t.id !== teamId) }));
  return team;
}

/** Clear your progress on a backlog item (back to "No data yet"). */
export function clearBacklogDone(game: GameId, itemId: string): void {
  update(game, (g) => ({ ...g, backlog: Object.fromEntries(Object.entries(g.backlog).filter(([k]) => k !== itemId)) }));
}

/** Put backlog progress back exactly as it was (Undo): numbers restored, missing ones cleared. */
export function restoreBacklogDone(game: GameId, before: Record<string, number | undefined>): void {
  update(game, (g) => {
    const merged: Record<string, number | undefined> = { ...g.backlog, ...before };
    const next = Object.fromEntries(Object.entries(merged).filter((e): e is [string, number] => e[1] !== undefined));
    return { ...g, backlog: next };
  });
}

/** Save or clear the pity you entered yourself for one banner type. */
export function setPityManual(game: GameId, bannerType: string, value: { pity: number; guaranteed: boolean } | null): void {
  update(game, (g) => {
    const rest = Object.fromEntries(Object.entries(g.pityManual ?? {}).filter(([k]) => k !== bannerType));
    return { ...g, pityManual: value ? { ...rest, [bannerType]: { ...value, at: new Date().toISOString() } } : rest };
  });
}

/** Undo an import: remove exactly the pulls with these ids (an import records them). Returns how many were removed. */
export function removePulls(game: GameId, ids: string[]): number {
  const drop = new Set(ids);
  const before = gameData(game).pulls.length;
  update(game, (g) => ({ ...g, pulls: g.pulls.filter((p) => !drop.has(p.id)) }));
  return before - gameData(game).pulls.length;
}

export function setTick(game: GameId, taskId: string, at: string | null): void {
  update(game, (g) => {
    const rest = Object.fromEntries(Object.entries(g.ticks).filter(([k]) => k !== taskId));
    return { ...g, ticks: at ? { ...rest, [taskId]: at } : rest };
  });
}

/** Edit mode: put a built-in item back to the list's version (your changes dropped; a hide stays). */
export function revertOwnItem(game: GameId, kind: OwnKind, id: string, at: string): void {
  update(game, (g) => {
    const cur = g.ownItems[kind][id];
    if (!cur || cur.mine) return g;
    return { ...g, ownItems: { ...g.ownItems, [kind]: { ...g.ownItems[kind], [id]: { ...cur, fields: {}, at } } } };
  });
}

/** Edit mode: add or change one entry. Entries are never removed; hide them instead. */
export function saveOwnItem<K extends OwnKind>(game: GameId, kind: K, edit: OwnItemEdit<OwnItemTypes[K]>): void {
  update(game, (g) => ({ ...g, ownItems: { ...g.ownItems, [kind]: { ...g.ownItems[kind], [edit.id]: edit } } }));
}

/** Edit mode: hide or show an item (built-in or yours). Hiding a built-in item stores a hide flag only. */
export function setOwnItemHidden(game: GameId, kind: OwnKind, id: string, hidden: boolean, at: string): void {
  update(game, (g) => {
    const cur = g.ownItems[kind][id];
    const next = cur ? { ...cur, hidden, at } : { id, mine: false, fields: {}, hidden, at };
    return { ...g, ownItems: { ...g.ownItems, [kind]: { ...g.ownItems[kind], [id]: next } } };
  });
}

/** Add one of your plans. */
export function addPlan(game: GameId, plan: UserPlan): void {
  update(game, (g) => ({ ...g, plans: [...g.plans.filter((p) => p.id !== plan.id), plan] }));
}

/** Mark a plan active or undone (plans are never removed). */
export function setPlanStatus(game: GameId, planId: string, status: UserPlan['status']): void {
  update(game, (g) => ({ ...g, plans: g.plans.map((p) => (p.id === planId ? { ...p, status } : p)) }));
}

/** Record a change the Assistant made with your approval. */
export function recordAssistantAction(game: GameId, action: AssistantAction): void {
  update(game, (g) => ({ ...g, assistantActions: [...g.assistantActions.filter((a) => a.id !== action.id), action] }));
}

export function markAssistantActionUndone(game: GameId, actionId: string, at: string): void {
  update(game, (g) => ({ ...g, assistantActions: g.assistantActions.map((a) => (a.id === actionId ? { ...a, status: 'undone' as const, undoneAt: at } : a)) }));
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

/** Everything stored, kept current (for screens that read every game at once, like the profile showcase). */
export function useAllUserData(): { version: 1; games: Record<GameId, GameUserData> } {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    allUserData,
    allUserData,
  );
}

/**
 * Balances from the bank log: the latest "have" per currency plus changes
 * logged after it. A currency with no "have" entry is unknown.
 */
export function balances(ledger: LedgerEntry[]): Known<Record<string, number>> {
  // Undo pairs (an entry and the one that reverses it) count for nothing.
  const reversed = new Set(ledger.flatMap((e) => (e.reverses ? [e.reverses] : [])));
  const sorted = ledger.filter((e) => !e.reverses && !reversed.has(e.id)).sort((a, b) => a.at.localeCompare(b.at));
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
    store = { ...store, updatedAt: Date.now(), games: next };
    save();
  }
  return count.added;
}

/** When your game data last changed (epoch ms); 0 = never. */
export const userDataUpdatedAt = (): number => store.updatedAt ?? 0;

/** Something in your game data changed (for sync). Returns an unsubscribe function. */
export function subscribeUserData(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/**
 * Sync: take your account's newer copy. The copy on this device is kept under a backup
 * key first (never thrown away), so nothing is lost if the other copy was the wrong one.
 */
export function replaceUserData(next: { games: Record<GameId, unknown>; updatedAt?: number }): void {
  try {
    localStorage.setItem(`${KEY}.backup.${Date.now()}`, JSON.stringify(store));
  } catch {
    /* storage full or private mode: nothing to keep */
  }
  store = { version: 1, updatedAt: next.updatedAt ?? Date.now(), games: (next.games ?? {}) as Record<GameId, GameUserData> };
  cache.clear();
  unreadable = false;
  save();
}

/** Test helper. */
export function resetUserData(): void {
  store = { version: 1, games: {} };
  cache.clear();
  listeners.forEach((l) => l());
}
