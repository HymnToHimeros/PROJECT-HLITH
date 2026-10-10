/**
 * The viewer's own settings: which games, module order and hidden set per scope,
 * server per game, last open module. Kept on this device until accounts and sync
 * arrive (ROADMAP R20–R22), then mirrored to the database.
 * Never wiped: unreadable saved data is kept under a backup key, not thrown away.
 */
import { useSyncExternalStore } from 'react';
import type { GameId, ModuleId } from '../contract';
import type { LayoutState, Scope } from '../registry/layout';

export interface Prefs {
  version: 1;
  /** When these settings last changed (epoch ms). Sync keeps the newer copy. */
  updatedAt: number;
  /** Games in the switcher, in order. null = every registered game. */
  games: GameId[] | null;
  layouts: Record<Scope, LayoutState>;
  servers: Record<GameId, string>;
  lastModule: Record<Scope, ModuleId>;
  /** Account → Theme. Missing = dark. */
  theme?: Theme;
  /** When you last downloaded a backup (epoch ms). Missing = never. */
  lastBackupAt?: number;
  /** Remind me to download a backup every two weeks. Missing = on. */
  backupReminder?: boolean;
  /** Account → Notifications: the evening message. */
  notify?: NotifyPrefs;
  /** Task ids you switched off on Today, per game. */
  hiddenTasks?: Record<GameId, string[]>;
  /** Hide ticked rows on Today. */
  hideTicked?: boolean;
  /** Show each game's server clock next to the screen title. */
  showServerTime?: boolean;
  /**
   * Account → Example data: true hides every example everywhere, so only your own data
   * and the games' real lists show ("No data yet" where there is none). Missing = shown.
   * Only switches what's on screen; never adds, changes or removes any data.
   */
  hideExamples?: boolean;
}

export type Theme = 'dark' | 'light';

export interface NotifyPrefs {
  /** The evening message is on for this device. */
  enabled: boolean;
  /** Local time, "HH:MM". */
  time: string;
  items: { resets: boolean; stamina: boolean; banners: boolean; events: boolean; wanted: boolean };
  /** An unfinished event joins the message in its last N evenings. */
  eventDays: 1 | 2;
}

export const DEFAULT_NOTIFY: NotifyPrefs = {
  enabled: false,
  time: '21:00',
  items: { resets: true, stamina: true, banners: true, events: true, wanted: true },
  eventDays: 2,
};

const KEY = 'hlith.prefs';
const EMPTY: Prefs = { version: 1, updatedAt: 0, games: null, layouts: {}, servers: {}, lastModule: {} };

function read(): Prefs {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return { ...EMPTY, ...parsed, version: 1 };
  } catch {
    try {
      if (raw) localStorage.setItem(`${KEY}.unreadable.${Date.now()}`, raw);
    } catch {
      /* storage unavailable: nothing to keep */
    }
    return EMPTY;
  }
}

let current: Prefs = typeof localStorage === 'undefined' ? EMPTY : read();
const listeners = new Set<() => void>();

export function getPrefs(): Prefs {
  return current;
}

export function updatePrefs(change: (p: Prefs) => Prefs): void {
  current = { ...change(current), updatedAt: Date.now() };
  save();
}

/** Replace the settings with a copy from elsewhere (sync), keeping its timestamp. */
export function replacePrefs(next: Prefs): void {
  try {
    localStorage.setItem(`${KEY}.before-sync`, JSON.stringify(current));
  } catch {
    /* nothing to keep */
  }
  current = { ...EMPTY, ...next, version: 1 };
  save();
}

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* private mode or storage full: keep working in memory */
  }
  listeners.forEach((l) => l());
}

export function subscribePrefs(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(subscribePrefs, getPrefs, getPrefs);
}

/** Test helper: reload from storage. */
export function reloadPrefs(): void {
  current = read();
  listeners.forEach((l) => l());
}

/** Are examples shown? (Account → Example data.) Every screen that can show examples asks this. */
export function useExamplesShown(): boolean {
  return !usePrefs().hideExamples;
}
