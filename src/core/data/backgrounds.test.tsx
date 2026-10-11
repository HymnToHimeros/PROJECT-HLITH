import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanBackgrounds, pickBackground, removeBackground, saveBackground, STRENGTH_MAX } from './backgrounds';
import { getPrefs, reloadPrefs } from './prefs';

describe('your own background pictures (T52d)', () => {
  afterEach(() => {
    localStorage.clear();
    reloadPrefs();
  });

  it('keeps only real slots and clamps the strength', () => {
    expect(cleanBackgrounds({ all: { file: 'device', strength: 9, version: 1 }, 'page:../x': { file: 'a' }, 'theme:dark': { file: '' } })).toEqual({ all: { file: 'device', strength: STRENGTH_MAX, version: 1 } });
  });

  it('the most specific picture wins: page, then theme, then every page', () => {
    const c = cleanBackgrounds({ all: { file: 'a', strength: 0.1, version: 1 }, 'theme:dark': { file: 'b', strength: 0.1, version: 1 } });
    expect(pickBackground(c, ['page:today', 'theme:dark', 'all'])?.slot).toBe('theme:dark');
    expect(pickBackground(c, ['page:today', 'theme:light', 'all'])?.slot).toBe('all');
    expect(pickBackground({}, ['all'])).toBeNull();
  });

  it('on this device: saved in the browser; "stop showing" keeps the file', async () => {
    await saveBackground('page:today', 'data:image/jpeg;base64,AAAA', undefined);
    expect(getPrefs().backgrounds?.['page:today']).toMatchObject({ file: 'device' });
    expect(localStorage.getItem('hlith.background.page:today')).toBe('data:image/jpeg;base64,AAAA');
    removeBackground('page:today');
    expect(getPrefs().backgrounds).toEqual({});
    expect(localStorage.getItem('hlith.background.page:today')).not.toBeNull();
  });

  it('toned down so its strongest spot moves the page colour no more than theme art may (16%)', () => {
    const css = readFileSync(resolve(__dirname, '../theme/art.module.css'), 'utf8');
    const filter = (sel: string) => {
      const m = new RegExp(`${sel}\\s*\\{[^}]*filter: contrast\\(([\\d.]+)\\) brightness\\(([\\d.]+)\\)`).exec(css);
      return m ? [Number(m[1]), Number(m[2])] : null;
    };
    const dark = filter('\\n\\.yourPicture');
    const light = filter("data-tone='light'\\] \\.yourPicture");
    expect(dark && light).toBeTruthy();
    const [dc, db] = dark as [number, number];
    const [lc, lb] = light as [number, number];
    // Dark themes: a white pixel after the filter, at full strength.
    expect(((1 - 0.5) * dc + 0.5) * db * STRENGTH_MAX).toBeLessThanOrEqual(0.16);
    // Light themes: a black pixel after the filter, at full strength.
    expect((1 - Math.min(1, (0 - 0.5) * lc + 0.5) * lb) * STRENGTH_MAX).toBeLessThanOrEqual(0.16);
  });
});
