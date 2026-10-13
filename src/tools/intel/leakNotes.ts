/**
 * Intel notes (T77): every finding the owner approves in Owner console → Findings, whatever its
 * kind or source, shows in that game's Intel (findings that fit a list still go into it too).
 * Approving one writes a catalog row of kind `leak` (public.catalog_items: everyone signed in
 * reads it, it survives reloads, and "Move back to new" retires it like any list item). Only words
 * and links are kept; a post's images stay links, never copied.
 */
import { useEffect, useState } from 'react';
import type { CatalogRow } from '../../core/data/catalog';
import { catalogRows } from '../../core/data/catalogSource';
import { eventFromInfo } from '../owner/approve';

/** A post a job found on a channel, inside its finding (docs/ROUTINES.md step 3). */
export interface PostPayload {
  url?: string;
  at?: string;
  text: string;
  translation?: string;
  images: string[];
}

const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v : undefined);
const link = (v: unknown) => {
  const u = s(v);
  return u && /^https:\/\//.test(u) ? u : undefined;
};

/** The `post` part of a finding's payload, or null when it has none. */
export function postOf(payload: Record<string, unknown>): PostPayload | null {
  const p = payload.post;
  if (!p || typeof p !== 'object') return null;
  const r = p as Record<string, unknown>;
  if (typeof r.text !== 'string' || !r.text.trim()) return null;
  const translation = s(r.translation);
  const url = s(r.url);
  const at = s(r.at);
  return {
    text: r.text,
    images: Array.isArray(r.images) ? r.images.filter((x): x is string => typeof x === 'string' && /^https:\/\//.test(x)) : [],
    ...(translation ? { translation } : {}),
    ...(url ? { url } : {}),
    ...(at ? { at } : {}),
  };
}

export interface LeakNote {
  id: string;
  gameId: string;
  /** The finding's kind: leak, event, banner, character or info. */
  kind: string;
  /** From a leak (a leak finding, or one marked as a leak): shown as unverified. */
  leak: boolean;
  title: string;
  /** When the post was made (ISO), or when it was found. */
  at: string;
  /** Who it came from, e.g. "Seele (Telegram)". */
  credit: string;
  url?: string;
  /** The post, or a short line from the finding (dates, featured, …); may be empty. */
  text: string;
  /** English, when the post was translated (then `text` is the original). */
  translation?: string;
  images: string[];
}

export interface FindingForNote {
  id: string;
  game_id: string | null;
  kind: string;
  title: string;
  payload: Record<string, unknown>;
  source_name: string | null;
  source_url: string | null;
  found_at: string;
}

const day = (v: unknown) => {
  const t = typeof v === 'string' ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : undefined;
};

/** A short line from a finding without a post: its own summary, or its dates and featured names. */
function lineOf(p: Record<string, unknown>): string {
  const own = s(p.summary) ?? s(p.description) ?? s(p.note) ?? s(p.text);
  if (own) return own;
  const parts: string[] = [];
  const from = day(p.start);
  const to = day(p.end);
  if (from || to) parts.push(`${from ?? '?'} → ${to ?? '?'}`);
  if (Array.isArray(p.featured)) {
    const names = p.featured.filter((x): x is string => typeof x === 'string' && x.trim() !== '');
    if (names.length) parts.push(`Featured: ${names.join(', ')}`);
  }
  for (const k of ['rarity', 'element', 'role', 'path', 'type']) {
    const v = s(p[k]);
    if (v) parts.push(v);
  }
  return parts.join(' · ');
}

/** "Leak (Seele): Firefly rerun" → "Firefly rerun". */
const cleanTitle = (title: string) => title.replace(/^leak\s*(\([^)]*\))?\s*:\s*/i, '').trim() || title.trim();

/**
 * The Intel note an approved finding becomes, whatever its kind: the post when it carries one
 * (a leak channel), else a short line from its payload. Null only when it names no game.
 */
export function noteFromFinding(f: FindingForNote): { gameId: string; id: string; data: Omit<LeakNote, 'id' | 'gameId'> } | null {
  if (!f.game_id) return null;
  const post = postOf(f.payload);
  // "ZZZ: new event X (2026-10-13 → 2026-10-18)": the note is the event's name, with its dates as the line.
  const event = post ? null : eventFromInfo(f);
  const eventLine = event ? `${event.start?.slice(0, 10) ?? '?'} → ${event.end?.slice(0, 10) ?? '?'}` : undefined;
  const at = post?.at && Number.isFinite(Date.parse(post.at)) ? post.at : f.found_at;
  const url = link(post?.url) ?? link(f.source_url);
  return {
    gameId: f.game_id,
    id: `note-${f.id}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 80),
    data: {
      kind: f.kind,
      leak: f.kind === 'leak' || f.payload.leak === true,
      title: event?.title ?? cleanTitle(f.title),
      at,
      credit: s(f.source_name) ?? 'unknown source',
      text: post?.text ?? eventLine ?? lineOf(f.payload),
      images: post?.images ?? [],
      ...(url ? { url } : {}),
      ...(post?.translation ? { translation: post.translation } : {}),
    },
  };
}

/** A catalog row back into a note; anything malformed is left out. */
export function readNote(row: CatalogRow): LeakNote | null {
  if (row.kind !== 'leak' || row.status !== 'active') return null;
  const d = row.data;
  const title = s(d.title);
  const at = s(d.at);
  if (!title || !at || !Number.isFinite(Date.parse(at))) return null;
  const url = link(d.url);
  const translation = s(d.translation);
  return {
    id: row.id,
    gameId: row.game_id,
    kind: s(d.kind) ?? 'leak',
    leak: d.leak !== false,
    title,
    at,
    credit: s(d.credit) ?? 'unknown source',
    text: s(d.text) ?? '',
    images: Array.isArray(d.images) ? d.images.filter((x): x is string => typeof x === 'string' && /^https:\/\//.test(x)) : [],
    ...(url ? { url } : {}),
    ...(translation ? { translation } : {}),
  };
}

/** Two notes say the same thing when they are for the same game with the same title (an item approved twice). */
export const noteKey = (gameId: string, title: string) => `${gameId}|${title.trim().toLowerCase().replace(/\s+/g, ' ')}`;

/** The notes for these games, newest first; the same item approved twice shows once. */
export function notesFor(rows: CatalogRow[], gameIds: string[]): LeakNote[] {
  const seen = new Set<string>();
  return rows
    .filter((r) => gameIds.includes(r.game_id))
    .map(readNote)
    .filter((n): n is LeakNote => n !== null)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .filter((n) => {
      const key = noteKey(n.gameId, n.title);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** Leak notes for these games from the catalog (none without a server or signed out). */
export function useLeakNotes(gameIds: string[], source: () => Promise<CatalogRow[]> = catalogRows): LeakNote[] {
  const key = gameIds.join(',');
  const [notes, setNotes] = useState<LeakNote[]>([]);
  useEffect(() => {
    let alive = true;
    void source()
      .catch(() => [] as CatalogRow[])
      .then((rows) => alive && setNotes(notesFor(rows, key.split(','))));
    return () => {
      alive = false;
    };
  }, [key, source]);
  return notes;
}
