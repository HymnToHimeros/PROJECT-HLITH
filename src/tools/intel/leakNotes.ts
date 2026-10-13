/**
 * Leak notes (T77): leak posts the owner approved in Owner console → Findings, shown in
 * that game's Intel. Approving one writes a catalog row of kind `leak` (public.catalog_items:
 * everyone signed in reads it, it survives reloads, and "Move back to new" retires it like any
 * list item). Only the post's words and links are kept; images stay links, never copied.
 */
import { useEffect, useState } from 'react';
import type { CatalogRow } from '../../core/data/catalog';
import { catalogRows } from '../../core/data/catalogSource';

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
  title: string;
  /** When the post was made (ISO), or when it was found. */
  at: string;
  /** Who it came from, e.g. "Seele (Telegram)". */
  credit: string;
  url?: string;
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

/** "Leak (Seele): Firefly rerun" → "Firefly rerun". */
const cleanTitle = (title: string) => title.replace(/^leak\s*(\([^)]*\))?\s*:\s*/i, '').trim() || title.trim();

/**
 * The Intel note an approved leak post becomes: an info finding marked as a leak, with a post.
 * (A `leak` finding with a new character, banner or event goes into that list instead: approve.ts.)
 */
export function noteFromFinding(f: FindingForNote): { gameId: string; id: string; data: Omit<LeakNote, 'id' | 'gameId'> } | null {
  if (!f.game_id || f.kind !== 'info' || f.payload.leak !== true) return null;
  const post = postOf(f.payload);
  if (!post) return null;
  const at = post.at && Number.isFinite(Date.parse(post.at)) ? post.at : f.found_at;
  const url = link(post.url) ?? link(f.source_url);
  return {
    gameId: f.game_id,
    id: `note-${f.id}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 80),
    data: {
      title: cleanTitle(f.title),
      at,
      credit: s(f.source_name) ?? 'unknown source',
      text: post.text,
      images: post.images,
      ...(url ? { url } : {}),
      ...(post.translation ? { translation: post.translation } : {}),
    },
  };
}

/** A catalog row back into a note; anything malformed is left out. */
export function readNote(row: CatalogRow): LeakNote | null {
  if (row.kind !== 'leak' || row.status !== 'active') return null;
  const d = row.data;
  const title = s(d.title);
  const text = s(d.text);
  const at = s(d.at);
  if (!title || !text || !at || !Number.isFinite(Date.parse(at))) return null;
  const url = link(d.url);
  const translation = s(d.translation);
  return {
    id: row.id,
    gameId: row.game_id,
    title,
    at,
    credit: s(d.credit) ?? 'unknown source',
    text,
    images: Array.isArray(d.images) ? d.images.filter((x): x is string => typeof x === 'string' && /^https:\/\//.test(x)) : [],
    ...(url ? { url } : {}),
    ...(translation ? { translation } : {}),
  };
}

/** The notes for these games, newest first. */
export function notesFor(rows: CatalogRow[], gameIds: string[]): LeakNote[] {
  return rows
    .filter((r) => gameIds.includes(r.game_id))
    .map(readNote)
    .filter((n): n is LeakNote => n !== null)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
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
