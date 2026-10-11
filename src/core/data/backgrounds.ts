/**
 * Your own background pictures (T52d, Account → Customise → Background picture): one for every
 * page, one per theme, or one per page (module). The most specific wins: page, then theme,
 * then every page. Drawn softly behind the page (at most 25% strength, toned down) so text stays readable.
 *
 * Where the picture lives:
 *  - Signed in: the private `backgrounds` bucket, in your own folder (0012_backgrounds.sql);
 *    only you can read it. It's downloaded once and shown from memory.
 *  - This device only: shrunk in the browser and kept in this browser.
 * Which picture goes where, and how strongly it shows, is in your settings (prefs.backgrounds).
 */
import { useEffect, useState } from 'react';
import { backend } from './backend';
import { getPrefs, updatePrefs, usePrefs } from './prefs';

export const BACKGROUNDS_BUCKET = 'backgrounds';
export const STRENGTH_MIN = 0.06;
export const STRENGTH_MAX = 0.25;
export const STRENGTH_DEFAULT = 0.2;

export type Slot = 'all' | `theme:${string}` | `page:${string}`;
export interface BackgroundChoice {
  /** 'device' = kept in this browser; else the path in the bucket. */
  file: string;
  strength: number;
  /** Changes with every new picture, so an old copy is never shown. */
  version: number;
}

const DEVICE_KEY = (slot: Slot) => `hlith.background.${slot}`;
const SLOT = /^(all|theme:[a-z0-9:-]{1,60}|page:[a-z-]{1,30})$/;
export const isSlot = (v: unknown): v is Slot => typeof v === 'string' && SLOT.test(v);
const clampStrength = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(STRENGTH_MAX, Math.max(STRENGTH_MIN, n)) : STRENGTH_DEFAULT);

export function cleanBackgrounds(raw: unknown): Partial<Record<Slot, BackgroundChoice>> {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out: Partial<Record<Slot, BackgroundChoice>> = {};
  for (const [slot, v] of Object.entries(r)) {
    const c = v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
    if (!isSlot(slot) || !c || typeof c.file !== 'string' || !c.file) continue;
    out[slot] = { file: c.file, strength: clampStrength(c.strength), version: typeof c.version === 'number' ? c.version : 0 };
  }
  return out;
}

/** The picture to show for these slots (most specific first), if any is set. */
export function pickBackground(choices: Partial<Record<Slot, BackgroundChoice>>, slots: Slot[]): { slot: Slot; choice: BackgroundChoice } | null {
  for (const slot of slots) {
    const choice = choices[slot];
    if (choice) return { slot, choice };
  }
  return null;
}

// ── Files ─────────────────────────────────────────────────────────────
const urls = new Map<string, Promise<string | null>>();

function loadUrl(slot: Slot, choice: BackgroundChoice): Promise<string | null> {
  const key = `${slot}|${choice.file}|${choice.version}`;
  let p = urls.get(key);
  if (!p) {
    p = (async () => {
      if (choice.file === 'device') {
        try {
          return localStorage.getItem(DEVICE_KEY(slot));
        } catch {
          return null;
        }
      }
      if (!backend) return null;
      const { data, error } = await backend.storage.from(BACKGROUNDS_BUCKET).download(choice.file);
      return error || !data ? null : URL.createObjectURL(data);
    })();
    urls.set(key, p);
  }
  return p;
}

/** Saves a picture (already shrunk, a JPEG data URL) for a slot, keeping its strength. */
export async function saveBackground(slot: Slot, dataUrl: string, userId: string | undefined): Promise<void> {
  const prev = cleanBackgrounds(getPrefs().backgrounds)[slot];
  let file = 'device';
  if (backend && userId) {
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${userId}/${slot.replace(/[^a-z0-9-]+/g, '-')}.jpg`;
    const { error } = await backend.storage.from(BACKGROUNDS_BUCKET).upload(path, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '0' });
    if (error) throw new Error(`The picture didn’t upload: ${error.message}`);
    file = path;
  } else {
    try {
      localStorage.setItem(DEVICE_KEY(slot), dataUrl);
    } catch {
      throw new Error('This browser has no room left for that picture. Try a smaller one.');
    }
  }
  updatePrefs((p) => ({ ...p, backgrounds: { ...cleanBackgrounds(p.backgrounds), [slot]: { file, strength: prev?.strength ?? STRENGTH_DEFAULT, version: Date.now() } } }));
}

export function setBackgroundStrength(slot: Slot, strength: number): void {
  updatePrefs((p) => {
    const all = cleanBackgrounds(p.backgrounds);
    const cur = all[slot];
    return cur ? { ...p, backgrounds: { ...all, [slot]: { ...cur, strength: clampStrength(strength) } } } : p;
  });
}

/** Stops showing a picture there. The file itself is kept (never deleted by the app). */
export function removeBackground(slot: Slot): void {
  updatePrefs((p) => ({ ...p, backgrounds: Object.fromEntries(Object.entries(cleanBackgrounds(p.backgrounds)).filter(([s]) => s !== slot)) }));
}

/** The picture behind the page right now: { url, strength } once loaded, else null. */
export function useBackground(slots: Slot[]): { url: string; strength: number } | null {
  const choices = cleanBackgrounds(usePrefs().backgrounds);
  const picked = pickBackground(choices, slots);
  const key = picked ? `${picked.slot}|${picked.choice.file}|${picked.choice.version}` : '';
  const [loaded, setLoaded] = useState<{ key: string; url: string | null } | null>(null);
  useEffect(() => {
    if (!picked) return;
    let alive = true;
    void loadUrl(picked.slot, picked.choice).then((url) => alive && setLoaded({ key, url }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key covers the choice
  }, [key]);
  if (!picked || loaded?.key !== key || !loaded.url) return null;
  return { url: loaded.url, strength: picked.choice.strength };
}
