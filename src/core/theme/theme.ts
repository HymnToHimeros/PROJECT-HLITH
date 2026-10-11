/**
 * The theme (Account → Theme). The choice lives in prefs and is applied as
 * <html data-theme="…" data-tone="dark|light">; the token files switch every colour
 * at once, and ThemeArt draws that theme's background. An unknown saved value
 * (from an older or newer copy of HLITH) shows Glacier and is left as it was saved.
 *
 * Owner-only themes (`owner:<id>`, ownerThemes.ts) come from the owner's private storage: their
 * colours are set on <html> directly over Glacier's, and only once they have loaded for an
 * owner. Anyone else, or before they load, sees Glacier and the saved choice is kept.
 */
import { useEffect } from 'react';
import { getPrefs, updatePrefs, usePrefs } from '../data/prefs';
import { applyLook, lookOf, setOwnerLook } from './look';
import { isOwnerThemeId, ownerThemeFor, useOwnerThemes, type OwnerTheme, type OwnerThemeId } from './ownerThemes';
import { isTheme, themeInfo, type Theme } from './themes';

export { THEMES, THEME_IDS, isTheme, themeInfo, type Theme, type ThemeInfo } from './themes';

const known = (theme: unknown): Theme => (isTheme(theme) ? theme : 'dark');

/** The owner theme's own token names currently set on <html>, so switching away removes them. */
let ownerTokens: string[] = [];

export function applyTheme(theme: unknown): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  for (const name of ownerTokens) root.style.removeProperty(name);
  ownerTokens = [];
  // The accent (look.ts) is put back on top after the theme's own colours.
  root.style.removeProperty('--glacier');
  delete root.dataset.accent;
  const owner = ownerThemeFor(theme);
  setOwnerLook(owner ? { surfaces: ['bg-app', 'bg-card', 'bg-shell', 'bg-inset', 'bg-raised'].flatMap((k) => owner.tokens[k] ?? []), glacier: owner.tokens.glacier } : { surfaces: [] });
  if (owner) {
    root.dataset.theme = 'owner';
    root.dataset.tone = owner.tone;
    root.dataset.ornaments = owner.ornaments.join(' ');
    for (const [k, v] of Object.entries(owner.tokens)) {
      root.style.setProperty(`--${k}`, v);
      ownerTokens.push(`--${k}`);
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', owner.tokens['bg-app'] ?? '#08090b');
    applyLook(lookOf(getPrefs()));
    return;
  }
  delete root.dataset.ornaments;
  const info = themeInfo(known(theme));
  root.dataset.theme = info.id;
  root.dataset.tone = info.tone;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', info.app);
  applyLook(lookOf(getPrefs()));
}

/** Applies the saved theme whenever it changes (or an owner theme finishes loading). */
export function useTheme(): Theme {
  const choice = usePrefs().theme;
  const owners = useOwnerThemes();
  useEffect(() => applyTheme(choice), [choice, owners]);
  return known(choice);
}

/** The owner theme in use right now, once loaded; undefined otherwise. */
export function useOwnerTheme(): OwnerTheme | undefined {
  return ownerThemeFor(usePrefs().theme, useOwnerThemes());
}

/** The saved choice: a built-in theme (unknown = Glacier), or an owner theme's id (shown once it loads). */
export const savedTheme = (): Theme | OwnerThemeId => {
  const t = getPrefs().theme;
  return isOwnerThemeId(t) ? t : known(t);
};

export function setTheme(theme: Theme | OwnerThemeId): void {
  updatePrefs((p) => ({ ...p, theme }));
  applyTheme(theme);
}
