import { describe, expect, it, vi } from 'vitest';
import type { GameContract } from '../contract';
import { applyCatalog, seedLoaders, withCatalog, type CatalogRow } from './catalog';
import { catalogRows } from './catalogSource';

const row = (kind: CatalogRow['kind'], id: string, data: Record<string, unknown>, status: CatalogRow['status'] = 'active', game_id = 'aa'): CatalogRow => ({
  game_id,
  kind,
  id,
  data,
  status,
  source: 'owner',
  updated_at: '2026-10-10T00:00:00Z',
});

const seed = {
  id: 'aa',
  data: {
    characters: async () => [
      { id: 'c1', name: 'Alpha', rarity: 'top', element: 'fire', role: 'attack' },
      { id: 'c2', name: 'Beta', rarity: 'mid', element: 'ice', role: 'attack' },
    ],
    events: async () => [],
    banners: async () => [],
    backlog: async () => [{ id: 'b1', category: 'story', title: 'Chapter 1', total: 3, reward: null, currency: 'gem' }],
    versions: async () => [],
    materials: async () => [{ id: 'm1' }],
    teams: async () => [],
  },
} as unknown as GameContract;

describe('the lists every screen reads', () => {
  it('lays the owner’s rows over the seed list: changes, additions, and retired items drop out', () => {
    const out = applyCatalog(
      [
        { id: 'a', title: 'A' },
        { id: 'b', title: 'B' },
      ],
      [row('event', 'a', { title: 'A (fixed)' }), row('event', 'b', {}, 'retired'), row('event', 'n', { title: 'New' }), row('event', 'gone', { title: 'Old' }, 'retired')],
    );
    expect(out).toEqual([
      { id: 'a', title: 'A (fixed)' },
      { id: 'n', title: 'New' },
    ]);
  });

  it('wraps a game’s list loaders; only this game’s rows of the right kind count; other loaders are untouched', async () => {
    const source = vi.fn(async () => [
      row('character', 'c2', {}, 'retired'),
      row('character', 'c3', { name: 'Gamma', rarity: 'top', element: 'ice', role: 'attack' }),
      row('event', 'e1', { title: 'Festival', kind: 'event', start: '2026-10-12T00:00:00Z', end: '2026-10-20T00:00:00Z', reward: null, currency: 'gem' }),
      row('backlog', 'b1', { total: 4 }),
      row('event', 'x', { title: 'Other game' }, 'active', 'bb'),
    ]);
    const game = withCatalog(seed, source);
    expect((await game.data.characters()).map((c) => c.name)).toEqual(['Alpha', 'Gamma']);
    expect((await game.data.events()).map((e) => e.title)).toEqual(['Festival']);
    expect(await game.data.backlog()).toEqual([{ id: 'b1', category: 'story', title: 'Chapter 1', total: 4, reward: null, currency: 'gem' }]);
    expect(await game.data.materials()).toEqual([{ id: 'm1' }]);
    // Owner console → Lists still sees the game files' own versions.
    expect(await seedLoaders(game).characters()).toHaveLength(2);
    expect(seedLoaders(seed)).toBe(seed.data);
  });

  it('a failing source gives the seed list unchanged', async () => {
    const game = withCatalog(seed, () => Promise.reject(new Error('offline')));
    expect(await game.data.characters()).toHaveLength(2);
  });

  it('without a server, or signed out, there are no owner rows', async () => {
    expect(await catalogRows(null)).toEqual([]);
    const signedOut = { auth: { getSession: async () => ({ data: { session: null } }) } } as unknown as Parameters<typeof catalogRows>[0];
    expect(await catalogRows(signedOut)).toEqual([]);
  });
});
