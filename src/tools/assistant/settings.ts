/**
 * Assistant settings and spending, kept on this device only (not synced):
 * which model answers, web search on/off, your daily limit, and what your
 * messages cost here (an estimate from token counts, see models.ts).
 */
import { useSyncExternalStore } from 'react';
import { DEFAULT_MODEL, MODELS } from './models';

export interface AssistantSettings {
  model: string;
  webSearch: boolean;
  /** US dollars per day on this device; null = no limit. */
  dailyLimit: number | null;
  /** Local day (YYYY-MM-DD) → estimated dollars spent that day on this device. */
  spent: Record<string, number>;
  /** Model id → your messages with it on this device: how many, and their estimated total. */
  measured: Record<string, { messages: number; usd: number }>;
}

const KEY = 'hlith.assistant.settings';
const EMPTY: AssistantSettings = { model: DEFAULT_MODEL, webSearch: true, dailyLimit: 1, spent: {}, measured: {} };

function read(): AssistantSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = { ...EMPTY, ...(JSON.parse(raw) as Partial<AssistantSettings>) };
    if (!MODELS.some((m) => m.id === parsed.model)) parsed.model = DEFAULT_MODEL;
    return parsed;
  } catch {
    return EMPTY;
  }
}

let current: AssistantSettings = typeof localStorage === 'undefined' ? EMPTY : read();
const listeners = new Set<() => void>();

export function getSettings(): AssistantSettings {
  return current;
}

export function updateSettings(change: (s: AssistantSettings) => AssistantSettings): void {
  current = change(current);
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* private mode: keep in memory */
  }
  listeners.forEach((l) => l());
}

export function useSettings(): AssistantSettings {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getSettings,
    getSettings,
  );
}

export const localDay = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const spentToday = (s: AssistantSettings, now: number) => s.spent[localDay(now)] ?? 0;

/** Count one reply's estimated cost toward today and the model's measured average. Unknown costs only count the message. */
export function recordSpend(model: string, usd: number | null, now: number): void {
  updateSettings((s) => {
    const day = localDay(now);
    const m = s.measured[model] ?? { messages: 0, usd: 0 };
    // Keep the last 60 days of daily totals.
    const days = Object.keys(s.spent).sort().slice(-59);
    return {
      ...s,
      spent: { ...Object.fromEntries(days.map((d) => [d, s.spent[d] ?? 0])), [day]: (s.spent[day] ?? 0) + (usd ?? 0) },
      measured: { ...s.measured, [model]: { messages: m.messages + 1, usd: m.usd + (usd ?? 0) } },
    };
  });
}

/** Test helper. */
export function resetSettings(): void {
  current = typeof localStorage === 'undefined' ? EMPTY : read();
  listeners.forEach((l) => l());
}
