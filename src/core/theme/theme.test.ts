import { beforeEach, describe, expect, it } from 'vitest';
import { getPrefs, reloadPrefs, updatePrefs } from '../data/prefs';
import { applyTheme, isTheme, savedTheme, setTheme, THEME_IDS, THEMES, themeInfo } from './theme';

beforeEach(() => {
  localStorage.clear();
  reloadPrefs();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-tone');
  document.head.innerHTML = '<meta name="theme-color" content="#08090B" />';
});

describe('themes', () => {
  it('Glacier (id dark) is the default and comes first; every theme has a name and a mood', () => {
    expect(THEMES[0]?.id).toBe('dark');
    expect(THEMES[0]?.name).toBe('Glacier');
    expect(THEMES.map((t) => t.id).sort()).toEqual([...THEME_IDS].sort());
    for (const t of THEMES) expect(t.name.length * t.mood.length).toBeGreaterThan(0);
    expect(savedTheme()).toBe('dark');
  });

  it('applies the theme, its tone and the address-bar colour to the page', () => {
    for (const t of THEMES) {
      applyTheme(t.id);
      expect(document.documentElement.dataset.theme).toBe(t.id);
      expect(document.documentElement.dataset.tone).toBe(t.tone);
      expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(t.app);
    }
  });

  it('an unknown saved theme (older or newer copy of HLITH) shows Glacier, and the saved value is left alone', () => {
    updatePrefs((p) => ({ ...p, theme: 'nebula' as never }));
    expect(savedTheme()).toBe('dark');
    applyTheme(getPrefs().theme);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(getPrefs().theme).toBe('nebula');
    expect(isTheme('nebula')).toBe(false);
    expect(themeInfo('nebula').id).toBe('dark');
  });

  it('setTheme saves to settings (so it syncs) and applies at once', () => {
    setTheme('candlelight');
    expect(getPrefs().theme).toBe('candlelight');
    expect(document.documentElement.dataset.theme).toBe('candlelight');
    reloadPrefs();
    expect(savedTheme()).toBe('candlelight');
  });
});
