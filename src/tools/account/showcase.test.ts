import { describe, expect, it } from 'vitest';
import type { BacklogItem, Character, GameContract } from '../../core/contract';
import { EMPTY_GAME, type GameUserData } from '../../core/data/userData';
import { showcaseCards, type ShowcaseInput } from './showcase';

const game = {
  id: 'aa',
  short: 'AA',
  name: 'Game A',
  vent: '#A99BFF',
  servers: [{ id: 'eu', label: 'Europe', utcOffset: 1 }],
  bannerTypes: [
    { id: 'char', label: 'Character banner' },
    { id: 'weap', label: 'Weapon banner' },
  ],
} as unknown as GameContract;

const chars: Character[] = [
  { id: 'c1', name: 'Ash', rarity: 'top', element: 'fire', role: 'dps' },
  { id: 'c2', name: 'Birch', rarity: 'mid', element: 'fire', role: 'dps' },
];
const items: BacklogItem[] = [
  { id: 'b1', category: 'story', title: 'Ch 1', total: 10, reward: 100, currency: 'gem' } as BacklogItem,
  { id: 'b2', category: 'story', title: 'Ch 2', total: 10, reward: 100, currency: 'gem' } as BacklogItem,
];

const input = (user: Partial<GameUserData> = {}, over: Partial<ShowcaseInput> = {}): ShowcaseInput => ({
  games: [game],
  servers: {},
  data: { aa: { ...EMPTY_GAME, ...user } },
  characters: { aa: chars },
  backlog: { aa: items },
  account: null,
  pinned: {},
  ...over,
});

describe('profile showcase', () => {
  it('with no data every stat card is empty with a place to add it, never a 0', () => {
    const c = showcaseCards(input());
    for (const id of ['characters', 'pulls', 'pity', 'backlog', 'sign-in', 'member-since'] as const) expect(c[id].empty).toBe(true);
    expect(c.pulls.fix).toEqual({ label: 'Import pull history', module: 'pulls', tab: 'history' });
    expect(c.characters.fix).toEqual({ label: 'Open Roster', module: 'roster', tab: 'characters' });
    expect(c['sign-in'].fix).toEqual({ label: 'About sign-in', section: 'sign-in' });
    expect(c.games).toMatchObject({ empty: false, lines: [{ server: null }], fix: { section: 'game-settings' } });
  });

  it('counts owned characters and shows only owned pins', () => {
    const c = showcaseCards(
      input({ roster: { c1: { owned: true, wanted: false, dupes: 1 }, c2: { owned: false, wanted: true, dupes: 0 } } }, { pinned: { aa: ['c2', 'c1', 'ghost'] } }),
    );
    expect(c.characters).toMatchObject({ empty: false, lines: [{ owned: 1 }] });
    if (c.characters.id === 'characters') expect(c.characters.lines[0]?.pinned.map((x) => x.id)).toEqual(['c1']);
  });

  it('pulls and pity come from imported history, per banner that has pulls', () => {
    const pulls = [
      { id: '1', bannerType: 'char', itemId: 'c1', name: 'Ash', rarity: 'top' as const, time: '2026-09-01T00:00:00Z', featured: true },
      { id: '2', bannerType: 'char', itemId: 'x', name: 'x', rarity: 'low' as const, time: '2026-09-02T00:00:00Z' },
    ];
    const c = showcaseCards(input({ pulls }, { servers: { aa: 'eu' } }));
    expect(c.pulls).toMatchObject({ empty: false, lines: [{ total: 2, tops: 1 }] });
    expect(c.pity).toMatchObject({ empty: false, lines: [{ banners: [{ id: 'char', pity: 1, guaranteed: { known: true, value: false } }] }] });
    expect(c.games).toMatchObject({ lines: [{ server: 'Europe' }] });
    expect(c.games.fix).toBeUndefined();
  });

  it('backlog: a percentage only when every item has a count', () => {
    const part = showcaseCards(input({ backlog: { b1: 10 } }));
    expect(part.backlog).toMatchObject({ empty: false, lines: [{ counted: 1, items: 2, done: null }] });
    const full = showcaseCards(input({ backlog: { b1: 10, b2: 5 } }));
    expect(full.backlog).toMatchObject({ lines: [{ done: 0.75 }] });
    // An empty built-in list: nothing to show (no examples on the profile).
    expect(showcaseCards(input({ backlog: { b1: 10 } }, { backlog: { aa: [] } })).backlog.empty).toBe(true);
  });

  it('sign-in methods and member since come from the session', () => {
    const c = showcaseCards(input({}, { account: { identities: ['discord', 'google'], provider: 'discord', createdAt: '2026-01-15T00:00:00Z' } }));
    expect(c['sign-in']).toMatchObject({ empty: false, methods: ['discord', 'google'] });
    expect(c['member-since']).toMatchObject({ empty: false, since: '2026-01-15T00:00:00Z' });
  });
});
