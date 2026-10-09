import { beforeEach, describe, expect, it } from 'vitest';
import { updatePrefs } from '../../core/data/prefs';
import { addLedgerEntry } from '../../core/data/userData';
import { forgetKey, KEY_STORAGE, looksLikeKey, maskKey, readKey, saveKey } from './keyStore';
import { updateSettings } from './settings';

const KEY = 'sk-ant-api03-TESTKEY_abcdefghijklmnop1234';

const everywhere = () => {
  const found: string[] = [];
  for (const [name, st] of [
    ['local', localStorage],
    ['session', sessionStorage],
  ] as const) {
    for (let i = 0; i < st.length; i++) {
      const k = st.key(i) as string;
      if ((st.getItem(k) ?? '').includes(KEY)) found.push(`${name}:${k}`);
    }
  }
  return found;
};

describe('your Claude key is kept only where you choose', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('"on this device": only in this browser’s local storage, under one key', () => {
    saveKey(KEY, 'device');
    // Other saves (settings, data, prefs) never pick it up.
    updatePrefs((p) => ({ ...p }));
    addLedgerEntry('aa', { at: '2026-10-09T10:00:00Z', currency: 'gem', kind: 'have', amount: 1 });
    updateSettings((s) => ({ ...s, webSearch: false }));
    expect(everywhere()).toEqual([`local:${KEY_STORAGE}`]);
    expect(readKey()).toEqual({ key: KEY, place: 'device' });
  });

  it('"this tab only": only in session storage', () => {
    saveKey(KEY, 'session');
    expect(everywhere()).toEqual([`session:${KEY_STORAGE}`]);
    expect(readKey()?.place).toBe('session');
  });

  it('switching place moves it (never in both)', () => {
    saveKey(KEY, 'device');
    saveKey(KEY, 'session');
    expect(everywhere()).toEqual([`session:${KEY_STORAGE}`]);
  });

  it('"Forget key" removes it everywhere', () => {
    saveKey(KEY, 'device');
    forgetKey();
    expect(everywhere()).toEqual([]);
    expect(readKey()).toBeNull();
  });

  it('checks the shape and never shows the whole key', () => {
    expect(looksLikeKey(KEY)).toBe(true);
    expect(looksLikeKey('hello')).toBe(false);
    expect(maskKey(KEY)).toBe('sk-ant-…1234');
  });
});
