/**
 * Talks to HLITH's server for the account features: the reminder row (calendar
 * feed + evening message), Export my data, Delete my account. Every call needs
 * sign-in; in "this device only" mode there is no server and callers say so.
 */
import { backend } from '../../core/data/backend';
import type { NotifyPrefs } from '../../core/data/prefs';
import type { Schedule } from '../../../supabase/functions/_shared/schedule.ts';

export const hasServer = () => backend !== null;

export interface ReminderRow {
  feed_enabled: boolean;
  feed_token: string | null;
  updated_at: string;
}

async function userId(): Promise<string> {
  if (!backend) throw new Error('This site runs without a server (this device only).');
  const { data } = await backend.auth.getUser();
  if (!data.user) throw new Error('Sign in first.');
  return data.user.id;
}

export async function readReminders(): Promise<ReminderRow | null> {
  if (!backend) return null;
  const id = await userId();
  const { data, error } = await backend.from('reminder_settings').select('feed_enabled, feed_token, updated_at').eq('user_id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as ReminderRow | null;
}

/** A long random link token (base64url, 43 characters). */
export function newToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function saveReminders(change: { schedule?: Schedule; notify?: NotifyPrefs; feed_enabled?: boolean; feed_token?: string | null }): Promise<ReminderRow> {
  if (!backend) throw new Error('This site runs without a server (this device only).');
  const id = await userId();
  const { data, error } = await backend
    .from('reminder_settings')
    .upsert({ user_id: id, ...change })
    .select('feed_enabled, feed_token, updated_at')
    .single();
  if (error) throw new Error(error.message);
  return data as ReminderRow;
}

export function feedUrl(token: string): string {
  const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
  return `${base.replace(/\/$/, '')}/functions/v1/ics-feed?token=${encodeURIComponent(token)}`;
}

export async function callFunction<T>(name: string, body: unknown): Promise<T> {
  if (!backend) throw new Error('This site runs without a server (this device only).');
  const { data, error } = await backend.functions.invoke<T>(name, { body: body as Record<string, unknown> });
  if (error) throw new Error(error.message);
  return data as T;
}

export interface DeletionRequest {
  requested_at: string;
  purge_after: string;
  cancelled_at: string | null;
  completed_at: string | null;
}
