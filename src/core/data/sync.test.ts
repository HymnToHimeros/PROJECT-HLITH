import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPrefs, reloadPrefs, updatePrefs, type Prefs } from './prefs';
import { getSyncStatus, startSync, type SettingsStore } from './sync';

function memoryStore(initial: { data: Prefs; updatedAt: number } | null) {
  let saved = initial;
  const store: SettingsStore & { saved: () => typeof saved } = {
    load: async () => saved,
    save: async (data) => {
      saved = { data, updatedAt: data.updatedAt };
    },
    saved: () => saved,
  };
  return store;
}

const prefsWith = (servers: Record<string, string>, updatedAt: number): Prefs => ({
  version: 1,
  updatedAt,
  games: null,
  layouts: {},
  servers,
  lastModule: {},
});

let stop: (() => void) | undefined;
beforeEach(() => {
  localStorage.clear();
  reloadPrefs();
});
afterEach(() => {
  stop?.();
  vi.useRealTimers();
});

describe('settings sync', () => {
  it('first sign-in uploads what this device already has', async () => {
    updatePrefs((p) => ({ ...p, servers: { hsr: 'europe' } }));
    const store = memoryStore(null);
    stop = await startSync(store);
    expect(store.saved()?.data.servers).toEqual({ hsr: 'europe' });
    expect(getSyncStatus().state).toBe('synced');
  });

  it('a newer account copy replaces this device, and the old copy is kept', async () => {
    updatePrefs((p) => ({ ...p, servers: { hsr: 'asia' } }));
    const store = memoryStore({ data: prefsWith({ hsr: 'europe' }, Date.now() + 10_000), updatedAt: Date.now() + 10_000 });
    stop = await startSync(store);
    expect(getPrefs().servers).toEqual({ hsr: 'europe' });
    expect(JSON.parse(localStorage.getItem('hlith.prefs.before-sync') ?? '{}').servers).toEqual({ hsr: 'asia' });
  });

  it('a newer device copy is uploaded', async () => {
    updatePrefs((p) => ({ ...p, servers: { zzz: 'america' } }));
    const store = memoryStore({ data: prefsWith({ zzz: 'asia' }, 1), updatedAt: 1 });
    stop = await startSync(store);
    expect(store.saved()?.data.servers).toEqual({ zzz: 'america' });
  });

  it('later edits are saved in one batch', async () => {
    vi.useFakeTimers();
    const store = memoryStore(null);
    const save = vi.spyOn(store, 'save');
    stop = await startSync(store, 1000);
    save.mockClear();
    updatePrefs((p) => ({ ...p, servers: { hsr: 'europe' } }));
    updatePrefs((p) => ({ ...p, servers: { hsr: 'asia' } }));
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(store.saved()?.data.servers).toEqual({ hsr: 'asia' });
  });

  it('reports failure honestly and keeps working on this device', async () => {
    const store: SettingsStore = { load: async () => Promise.reject(new Error('offline')), save: async () => {} };
    stop = await startSync(store);
    expect(getSyncStatus()).toEqual({ state: 'failed', message: 'offline' });
    updatePrefs((p) => ({ ...p, servers: { hsr: 'europe' } }));
    expect(getPrefs().servers).toEqual({ hsr: 'europe' });
  });
});
