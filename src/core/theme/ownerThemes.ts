/**
 * Owner-only themes (T47). Their names, colours, drawn scenes and pictures are never in the
 * public repo or the app bundle: they live in the private `owner-themes` storage bucket
 * (supabase/migrations/0010_owner_themes.sql, owners only) as `manifest.json` plus the files it
 * names. The app downloads them at run time only after the server says the account is an owner,
 * so other accounts never receive any of it, not even the names.
 *
 * Everything in the manifest is checked before use: only colour tokens (6-digit hex) and a few
 * numbers, no other CSS; ink.5 must reach 4.5:1 on bg.app and bg.card like every theme; file
 * paths stay inside the bucket. A theme that fails is left out, with the reason.
 */
import { useSyncExternalStore } from 'react';
import { contrast } from './contrast';

/** Saved in prefs.theme for an owner theme: `owner:<id>`. */
export type OwnerThemeId = `owner:${string}`;
export const OWNER_PREFIX = 'owner:';
export const isOwnerThemeId = (v: unknown): v is OwnerThemeId => typeof v === 'string' && v.startsWith(OWNER_PREFIX);

export const ORNAMENTS = ['hearts', 'bubbles', 'gold-frame', 'lace'] as const;
export type Ornament = (typeof ORNAMENTS)[number];

export interface OwnerThemeEntry {
  id: string;
  name: string;
  mood: string;
  tone: 'dark' | 'light';
  /** Token name (without --) → value. Colours as #rrggbb; `art-opacity` / `owner-art-opacity` as 0–1. */
  tokens: Record<string, string>;
  /** The drawn scene, a file in the bucket (e.g. scenes/<id>.svg). */
  scene?: string;
  /** The owner's own picture for this theme, a file in the bucket; shown instead of the scene. */
  picture?: string;
  ornaments: Ornament[];
}

export interface OwnerTheme extends OwnerThemeEntry {
  /** Ready to show (blob: links made from the downloaded files), or missing. */
  sceneUrl?: string;
  pictureUrl?: string;
}

/** Glacier's own values: what an owner theme keeps unless it sets its own. */
const BASE = { 'ink-5': '#768a9e', 'bg-app': '#08090b', 'bg-card': '#0e1115' } as const;
const NUMBER_TOKENS = new Set(['art-opacity', 'owner-art-opacity']);
const HEX = /^#[0-9a-f]{6}$/i;
const PATH = /^(?!.*\.\.)[a-z0-9][a-z0-9/_.-]{0,119}$/;

/** Checks one manifest entry; returns the clean theme or the reasons it can't be used. */
export function readOwnerTheme(raw: unknown): { theme: OwnerThemeEntry } | { problems: string[] } {
  const problems: string[] = [];
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const id = typeof r.id === 'string' ? r.id : '';
  const at = id || '(no id)';
  if (!/^[a-z0-9-]{1,40}$/.test(id)) problems.push(`${at}: id must be lower-case letters, digits and "-".`);
  const name = typeof r.name === 'string' ? r.name.trim() : '';
  if (!name || name.length > 40) problems.push(`${at}: name is missing or longer than 40 characters.`);
  const mood = typeof r.mood === 'string' ? r.mood.trim().slice(0, 160) : '';
  const tone = r.tone === 'light' ? 'light' : 'dark';
  const tokens: Record<string, string> = {};
  const rawTokens = r.tokens && typeof r.tokens === 'object' && !Array.isArray(r.tokens) ? (r.tokens as Record<string, unknown>) : {};
  for (const [k, v] of Object.entries(rawTokens)) {
    if (!/^[a-z][a-z0-9-]{1,30}$/.test(k) || typeof v !== 'string') {
      problems.push(`${at}: token "${k}" isn't a token name with a text value.`);
      continue;
    }
    const value = v.trim();
    const n = Number(value);
    if (NUMBER_TOKENS.has(k) ? !(value !== '' && Number.isFinite(n) && n >= 0 && n <= 1) : !HEX.test(value)) {
      problems.push(`${at}: token "${k}" must be ${NUMBER_TOKENS.has(k) ? 'a number from 0 to 1' : 'a colour like #1a2b3c'}.`);
      continue;
    }
    tokens[k] = value;
  }
  // Same rule as every built-in theme (CLAUDE.md Override 4): the faintest text stays readable.
  const ink5 = tokens['ink-5'] ?? BASE['ink-5'];
  for (const bg of ['bg-app', 'bg-card'] as const) {
    const ratio = contrast(ink5, tokens[bg] ?? BASE[bg]);
    if (ratio < 4.5) problems.push(`${at}: ink-5 reaches only ${ratio.toFixed(2)}:1 on ${bg}; needs 4.5:1.`);
  }
  const file = (v: unknown, what: string) => {
    if (v === undefined || v === null || v === '') return undefined;
    if (typeof v === 'string' && PATH.test(v)) return v;
    problems.push(`${at}: ${what} must be a file path inside the bucket.`);
    return undefined;
  };
  const scene = file(r.scene, 'scene');
  const picture = file(r.picture, 'picture');
  const ornaments = Array.isArray(r.ornaments) ? r.ornaments.filter((o): o is Ornament => (ORNAMENTS as readonly unknown[]).includes(o)) : [];
  if (problems.length) return { problems };
  return { theme: { id, name, mood, tone, tokens, ornaments, ...(scene ? { scene } : {}), ...(picture ? { picture } : {}) } };
}

/** The whole manifest: `{ "themes": [ … ] }`. Good themes are kept, bad ones listed with why. */
export function readOwnerManifest(raw: unknown): { themes: OwnerThemeEntry[]; problems: string[] } {
  const list = raw && typeof raw === 'object' && Array.isArray((raw as { themes?: unknown }).themes) ? ((raw as { themes: unknown[] }).themes as unknown[]) : null;
  if (!list) return { themes: [], problems: ['manifest.json must look like { "themes": [ … ] }.'] };
  const themes: OwnerThemeEntry[] = [];
  const problems: string[] = [];
  for (const entry of list.slice(0, 24)) {
    const out = readOwnerTheme(entry);
    if ('theme' in out) {
      if (themes.some((t) => t.id === out.theme.id)) problems.push(`${out.theme.id}: listed twice; the first one is used.`);
      else themes.push(out.theme);
    } else problems.push(...out.problems);
  }
  return { themes, problems };
}

/** Where the files come from: the private bucket for owners (supabaseOwnerThemes), a fake in tests. */
export interface OwnerThemeSource {
  /** The file, or null when it isn't there. Throws when the store can't be reached. */
  download(path: string): Promise<Blob | null>;
}

export type OwnerThemesState =
  | { status: 'none' }
  | { status: 'loading' }
  | { status: 'ready'; themes: OwnerTheme[]; problems: string[] }
  | { status: 'error'; message: string };

let state: OwnerThemesState = { status: 'none' };
const listeners = new Set<() => void>();
let urls: string[] = [];
let generation = 0;

function set(next: OwnerThemesState) {
  state = next;
  listeners.forEach((l) => l());
}

export const ownerThemesState = () => state;
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const useOwnerThemes = () => useSyncExternalStore(subscribe, ownerThemesState, ownerThemesState);

/** The loaded owner theme for a saved choice, if there is one. */
export function ownerThemeFor(choice: unknown, s: OwnerThemesState = state): OwnerTheme | undefined {
  if (!isOwnerThemeId(choice) || s.status !== 'ready') return undefined;
  const id = choice.slice(OWNER_PREFIX.length);
  return s.themes.find((t) => t.id === id);
}

/** Forget everything (signed out, or not an owner): links freed, the picker loses the section. */
export function clearOwnerThemes(): void {
  generation++;
  urls.forEach((u) => URL.revokeObjectURL(u));
  urls = [];
  set({ status: 'none' });
}

/** Loads the manifest and each theme's files. Call only once the server has said "owner". */
export async function loadOwnerThemes(source: OwnerThemeSource): Promise<void> {
  const mine = ++generation;
  set({ status: 'loading' });
  try {
    const blob = await source.download('manifest.json');
    if (mine !== generation) return;
    if (!blob) return set({ status: 'ready', themes: [], problems: [] });
    let raw: unknown;
    try {
      raw = JSON.parse(await blob.text());
    } catch {
      return set({ status: 'ready', themes: [], problems: ['manifest.json isn’t valid JSON.'] });
    }
    const { themes, problems } = readOwnerManifest(raw);
    const made: string[] = [];
    const url = async (path: string | undefined, theme: string, what: string) => {
      if (!path) return undefined;
      const file = await source.download(path);
      if (!file) {
        problems.push(`${theme}: ${what} ${path} isn’t in the bucket.`);
        return undefined;
      }
      const u = URL.createObjectURL(file);
      made.push(u);
      return u;
    };
    const loaded: OwnerTheme[] = [];
    for (const t of themes) {
      const sceneUrl = await url(t.scene, t.id, 'scene');
      const pictureUrl = await url(t.picture, t.id, 'picture');
      loaded.push({ ...t, ...(sceneUrl ? { sceneUrl } : {}), ...(pictureUrl ? { pictureUrl } : {}) });
    }
    if (mine !== generation) {
      made.forEach((u) => URL.revokeObjectURL(u));
      return;
    }
    urls.forEach((u) => URL.revokeObjectURL(u));
    urls = made;
    set({ status: 'ready', themes: loaded, problems });
  } catch (e) {
    if (mine === generation) set({ status: 'error', message: e instanceof Error ? e.message : 'Couldn’t load your themes.' });
  }
}
