import { beforeEach, describe, expect, it } from 'vitest';
import type { GameContract, ModuleId } from '../contract';
import { clearGames, gameProblems, registerGame } from './games';
import { defaultLayout, hide, move, notAvailable, phoneBar, reset, restore, slot, type LayoutState } from './layout';
import { MODULE_CATALOG } from './modules';

const ALL: ModuleId[] = ['today', 'events', 'calendar', 'backlog', 'pulls', 'banners', 'roster', 'farm', 'intel'];

function game(over: Partial<GameContract> = {}): GameContract {
  return {
    id: 'g1',
    short: 'G1',
    name: 'Game One',
    vent: '#A99BFF',
    terms: { rarity: { top: '5★', mid: '4★' }, gear: 'G', weapon: 'W', skill: 'S', character: 'C', endgame: [] },
    elements: [],
    roles: [],
    currencies: [
      { id: 'premium', name: 'P', perPull: 160 },
      { id: 'ticket', name: 'T', pullItemFor: ['limited'] },
    ],
    stamina: [],
    servers: [{ id: 'eu', label: 'Europe', utcOffset: 1 }],
    reset: { hour: 4, weekday: 1 },
    modules: ALL,
    bannerTypes: [{ id: 'limited', label: 'L', pullItem: 'ticket', target: 'character', pity: { kind: 'none', baseRate: null } }],
    income: [],
    historyImporters: [],
    data: {
      characters: async () => [],
      banners: async () => [],
      events: async () => [],
      backlog: async () => [],
      materials: async () => [],
      teams: async () => [],
      versions: async () => [],
    },
    rules: {},
    sources: [],
    ...over,
  };
}

describe('registerGame rejects broken records', () => {
  beforeEach(() => clearGames());

  it('accepts a good one', () => {
    expect(gameProblems(game())).toEqual([]);
    expect(() => registerGame(game())).not.toThrow();
  });

  it('rejects a vent that fails 7:1 or looks like ember', () => {
    expect(gameProblems(game({ vent: '#334477' })).join()).toMatch(/needs 7:1/);
    expect(gameProblems(game({ vent: '#FF8A4C' })).join()).toMatch(/reserved for ember/);
  });

  it('rejects unknown and repeated modules', () => {
    expect(gameProblems(game({ modules: [...ALL, 'bangboo' as ModuleId] })).join()).toMatch(/unknown modules: bangboo/);
    expect(gameProblems(game({ modules: ['today', 'today'] })).join()).toMatch(/once each/);
  });

  it('rejects banner types and income rows pointing at missing currencies', () => {
    const bad = game({
      bannerTypes: [{ id: 'x', label: 'X', pullItem: 'nope', target: 'other', pity: { kind: 'none', baseRate: null } }],
      income: [{ id: 'r', source: 'daily', label: 'R', currency: 'nope', amount: 1, schedule: { kind: 'per-reset' } }],
    });
    const problems = gameProblems(bad).join('\n');
    expect(problems).toMatch(/unknown pull item nope/);
    expect(problems).toMatch(/unknown currency nope/);
    expect(problems).toMatch(/names unknown banner type limited/);
  });

  it('refuses the same game twice', () => {
    registerGame(game());
    expect(() => registerGame(game())).toThrow(/registered twice/);
  });
});

describe('layout rules (DESIGN §1 flexibility rules)', () => {
  const games = [game(), game({ id: 'g2', short: 'G2', vent: '#D4F23A', modules: ['today', 'pulls', 'roster'] })];

  it('starts from the shared default order', () => {
    expect(slot(games, 'g2', defaultLayout())).toEqual(['today', 'pulls', 'roster']);
  });

  it('hides, but never the last visible module', () => {
    let l: LayoutState = defaultLayout();
    l = hide(games, 'g2', l, 'today');
    l = hide(games, 'g2', l, 'pulls');
    l = hide(games, 'g2', l, 'roster');
    expect(slot(games, 'g2', l)).toEqual(['roster']);
  });

  it('restore brings a module back', () => {
    const l = hide(games, 'g1', defaultLayout(), 'farm');
    expect(slot(games, 'g1', l)).not.toContain('farm');
    expect(slot(games, 'g1', restore(l, 'farm'))).toContain('farm');
  });

  it('moves a module to a new position', () => {
    const l = move(games, 'g1', defaultLayout(), 'intel', 0);
    expect(slot(games, 'g1', l)[0]).toBe('intel');
  });

  it('modules missing from a saved order are appended, not lost', () => {
    expect(slot(games, 'g1', { order: ['pulls'], hidden: [] })).toEqual([
      'pulls', 'today', 'roster', 'calendar', 'events', 'banners', 'backlog', 'farm', 'intel',
    ]);
  });

  it('reset restores the default order and unhides everything', () => {
    expect(reset()).toEqual({ order: [...MODULE_CATALOG], hidden: [] });
  });

  it('every game starts with the same order, so shared modules sit in the same place', () => {
    const two = [game({ modules: ['intel', 'pulls', 'today'] }), game({ id: 'g2', short: 'G2', vent: '#D4F23A', modules: ['pulls', 'farm', 'today'] })];
    expect(slot(two, 'g1', defaultLayout())).toEqual(['today', 'pulls', 'intel']);
    expect(slot(two, 'g2', defaultLayout())).toEqual(['today', 'pulls', 'farm']);
  });

  it('marks modules the record lacks as not available', () => {
    expect(notAvailable(games, 'g2')).toEqual(['calendar', 'events', 'banners', 'backlog', 'farm', 'intel']);
  });

  it('puts the first four in the phone bar and the rest in More', () => {
    expect(phoneBar(['today', 'pulls', 'roster', 'calendar', 'events'])).toEqual({
      bar: ['today', 'pulls', 'roster', 'calendar'],
      more: ['events'],
    });
  });
});
