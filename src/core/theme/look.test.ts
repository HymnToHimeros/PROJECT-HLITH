import { afterEach, describe, expect, it } from 'vitest';
import { reloadPrefs, updatePrefs } from '../data/prefs';
import { accentValue, ACCENT_VALUE, applyLook, cleanLook } from './look';
import { applyTheme } from './theme';

const root = document.documentElement;

describe('Account → Theme → Look (T52)', () => {
  afterEach(() => {
    localStorage.clear();
    reloadPrefs();
    applyTheme('dark');
  });

  it('keeps only known choices; the defaults are left out', () => {
    expect(cleanLook({ accent: 'rose', textSize: 'huge', spacing: 'normal', corners: 'round' })).toEqual({ accent: 'rose', corners: 'round' });
    expect(cleanLook(null)).toEqual({});
  });

  it('puts the accent on --glacier for the theme’s tone, and takes it off again', () => {
    applyTheme('dark');
    applyLook({ accent: 'gold' });
    expect(root.style.getPropertyValue('--glacier')).toBe(ACCENT_VALUE.gold.dark);
    applyTheme('light'); // a theme change re-applies the saved look (none saved here)
    expect(root.style.getPropertyValue('--glacier')).toBe('');
    updatePrefs((p) => ({ ...p, look: { accent: 'gold' } }));
    applyTheme('light');
    expect(root.style.getPropertyValue('--glacier')).toBe(ACCENT_VALUE.gold.light);
    applyLook({});
    expect(root.style.getPropertyValue('--glacier')).toBe('');
    expect(root.dataset.accent).toBeUndefined();
  });

  it('on an owner theme, an accent that would be hard to read is left off', () => {
    expect(accentValue('gold', 'dark', ['#08090b'])).toBe(ACCENT_VALUE.gold.dark);
    expect(accentValue('gold', 'dark', ['#d0c090'])).toBeNull();
    expect(accentValue('theme', 'dark')).toBeNull();
  });

  it('text size, spacing and corners are attributes the tokens key off', () => {
    applyLook({ textSize: 'larger', spacing: 'compact', corners: 'sharp' });
    expect([root.dataset.text, root.dataset.spacing, root.dataset.corners]).toEqual(['larger', 'compact', 'sharp']);
    applyLook({});
    expect([root.dataset.text, root.dataset.spacing, root.dataset.corners]).toEqual([undefined, undefined, undefined]);
  });
});
