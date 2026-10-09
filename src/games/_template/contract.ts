/**
 * Copy this folder to src/games/<id>/ to add a game, then fill in every field.
 * Rules:
 * - Import only from core/ (never tools/ or another game).
 * - Unknown numbers stay null; the app shows "No data yet" instead of guessing.
 * - List items in data/*.json need stable ids that never change.
 * - Add the game to src/games/index.ts. Nothing else in the app changes.
 */
import type { Character, GameContract } from '../../core/contract';
import characters from './data/characters.json';

const list = <T>(rows: unknown) => async () => rows as T[];

export const template: GameContract = {
  id: 'template',
  short: 'TPL',
  name: 'Game name',
  vent: '#9FE0C8', // must reach 7:1 with #08090B and not be orange or red
  terms: {
    rarity: { top: '5★', mid: '4★' },
    gear: 'Gear',
    weapon: 'Weapon',
    skill: 'Skills',
    character: 'Character',
    endgame: [],
  },
  elements: [{ id: 'physical', label: 'Physical', color: '#C9CFD6' }],
  roles: [{ id: 'damage', label: 'Damage' }],
  // dupes: { prefix: 'C', name: 'Constellation', max: 6 },  // leave out if the game has none
  currencies: [
    { id: 'premium', name: 'Premium currency', perPull: 160 },
    { id: 'ticket', name: 'Pull ticket', pullItemFor: ['limited'] },
  ],
  stamina: [{ id: 'stamina', name: 'Stamina', max: 240, minutesPerPoint: 6 }],
  servers: [{ id: 'global', label: 'Global', utcOffset: 0 }],
  reset: { hour: 4, weekday: 1 },
  modules: ['today', 'events', 'calendar', 'backlog', 'pulls', 'banners', 'roster', 'farm', 'intel'],
  defaultOrder: ['today', 'pulls', 'roster', 'calendar', 'events', 'banners', 'backlog', 'farm', 'intel'],
  bannerTypes: [
    {
      id: 'limited',
      label: 'Limited banner',
      pullItem: 'ticket',
      target: 'character',
      pity: { kind: 'hard-pity', hardPity: 90, baseRate: null },
    },
  ],
  income: [{ id: 'template.daily', source: 'daily', label: 'Daily tasks', currency: 'premium', amount: null, schedule: { kind: 'per-reset' } }],
  historyImporters: [],
  data: {
    characters: list<Character>(characters),
    banners: async () => [],
    events: async () => [],
    backlog: async () => [],
    materials: async () => [],
    teams: async () => [],
    versions: async () => [],
  },
  rules: {},
  sources: [],
};
