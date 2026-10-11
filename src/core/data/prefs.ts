/**
 * The viewer's own settings: which games, module order and hidden set per scope,
 * server per game, last open module. Kept on this device until accounts and sync
 * arrive (ROADMAP R20–R22), then mirrored to the database.
 * Never wiped: unreadable saved data is kept under a backup key, not thrown away.
 */
import { useSyncExternalStore } from 'react';
import type { GameId, ModuleId } from '../contract';
import type { LayoutState, Scope } from '../registry/layout';
import type { OwnerThemeId } from '../theme/ownerThemes';
import type { Theme } from '../theme/themes';

export type { Theme } from '../theme/themes';

export interface Prefs {
  version: 1;
  /** When these settings last changed (epoch ms). Sync keeps the newer copy. */
  updatedAt: number;
  /** Games in the switcher, in order. null = every registered game. */
  games: GameId[] | null;
  layouts: Record<Scope, LayoutState>;
  servers: Record<GameId, string>;
  /** Your main character per game (`GameContract.protagonist` option id), e.g. HSR: 'caelus'. Missing = not picked. */
  protagonists?: Record<GameId, string>;
  lastModule: Record<Scope, ModuleId>;
  /** Account → Theme (one of THEME_IDS in theme/themes.ts, or `owner:<id>` for an owner-only theme). Missing or unknown = dark (Glacier). */
  theme?: Theme | OwnerThemeId;
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
  /** Account → Guide: setup checklist steps you chose to skip (step ids). Missing = none. */
  skippedSetup?: string[];
  /** Account → Theme → Animations. Missing = follow the device (reduced when it asks for less motion). */
  motion?: 'on' | 'reduced' | 'off';
  /** Account → Theme → Look (T52): accent, text size, spacing, corners (theme/look.ts). Missing = the theme as designed. */
  look?: { accent?: string; textSize?: string; spacing?: string; corners?: string; font?: string; cards?: string };
  /** Customise → Look → Game colours (T52b): your own colour per game, from theme/vents.ts. Missing = the game's own. */
  gameVents?: Record<GameId, string>;
  /** Customise → Theme schedule (T52b): theme/schedule.ts. Missing = always the theme above. */
  themeSchedule?: unknown;
  /** Customise → Time and format (T52b): time/displayFormat.ts. Missing = this device's own way. */
  format?: { clock?: string | undefined; date?: string | undefined; numbers?: string | undefined; weekStart?: string | undefined };
  /** Customise → Layout: the game (or All games) HLITH opens on. Missing = All games (or the only game). */
  defaultScope?: string;
  /** Customise → Layout: the tab a module opens on, per module. Missing = its first tab. */
  startTabs?: Partial<Record<ModuleId, string>>;
  /** Account → Layout → Start screen (T52): the module HLITH opens on. Missing = the last one you had open. */
  startModule?: ModuleId;
}

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

/** UTC offset of the user's chosen server for a game (undefined = none chosen). Used to show "server time" ends at the right moment. */
export function useServerOffset(game: { id: string; servers: { id: string; utcOffset: number }[] }): number | undefined {
  const servers = usePrefs().servers;
  return game.servers.find((s) => s.id === servers[game.id])?.utcOffset;
}
