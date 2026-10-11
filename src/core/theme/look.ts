/**
 * Account → Theme → Look (T52): accent colour, text size, spacing and card corners, on top of
 * whichever theme you use. Applied on <html>:
 *  - accent: sets --glacier (the accent token every screen already uses for links, markers and
 *    "your name" colour) to the accent's value for the theme's tone. Every accent is tested at
 *    4.5:1 on every surface of every built-in theme of that tone (tests/look.test.ts); on an owner
 *    theme it is checked against that theme's own colours here and left off if it doesn't pass.
 *  - text size: data-text="large|larger" zooms the app a step, so text and the space around it
 *    grow together and nothing overlaps.
 *  - spacing: data-spacing="compact|roomy" changes the spacing tokens (--s-3 … --s-7).
 *  - corners: data-corners="sharp|round" changes the card and button radius tokens.
 * Missing = the theme as designed. No React in the apply functions.
 */
import { useEffect } from 'react';
import { usePrefs, type Prefs } from '../data/prefs';
import { contrast } from './contrast';

export const ACCENTS = ['theme', 'frost', 'rose', 'gold', 'jade', 'violet'] as const;
export type Accent = (typeof ACCENTS)[number];
export const ACCENT_LABEL: Record<Accent, string> = { theme: 'The theme’s own', frost: 'Frost', rose: 'Rose', gold: 'Gold', jade: 'Jade', violet: 'Violet' };
/** Accent → value on dark surfaces / on light surfaces. */
export const ACCENT_VALUE: Record<Exclude<Accent, 'theme'>, { dark: string; light: string }> = {
  frost: { dark: '#8cc8ec', light: '#1b5a85' },
  rose: { dark: '#f5a8c6', light: '#962456' },
  gold: { dark: '#ebc26c', light: '#6e4b00' },
  jade: { dark: '#74d8ad', light: '#1a6646' },
  violet: { dark: '#bfaaf7', light: '#5a3aa8' },
};

export const TEXT_SIZES = ['normal', 'large', 'larger'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];
export const TEXT_SIZE_LABEL: Record<TextSize, string> = { normal: 'Normal', large: 'Large', larger: 'Larger' };

export const SPACINGS = ['compact', 'normal', 'roomy'] as const;
export type Spacing = (typeof SPACINGS)[number];
export const SPACING_LABEL: Record<Spacing, string> = { compact: 'Compact', normal: 'Normal', roomy: 'Roomy' };

export const CORNERS = ['sharp', 'soft', 'round'] as const;
export type Corners = (typeof CORNERS)[number];
export const CORNERS_LABEL: Record<Corners, string> = { sharp: 'Sharp', soft: 'Soft', round: 'Round' };

export interface Look {
  accent?: Accent;
  textSize?: TextSize;
  spacing?: Spacing;
  corners?: Corners;
}

const pick = <T extends string>(list: readonly T[], v: unknown): T | undefined => ((list as readonly unknown[]).includes(v) ? (v as T) : undefined);

/** The saved look, with anything unknown dropped. */
export function cleanLook(raw: unknown): Look {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out: Look = {};
  const accent = pick(ACCENTS, r.accent);
  const textSize = pick(TEXT_SIZES, r.textSize);
  const spacing = pick(SPACINGS, r.spacing);
  const corners = pick(CORNERS, r.corners);
  if (accent && accent !== 'theme') out.accent = accent;
  if (textSize && textSize !== 'normal') out.textSize = textSize;
  if (spacing && spacing !== 'normal') out.spacing = spacing;
  if (corners && corners !== 'soft') out.corners = corners;
  return out;
}

/**
 * The accent's value for a tone, or null when it shouldn't apply: the theme's own accent, or
 * (for an owner theme, whose colours are given) one that wouldn't reach 4.5:1 on its surfaces.
 */
export function accentValue(accent: Accent | undefined, tone: 'dark' | 'light', surfaces: string[] = []): string | null {
  if (!accent || accent === 'theme') return null;
  const value = ACCENT_VALUE[accent][tone];
  return surfaces.every((s) => !/^#[0-9a-f]{6}$/i.test(s) || contrast(value, s) >= 4.5) ? value : null;
}

/** Applies the look on <html>. `surfaces` = the current owner theme's own surface colours, if any. */
export function applyLook(look: Look, surfaces: string[] = owner.surfaces): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const l = cleanLook(look);
  const tone = root.dataset.tone === 'light' ? 'light' : 'dark';
  const value = accentValue(l.accent, tone, surfaces);
  if (value) {
    root.style.setProperty('--glacier', value);
    root.dataset.accent = l.accent;
  } else if (root.dataset.accent) {
    // Taken off: the theme's own accent shows again (an owner theme's own value is put back).
    if (owner.glacier) root.style.setProperty('--glacier', owner.glacier);
    else root.style.removeProperty('--glacier');
    delete root.dataset.accent;
  }
  for (const [attr, v] of [
    ['text', l.textSize],
    ['spacing', l.spacing],
    ['corners', l.corners],
  ] as const) {
    if (v) root.setAttribute(`data-${attr}`, v);
    else root.removeAttribute(`data-${attr}`);
  }
}

export const lookOf = (p: Pick<Prefs, 'look'>): Look => cleanLook(p.look);

/** Keeps the look applied as it changes. Theme changes re-apply it too (theme.ts). */
export function useLook(): Look {
  const look = lookOf(usePrefs());
  const key = JSON.stringify(look);
  useEffect(() => {
    applyLook(JSON.parse(key) as Look);
  }, [key]);
  return look;
}

/** Set by theme.ts while an owner theme is on: its surface colours (for the accent check) and its own accent. */
let owner: { surfaces: string[]; glacier?: string | undefined } = { surfaces: [] };
export const setOwnerLook = (next: { surfaces: string[]; glacier?: string | undefined }) => {
  owner = next;
};
