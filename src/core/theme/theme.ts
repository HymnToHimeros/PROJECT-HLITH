/**
 * The theme (Account → Theme). The choice lives in prefs and is applied as
 * <html data-theme="…" data-tone="dark|light">; the token files switch every colour
 * at once, and ThemeArt draws that theme's background. An unknown saved value
 * (from an older or newer copy of HLITH) shows Glacier and is left as it was saved.
 */
import { useEffect } from 'react';
import { getPrefs, updatePrefs, usePrefs } from '../data/prefs';
import { isTheme, themeInfo, type Theme } from './themes';

export { THEMES, THEME_IDS, isTheme, themeInfo, type Theme, type ThemeInfo } from './themes';

const known = (theme: unknown): Theme => (isTheme(theme) ? theme : 'dark');

export function applyTheme(theme: unknown): void {
  if (typeof document === 'undefined') return;
  const info = themeInfo(known(theme));
  const root = document.documentElement;
  root.dataset.theme = info.id;
  root.dataset.tone = info.tone;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', info.app);
}

/** Applies the saved theme whenever it changes. */
export function useTheme(): Theme {
  const theme = known(usePrefs().theme);
  useEffect(() => applyTheme(theme), [theme]);
  return theme;
}

export const savedTheme = (): Theme => known(getPrefs().theme);

export function setTheme(theme: Theme): void {
  updatePrefs((p) => ({ ...p, theme }));
  applyTheme(theme);
}
