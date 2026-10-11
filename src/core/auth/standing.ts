import { useSyncExternalStore } from 'react';
import { useNow } from '../ui/useNow';

/**
 * The signed-in account's standing (T60b), from public.my_standing() on the server: a ban or
 * a silence still running, else null. The app asks once per sign-in; screens that share or
 * post read it to explain why they can't. The server enforces both either way.
 */
export interface Standing {
  bannedUntil: number | null;
  silencedUntil: number | null;
}

const NONE: Standing = { bannedUntil: null, silencedUntil: null };
let current: Standing = NONE;
const listeners = new Set<() => void>();

/** "infinity" (until lifted / permanent) reads as Infinity. */
export function readUntil(v: unknown): number | null {
  if (v === 'infinity') return Infinity;
  if (typeof v !== 'string') return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
}

export function standingFrom(row: unknown): Standing {
  const r = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
  return { bannedUntil: readUntil(r.banned_until), silencedUntil: readUntil(r.silenced_until) };
}

export function setStanding(next: Standing | null): void {
  current = next ?? NONE;
  listeners.forEach((l) => l());
}

export function useStanding(): { banned: boolean; silenced: boolean; standing: Standing } {
  const s = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => NONE,
  );
  // Re-checked every minute, so a ban or silence that runs out ends on its own.
  const now = useNow(60_000);
  const banned = s.bannedUntil !== null && s.bannedUntil > now;
  return { banned, silenced: banned || (s.silencedUntil !== null && s.silencedUntil > now), standing: s };
}
