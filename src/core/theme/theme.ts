/**
 * Dark or light (Account → Theme). The choice lives in prefs and is applied as
 * <html data-theme="…">; tokens-light.css switches every token at once.
 */
import { useEffect } from 'react';
import { getPrefs, updatePrefs, usePrefs, type Theme } from '../data/prefs';

export function applyTheme(theme: Theme | undefined): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme ?? 'dark';
}

/** Applies the saved theme whenever it changes. */
export function useTheme(): Theme {
  const theme = usePrefs().theme ?? 'dark';
  useEffect(() => applyTheme(theme), [theme]);
  return theme;
}

export const savedTheme = (): Theme => getPrefs().theme ?? 'dark';

export function setTheme(theme: Theme): void {
  updatePrefs((p) => ({ ...p, theme }));
  applyTheme(theme);
}
