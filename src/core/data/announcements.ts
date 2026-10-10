/**
 * Announcements from the owner (public.announcements, migration 0008). Everyone signed
 * in reads the active ones; the owner reads all and writes them (Owner console →
 * Announcements). Nothing is removed: an announcement ends (ends_at). Hiding one on
 * your device is remembered per announcement, on this device only.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { backend } from './backend';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  level: 'info' | 'warning';
  starts_at: string;
  ends_at: string | null;
  created_at: string;
}

const COLUMNS = 'id,title,body,level,starts_at,ends_at,created_at';

export const isActive = (a: Pick<Announcement, 'starts_at' | 'ends_at'>, now: number) =>
  Date.parse(a.starts_at) <= now && (a.ends_at === null || Date.parse(a.ends_at) > now);

/** Active announcements for the signed-in user, newest first. [] without a server, signed out, or when the read fails. */
export async function activeAnnouncements(client: SupabaseClient | null = backend, now = Date.now()): Promise<Announcement[]> {
  if (!client) return [];
  const { data: auth } = await client.auth.getSession();
  if (!auth.session) return [];
  const iso = new Date(now).toISOString();
  const { data, error } = await client
    .from('announcements')
    .select(COLUMNS)
    .lte('starts_at', iso)
    .or(`ends_at.is.null,ends_at.gt.${iso}`)
    .order('starts_at', { ascending: false })
    .limit(5);
  if (error) return [];
  return ((data ?? []) as Announcement[]).filter((a) => isActive(a, now));
}

/** Every announcement (the owner sees all of them, row-level security permitting). Throws when the read fails. */
export async function allAnnouncements(client: SupabaseClient | null = backend): Promise<Announcement[]> {
  if (!client) return [];
  const { data, error } = await client.from('announcements').select(COLUMNS).order('starts_at', { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as Announcement[];
}

const noServer = () => new Error('This site runs without a server (this device only), so announcements can’t reach anyone.');

export async function createAnnouncement(a: Pick<Announcement, 'title' | 'body' | 'level' | 'starts_at' | 'ends_at'>): Promise<void> {
  if (!backend) throw noServer();
  const { error } = await backend.from('announcements').insert(a);
  if (error) throw new Error(error.message);
}

/** Ends it now. One that hasn't started yet also gets its start moved to now, so it never shows. */
export async function endAnnouncement(a: Pick<Announcement, 'id' | 'starts_at'>, now = Date.now()): Promise<void> {
  if (!backend) throw noServer();
  const patch: Partial<Announcement> = { ends_at: new Date(now).toISOString() };
  if (Date.parse(a.starts_at) >= now) patch.starts_at = new Date(now - 1000).toISOString();
  const { error } = await backend.from('announcements').update(patch).eq('id', a.id);
  if (error) throw new Error(error.message);
}

// ── Hidden on this device ─────────────────────────────────────────
const KEY = 'hlith.announcements.hidden';

export function hiddenAnnouncements(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function hideAnnouncement(id: string): void {
  try {
    const list = hiddenAnnouncements();
    if (!list.includes(id)) localStorage.setItem(KEY, JSON.stringify([...list, id].slice(-200)));
  } catch {
    // Storage blocked: it stays hidden until the page reloads.
  }
}
