import { beforeEach, describe, expect, it } from 'vitest';
import { buildBackup, parseBackup, restoreBackup, summarize } from './backup';
import { mergeAdd } from './merge';
import { getPrefs, reloadPrefs, updatePrefs } from './prefs';
import { addLedgerEntry, gameData, resetUserData, setRosterEntry, setTick } from './userData';

beforeEach(() => {
  localStorage.clear();
  reloadPrefs();
  resetUserData();
});

describe('add-only merge', () => {
  it('adds missing list items and keys, never overwrites or removes', () => {
    const local = { list: [{ id: 'a', v: 1 }], rec: { x: 'mine' }, n: 5 };
    const merged = mergeAdd(local, { list: [{ id: 'a', v: 99 }, { id: 'b', v: 2 }], rec: { x: 'theirs', y: 'new' }, n: 7, extra: true });
    expect(merged).toEqual({ list: [{ id: 'a', v: 1 }, { id: 'b', v: 2 }], rec: { x: 'mine', y: 'new' }, n: 5, extra: true });
  });
  it('returns the same object when nothing is new', () => {
    const local = { a: [1, 2], b: { c: 'd' } };
    expect(mergeAdd(local, { a: [2], b: { c: 'z' } })).toBe(local);
  });
});

describe('backup', () => {
  it('a backup round-trips through parse and summarises what it holds', () => {
    addLedgerEntry('hsr', { at: '2026-10-01T10:00:00Z', currency: 'jade', kind: 'have', amount: 1000 });
    localStorage.setItem('hlith.someTool', '{"x":1}');
    const b = buildBackup(Date.UTC(2026, 9, 9));
    const parsed = parseBackup(JSON.stringify(b));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.backup.extra['hlith.someTool']).toBe('{"x":1}');
    expect(summarize(parsed.backup).games).toEqual([{ id: 'hsr', bank: 1, pulls: 0, roster: 0, teams: 0, ticks: 0 }]);
  });

  it('never puts a login remembered on this device into a backup, and never restores one from a file', () => {
    localStorage.setItem('hlith.secret.hoyolab.accounts', '[{"login":"secret"}]');
    expect(JSON.stringify(buildBackup(Date.UTC(2026, 9, 9)))).not.toContain('hlith.secret');
    const file = { ...buildBackup(Date.UTC(2026, 9, 9)), extra: { 'hlith.secret.hoyolab': 'planted', 'hlith.ok': '1' } };
    const parsed = parseBackup(JSON.stringify(file));
    expect(parsed.ok && parsed.backup.extra).toEqual({ 'hlith.ok': '1' });
    localStorage.removeItem('hlith.secret.hoyolab.accounts');
  });

  it('never puts your Assistant key into a backup file, and never restores one from a file', () => {
    localStorage.setItem('hlith.assistant.key', 'sk-ant-secret');
    localStorage.setItem('hlith.assistant.settings', '{"model":"x"}');
    const b = buildBackup();
    expect(b.extra['hlith.assistant.key']).toBeUndefined();
    expect(b.extra['hlith.assistant.settings']).toBe('{"model":"x"}');
    localStorage.clear();
    restoreBackup({ ...b, extra: { ...b.extra, 'hlith.assistant.key': 'sk-ant-from-file' } });
    expect(localStorage.getItem('hlith.assistant.key')).toBeNull();
    expect(localStorage.getItem('hlith.assistant.settings')).toBe('{"model":"x"}');
  });

  it('rejects files that are not an HLITH backup, before touching anything', () => {
    expect(parseBackup('not json').ok).toBe(false);
    expect(parseBackup('{"info":{"uigf_version":"v4.0"}}')).toEqual({ ok: false, error: expect.stringMatching(/isn’t an HLITH backup/) });
    expect(parseBackup('{"app":"PROJECT-HLITH","kind":"backup","version":1}').ok).toBe(false);
  });

  it('restore adds what is missing and never wipes what is here', () => {
    addLedgerEntry('hsr', { at: '2026-10-01T10:00:00Z', currency: 'jade', kind: 'have', amount: 1000 });
    setRosterEntry('hsr', 'c1', { owned: true, wanted: false, dupes: 2 });
    updatePrefs((p) => ({ ...p, servers: { hsr: 'eu' } }));
    const backup = buildBackup();
    // A different device: other data, other server choice.
    resetUserData();
    localStorage.clear();
    reloadPrefs();
    setRosterEntry('hsr', 'c1', { owned: true, wanted: true, dupes: 5 });
    setTick('zzz', 'income:daily', '2026-10-09T10:00:00Z');
    updatePrefs((p) => ({ ...p, servers: { hsr: 'us' } }));

    const added = restoreBackup(backup);
    expect(added).toBeGreaterThan(0);
    expect(gameData('hsr').ledger).toHaveLength(1);
    expect(gameData('hsr').roster.c1).toEqual({ owned: true, wanted: true, dupes: 5 }); // kept, not overwritten
    expect(gameData('zzz').ticks['income:daily']).toBe('2026-10-09T10:00:00Z');
    expect(getPrefs().servers.hsr).toBe('us');
    // Restoring twice adds nothing new.
    expect(restoreBackup(backup)).toBe(0);
  });
});
