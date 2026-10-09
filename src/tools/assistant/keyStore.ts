/**
 * Your Claude API key. Kept ONLY where you choose:
 *  - 'device': this browser's local storage, until you tap "Forget key";
 *  - 'session': this tab only, gone when you close it.
 * It is never put in your HLITH settings or data (those sync to your account),
 * and it leaves this device only inside an Assistant request, which uses it for
 * that one call to Claude and keeps nothing.
 */
import { useSyncExternalStore } from 'react';

export const KEY_STORAGE = 'hlith.assistant.key';
export type KeyPlace = 'device' | 'session';

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

const store = (place: KeyPlace): Storage | null => {
  try {
    return place === 'device' ? localStorage : sessionStorage;
  } catch {
    return null;
  }
};

/** Memory copy for when storage is blocked (private mode): lasts until the page closes. */
let memory: string | null = null;

export function readKey(): { key: string; place: KeyPlace } | null {
  for (const place of ['session', 'device'] as const) {
    try {
      const v = store(place)?.getItem(KEY_STORAGE);
      if (v) return { key: v, place };
    } catch {
      /* blocked */
    }
  }
  return memory ? { key: memory, place: 'session' } : null;
}

/** Looks like a Claude API key (shape only; Claude decides if it works). */
export const looksLikeKey = (k: string) => /^sk-ant-[A-Za-z0-9_-]{10,300}$/.test(k.trim());

export function saveKey(key: string, place: KeyPlace): void {
  const k = key.trim();
  forgetKey(false);
  try {
    store(place)?.setItem(KEY_STORAGE, k);
  } catch {
    memory = k;
  }
  if (!readKey()) memory = k;
  notify();
}

/** Remove the key from every place it could be. */
export function forgetKey(announce = true): void {
  for (const place of ['device', 'session'] as const) {
    try {
      store(place)?.removeItem(KEY_STORAGE);
    } catch {
      /* blocked */
    }
  }
  memory = null;
  if (announce) notify();
}

/** "sk-ant-…a1b2": enough to recognise it, never the whole key on screen. */
export const maskKey = (k: string) => `${k.slice(0, 7)}…${k.slice(-4)}`;

const snapshot = () => {
  const k = readKey();
  return k ? `${k.place}:${k.key}` : '';
};

export function useKey(): { key: string; place: KeyPlace } | null {
  const snap = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    snapshot,
    snapshot,
  );
  if (!snap) return null;
  const i = snap.indexOf(':');
  return { place: snap.slice(0, i) as KeyPlace, key: snap.slice(i + 1) };
}
