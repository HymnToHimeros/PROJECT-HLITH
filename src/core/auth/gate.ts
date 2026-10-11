import { useSyncExternalStore } from 'react';
import { backend } from '../data/backend';
import type { UsernameStatus } from './username';

/**
 * First run (T62): where the signed-in account stands, from public.my_gate() (migration 0016).
 * Before the app opens, an account accepts the current Terms of service and Privacy policy and
 * chooses a username. The server enforces it (no adding or changing app data until then); this
 * only decides what to show.
 */
export interface Gate {
  termsVersion: number;
  privacyVersion: number;
  termsOk: boolean;
  privacyOk: boolean;
  username: string | null;
  /** When the username may change again (null: any time). */
  nextChangeAt: number | null;
  /** The display name, when it would be a valid, free username. */
  suggested: string | null;
  accepted: boolean;
  /** The owner may choose reserved names (the server checks this too). */
  owner: boolean;
}

export function gateFrom(row: unknown): Gate {
  const r = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
  const next = typeof r.next_change_at === 'string' ? Date.parse(r.next_change_at) : NaN;
  return {
    termsVersion: Number(r.terms_version) || 0,
    privacyVersion: Number(r.privacy_version) || 0,
    termsOk: r.terms_ok === true,
    privacyOk: r.privacy_ok === true,
    username: typeof r.username === 'string' ? r.username : null,
    nextChangeAt: Number.isNaN(next) ? null : next,
    suggested: typeof r.suggested === 'string' ? r.suggested : null,
    accepted: r.accepted === true,
    owner: r.owner === true,
  };
}

export interface GateApi {
  load(): Promise<Gate>;
  status(name: string): Promise<UsernameStatus>;
  accept(terms: number, privacy: number): Promise<Gate>;
  setUsername(name: string): Promise<Gate>;
  /** Starts the normal 30-day account deletion; resolves to the date it completes (ms). */
  deleteAccount(): Promise<number | null>;
}

const client = backend;

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  if (!client) throw new Error('This site runs without a server.');
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(friendly(error.message));
  return data as T;
}

/** The server's short reasons, in plain words. */
function friendly(message: string): string {
  if (/^username taken/.test(message)) return 'That username was just taken. Try another.';
  if (/^username (invalid|reserved|blocked)/.test(message)) return 'That username isn’t allowed.';
  return message.charAt(0).toUpperCase() + message.slice(1) + (/[.!?]$/.test(message) ? '' : '.');
}

export const serverGate: GateApi | null = client
  ? {
      load: async () => gateFrom(await rpc('my_gate')),
      status: (name) => rpc<UsernameStatus>('username_status', { p_name: name }),
      accept: async (terms, privacy) => gateFrom(await rpc('accept_legal', { p_terms: terms, p_privacy: privacy })),
      setUsername: async (name) => gateFrom(await rpc('set_username', { p_name: name })),
      deleteAccount: async () => {
        const { data, error } = await client.functions.invoke('delete-account', { body: { action: 'request', confirm: 'DELETE' } });
        if (error) throw new Error('The deletion couldn’t be started. Try again in a moment.');
        const after = (data as { request?: { purge_after?: unknown } } | null)?.request?.purge_after;
        return typeof after === 'string' ? Date.parse(after) : null;
      },
    }
  : null;

// The signed-in account's gate, for screens that show or change the username (Profile).
let current: Gate | null = null;
const listeners = new Set<() => void>();
export function setGate(next: Gate | null): void {
  current = next;
  listeners.forEach((l) => l());
}
export function useGate(): Gate | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => null,
  );
}
