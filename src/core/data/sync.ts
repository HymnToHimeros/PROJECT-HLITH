/**
 * Settings sync: this device ↔ your account. Newest copy wins as a whole; the
 * losing local copy is kept under a backup key (never wiped). Sync status is
 * shown in the shell: honest about "this device only" and failures.
 */
import { useSyncExternalStore } from 'react';
import { getPrefs, replacePrefs, subscribePrefs, type Prefs } from './prefs';

export interface SettingsStore {
  load(): Promise<{ data: Prefs; updatedAt: number } | null>;
  save(data: Prefs): Promise<void>;
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
export async function startSync(store: SettingsStore, debounceMs = 1500): Promise<() => void> {
  setStatus({ state: 'syncing' });
  try {
    const remote = await store.load();
    const local = getPrefs();
    if (remote && remote.updatedAt > local.updatedAt) replacePrefs(remote.data);
    else if (!remote || local.updatedAt > remote.updatedAt) await store.save(local);
    setStatus({ state: 'synced', at: Date.now() });
  } catch (e) {
    setStatus({ state: 'failed', message: e instanceof Error ? e.message : 'Sync failed' });
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  const push = async () => {
    setStatus({ state: 'syncing' });
    try {
      await store.save(getPrefs());
      setStatus({ state: 'synced', at: Date.now() });
    } catch (e) {
      setStatus({ state: 'failed', message: e instanceof Error ? e.message : 'Sync failed' });
    }
  };
  pushNow = push;
  const unsubscribe = subscribePrefs(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void push(), debounceMs);
  });
  return () => {
    unsubscribe();
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
