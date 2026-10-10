/**
 * Settings sync: this device ↔ your account. Newest copy wins as a whole; the
 * losing local copy is kept under a backup key (never wiped). Sync status is
 * shown in the shell: honest about "this device only" and failures.
 */
import { useSyncExternalStore } from 'react';
import { getPrefs, replacePrefs, subscribePrefs, type Prefs } from './prefs';
import { allUserData, replaceUserData, subscribeUserData, userDataUpdatedAt } from './userData';

export interface SettingsStore {
  load(): Promise<{ data: Prefs; updatedAt: number } | null>;
  save(data: Prefs): Promise<void>;
}

/** Your game data (bank log, pulls, roster, progress, own items…) as one copy per account. */
export interface GameDataCopy {
  version: 1;
  updatedAt: number;
  games: Record<string, unknown>;
}
export interface GameDataStore {
  load(): Promise<GameDataCopy | null>;
  save(data: GameDataCopy): Promise<void>;
}

export type SyncStatus =
  | { state: 'device-only' }
  | { state: 'signed-out' }
  | { state: 'syncing' }
  | { state: 'synced'; at: number }
  | { state: 'failed'; message: string };

let status: SyncStatus = { state: 'device-only' };
const listeners = new Set<() => void>();
const setStatus = (s: SyncStatus) => {
  status = s;
  listeners.forEach((l) => l());
};

export const getSyncStatus = () => status;
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getSyncStatus,
    getSyncStatus,
  );
}

export function markDeviceOnly(): void {
  setStatus({ state: 'device-only' });
}
export function markSignedOut(): void {
  setStatus({ state: 'signed-out' });
}

/**
 * Start syncing settings with a store. Returns a stop function.
 * `debounceMs` batches quick edits into one save.
 */
const gameCopy = (): GameDataCopy => ({ version: 1, updatedAt: userDataUpdatedAt(), games: allUserData().games });

/**
 * Start syncing settings (and, when `gameStore` is given, your game data) with your account.
 * For each, the newer copy wins; the losing copy on this device is kept as a backup in this
 * browser, never thrown away. Returns a stop function. `debounceMs` batches quick edits.
 */
export async function startSync(store: SettingsStore, debounceMs = 1500, gameStore?: GameDataStore): Promise<() => void> {
  setStatus({ state: 'syncing' });
  try {
    const remote = await store.load();
    const local = getPrefs();
    if (remote && remote.updatedAt > local.updatedAt) replacePrefs(remote.data);
    else if (!remote || local.updatedAt > remote.updatedAt) await store.save(local);
    if (gameStore) {
      const remoteGames = await gameStore.load();
      const localAt = userDataUpdatedAt();
      if (remoteGames && remoteGames.updatedAt > localAt) replaceUserData(remoteGames);
      else if (localAt > 0 && (!remoteGames || localAt > remoteGames.updatedAt)) await gameStore.save(gameCopy());
    }
    setStatus({ state: 'synced', at: Date.now() });
  } catch (e) {
    setStatus({ state: 'failed', message: e instanceof Error ? e.message : 'Sync failed' });
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  const dirty = { prefs: false, games: false };
  const push = async () => {
    setStatus({ state: 'syncing' });
    try {
      // "Sync now" sends both; a change sends only what changed.
      const all = !dirty.prefs && !dirty.games;
      if (all || dirty.prefs) await store.save(getPrefs());
      if (gameStore && (all || dirty.games) && userDataUpdatedAt() > 0) await gameStore.save(gameCopy());
      dirty.prefs = false;
      dirty.games = false;
      setStatus({ state: 'synced', at: Date.now() });
    } catch (e) {
      setStatus({ state: 'failed', message: e instanceof Error ? e.message : 'Sync failed' });
    }
  };
  pushNow = push;
  const later = (what: 'prefs' | 'games') => () => {
    dirty[what] = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void push(), debounceMs);
  };
  const unsubscribe = subscribePrefs(later('prefs'));
  const unsubscribeGames = gameStore ? subscribeUserData(later('games')) : () => {};
  return () => {
    unsubscribe();
    unsubscribeGames();
    if (timer) clearTimeout(timer);
    if (pushNow === push) pushNow = null;
  };
}

let pushNow: (() => Promise<void>) | null = null;

/** "Sync now" (Account → Sync, the sidebar sync line). False when there is nothing to sync with (this device only, signed out). */
export async function syncNow(): Promise<boolean> {
  if (!pushNow) return false;
  await pushNow();
  return true;
}

/** Is a sync connection running? */
export const canSync = () => pushNow !== null;
