/**
 * Roster → Characters "Show leaked": off by default, remembered in this browser
 * (a convenience, not account data). Separate from Banners' "Hide leaks", whose
 * default shows leaks; when "Hide leaks" is on, leaked characters stay hidden too.
 */
import { useSyncExternalStore } from 'react';

const KEY = 'hlith.roster.showLeaked';
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

export function setShowLeaked(show: boolean): void {
  memory = show;
  try {
    localStorage.setItem(KEY, show ? '1' : '0');
  } catch {
    /* blocked storage: keep it for this visit */
  }
  listeners.forEach((l) => l());
}

export function useShowLeaked(): boolean {
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
export function resetShowLeaked(): void {
  memory = null;
  listeners.forEach((l) => l());
}
