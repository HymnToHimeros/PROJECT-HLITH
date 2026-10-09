/**
 * "Hide leaks": one switch per viewer, shared by Banners and Intel. Kept in
 * this browser only (a convenience, not account data); if storage is blocked
 * it still works for the visit.
 */
import { useSyncExternalStore } from 'react';

const KEY = 'hlith.hideLeaks';
const listeners = new Set<() => void>();
let memory: boolean | null = null;

function read(): boolean {
  if (memory !== null) return memory;
  try {
    memory = localStorage.getItem(KEY) === '1';
  } catch {
    memory = false;
  }
  return memory;
}

export function setHideLeaks(hide: boolean): void {
  memory = hide;
  try {
    localStorage.setItem(KEY, hide ? '1' : '0');
  } catch {
    /* private mode or blocked storage: keep it for this visit */
  }
  listeners.forEach((l) => l());
}

export function useHideLeaks(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => false,
  );
}

/** Test helper: forget the in-memory copy so the next read comes from storage. */
export function resetHideLeaks(): void {
  memory = null;
  listeners.forEach((l) => l());
}
