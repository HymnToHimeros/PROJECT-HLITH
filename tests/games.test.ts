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
import { duplicateIds } from '../src/core/data/catalog';

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
    const layout = defaultLayout();
    expect(slot(all, 'fake-quest', layout)).toEqual(['today', 'pulls', 'roster', 'calendar', 'events', 'banners', 'backlog']);
    expect(notAvailable(all, 'fake-quest')).toEqual(['farm', 'intel']);
    expect(phoneBar(slot(all, 'fake-quest', layout)).bar).toEqual(['today', 'pulls', 'roster', 'calendar']);
  });

  it('All games still offers every module, and never says "not available"', () => {
    const all = [...games, fakeGame];
    expect(slot(all, 'all', defaultLayout())).toEqual([...MODULE_IDS]);
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
    // HSR has kit data since LOGIC-CORE's group A (Override 1: "HSR later"); a game without it stays off.
    expect(at('hsr')).toBe(true);
    expect(at('fake-quest')).toBe(false);
  });
});

describe('built-in list ids are unique in every game', () => {
  it.each(games.map((g) => [g.id, g] as const))('%s', async (_id, g) => {
    const lists = await Promise.all([
      g.data.characters(),
      g.data.banners(),
      g.data.events(),
      g.data.backlog(),
      g.data.materials(),
      g.data.teams(),
      g.data.versions(),
    ]);
    for (const list of lists) expect(duplicateIds(list)).toEqual([]);
  });
});

describe('history mapping of the real games', () => {
  it('HSR and ZZZ map every gacha type onto a banner type they have', () => {
    for (const g of games) {
      expect(g.historyMapping, g.id).toBeDefined();
      const types = new Set(g.bannerTypes.map((b) => b.id));
      for (const bt of Object.values(g.historyMapping?.gachaTypes ?? {})) expect(types.has(bt), `${g.id}: ${bt}`).toBe(true);
    }
  });
});

describe('built-in character lists are consistent with their game record', () => {
  it.each(games.map((g) => [g.id, g] as const))('%s: every element and role exists, ids unique', async (_id, g) => {
    const chars = await g.data.characters();
    const elements = new Set(g.elements.map((e) => e.id));
    const roles = new Set(g.roles.map((r) => r.id));
    for (const c of chars) {
      expect(elements.has(c.element), `${c.name}: element ${c.element}`).toBe(true);
      expect(roles.has(c.role), `${c.name}: role ${c.role}`).toBe(true);
    }
    expect(duplicateIds(chars)).toEqual([]);
  });
});
