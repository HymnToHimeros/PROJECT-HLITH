/**
 * Owner-only themes (T47). Their names, colours and pictures are never in the
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
import { ACCENT_SHAPES, MOTIF_LAYERS, TEXTURE_LAYERS } from './ornamentIds';
import { readSkin, type Skin } from './skin';
import { clearPacks, setPackSource } from './skinPack';

/** Saved in prefs.theme for an owner theme: `owner:<id>`. */
export type OwnerThemeId = `owner:${string}`;
export const OWNER_PREFIX = 'owner:';
export const isOwnerThemeId = (v: unknown): v is OwnerThemeId => typeof v === 'string' && v.startsWith(OWNER_PREFIX);

export const ORNAMENTS = ['hearts', 'bubbles', 'gold-frame', 'lace', ...MOTIF_LAYERS, ...TEXTURE_LAYERS, ...ACCENT_SHAPES] as const;
export type Ornament = (typeof ORNAMENTS)[number];

export interface OwnerThemeEntry {
  id: string;
  name: string;
  mood: string;
  tone: 'dark' | 'light';
  /** Token name (without --) → value. Colours as #rrggbb; `art-opacity` / `owner-art-opacity` as 0–1. */
  tokens: Record<string, string>;
  /** The owner's own picture for this theme, a file in the bucket. None = colours and ornaments only. */
  picture?: string;
  ornaments: Ornament[];
  /** How it dresses cards, sidebar, header, headings and controls, and its pack of pictures (skin.ts). */
  look?: Skin;
  /** Themes with the same group show as one tile in the picker that opens its looks; `variant` names this look. */
  group?: string;
  variant?: string;
}

export interface OwnerTheme extends OwnerThemeEntry {
  /** Ready to show (a blob: link made from the downloaded picture), or missing. */
  pictureUrl?: string;
}

/**
 * Colour sets to start an owner theme from (Owner console → Owner themes → Add a theme). Only
 * colours; the theme's name, picture and ornaments are the owner's and stay in the private store.
 * Each passes the same contrast rules as the built-in themes (tested).
 */
export const OWNER_PRESETS: { id: string; label: string; tone: 'dark' | 'light'; tokens: Record<string, string> }[] = [
  {
    id: 'indigo',
    label: 'Indigo night with gold and pink',
    tone: 'dark',
    tokens: {
      'bg-void': '#07061a', 'bg-app': '#0d0a26', 'bg-shell': '#120e2e', 'bg-card': '#171236', 'bg-inset': '#1d1740', 'bg-raised': '#221b49',
      'line-default': '#2a2252', 'line-strong': '#4a3b80',
      'ink-1': '#f6eefb', 'ink-2': '#ecd9f2', 'ink-3': '#d6bfe2', 'ink-4': '#c4a8d6', 'ink-5': '#c4a8d6',
      glacier: '#ffb3c9', 'rarity-top': '#f2c879', 'vent-all': '#ffd6e3', 'art-ink': '#f2c879', 'art-glow': '#6b3f9a', 'owner-art-opacity': '0.5',
    },
  },
  {
    id: 'emerald',
    label: 'Emerald velvet with gold and wine',
    tone: 'dark',
    tokens: {
      'bg-void': '#040c09', 'bg-app': '#06120e', 'bg-shell': '#081712', 'bg-card': '#0c1d17', 'bg-inset': '#11251e', 'bg-raised': '#152b23',
      'line-default': '#1b3329', 'line-strong': '#3a5a3e',
      'ink-1': '#f1ede0', 'ink-2': '#e0d8bf', 'ink-3': '#c9bf9e', 'ink-4': '#b3a983', 'ink-5': '#b3a983',
      glacier: '#e7a3b4', 'rarity-top': '#e8c06a', 'vent-all': '#e0d8bf', 'art-ink': '#d9b86a', 'art-glow': '#6e1f33', 'owner-art-opacity': '0.5',
    },
  },
  {
    id: 'blush',
    label: 'Blush and wine (light)',
    tone: 'light',
    tokens: {
      'bg-void': '#e9d3d6', 'bg-app': '#fbf1f2', 'bg-shell': '#f6e6e8', 'bg-card': '#fffafa', 'bg-inset': '#f3e1e4', 'bg-raised': '#fdf5f6',
      'line-default': '#e6ccd1', 'line-strong': '#c49aa3',
      'ink-1': '#2a0f17', 'ink-2': '#3d1822', 'ink-3': '#5a2533', 'ink-4': '#6b2e3d', 'ink-5': '#6b2e3d',
      glacier: '#8a2a46', 'rarity-top': '#855600', 'vent-all': '#f2c9d4', 'art-ink': '#a33a5a', 'art-glow': '#f0a8bc', 'owner-art-opacity': '0.35',
    },
  },
];

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
  const picture = file(r.picture, 'picture');
  const ornaments = Array.isArray(r.ornaments) ? r.ornaments.filter((o): o is Ornament => (ORNAMENTS as readonly unknown[]).includes(o)) : [];
  const skin = readSkin(r.look);
  const pack = skin ? file((r.look as Record<string, unknown>).pack, 'look.pack') : undefined;
  const look: Skin | undefined = skin ? { ...skin, ...(pack ? { pack } : {}) } : undefined;
  const label = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 40) : undefined);
  const group = label(r.group);
  const variant = label(r.variant);
  if (problems.length) return { problems };
  return { theme: { id, name, mood, tone, tokens, ornaments, ...(picture ? { picture } : {}), ...(look ? { look } : {}), ...(group ? { group } : {}), ...(variant ? { variant } : {}) } };
}

/** The whole manifest: `{ "themes": [ … ] }`. Good themes are kept, bad ones listed with why. */
export function readOwnerManifest(raw: unknown): { themes: OwnerThemeEntry[]; problems: string[] } {
  const list = raw && typeof raw === 'object' && Array.isArray((raw as { themes?: unknown }).themes) ? ((raw as { themes: unknown[] }).themes as unknown[]) : null;
  if (!list) return { themes: [], problems: ['manifest.json must look like { "themes": [ … ] }.'] };
  const themes: OwnerThemeEntry[] = [];
  const problems: string[] = [];
  for (const entry of list.slice(0, 80)) {
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
  setPackSource(null);
  clearPacks();
  urls.forEach((u) => URL.revokeObjectURL(u));
  urls = [];
  set({ status: 'none' });
}

/** Loads the manifest and each theme's files. Call only once the server has said "owner". */
export async function loadOwnerThemes(source: OwnerThemeSource): Promise<void> {
  const mine = ++generation;
  clearPacks();
  setPackSource(source);
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
      const pictureUrl = await url(t.picture, t.id, 'picture');
      loaded.push({ ...t, ...(pictureUrl ? { pictureUrl } : {}) });
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
