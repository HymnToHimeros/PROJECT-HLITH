// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { MODULE_IDS } from '../src/core/contract';
import {
  clearFeatures,
  clearGames,
  featuresAt,
  gameProblems,
  hiddenIn,
  listGames,
  notAvailable,
  phoneBar,
  registerFeature,
  registerGame,
  slot,
  defaultLayout,
} from '../src/core/registry';
import { template } from '../src/games/_template/contract';
import { games } from '../src/games';
import { fakeGame } from './fixtures/fake-game/contract';

describe('the real game records', () => {
  it.each(games.map((g) => [g.id, g] as const))('%s passes every registry check', (_id, g) => {
    expect(gameProblems(g)).toEqual([]);
  });

  it('every current game has every module (Override 1)', () => {
    for (const g of games) expect([...g.modules].sort()).toEqual([...MODULE_IDS].sort());
  });

  it('the template is a valid starting point', () => {
    expect(gameProblems(template)).toEqual([]);
  });

  it('only HSR and ZZZ ship, with unique ids', () => {
    expect(games.map((g) => g.id)).toEqual(['hsr', 'zzz']);
  });
});

describe('a new, unlike game needs no core change (PLAN §2b)', () => {
  beforeEach(() => {
    clearGames();
    clearFeatures();
  });

  it('registers next to the real games', () => {
    for (const g of [...games, fakeGame]) registerGame(g);
    expect(listGames().map((g) => g.id)).toEqual(['hsr', 'zzz', 'fake-quest']);
  });

  it('shows only its own modules, with the rest marked not available', () => {
    const all = [...games, fakeGame];
    const layout = defaultLayout(all, 'fake-quest');
    expect(slot(all, 'fake-quest', layout)).toEqual(fakeGame.defaultOrder);
    expect(notAvailable(all, 'fake-quest')).toEqual(['farm', 'intel']);
    expect(phoneBar(slot(all, 'fake-quest', layout)).bar).toEqual(['today', 'roster', 'pulls', 'events']);
  });

  it('All games still offers every module, and never says "not available"', () => {
    const all = [...games, fakeGame];
    expect(slot(all, 'all', defaultLayout(all, 'all'))).toEqual([...MODULE_IDS]);
    expect(notAvailable(all, 'all')).toEqual([]);
    expect(hiddenIn(all, 'all', { order: [], hidden: ['farm'] })).toEqual(['farm']);
  });

  it('a data-driven feature (like Kit check) switches on by data, not by game name', () => {
    registerFeature({
      id: 'kit-check',
      module: 'roster',
      label: 'Kit check',
      places: ['teams-tab', 'character-page'],
      available: (g) => Boolean(g.data.kits),
      component: async () => ({ default: () => null }),
    });
    const at = (id: string) => {
      const g = [...games, fakeGame].find((x) => x.id === id);
      return g ? featuresAt('roster', 'character-page', g)[0]?.available : undefined;
    };
    expect(at('zzz')).toBe(true);
    expect(at('hsr')).toBe(false);
    expect(at('fake-quest')).toBe(false);
  });
});
