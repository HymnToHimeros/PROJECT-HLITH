/**
 * A made-up game that is nothing like the first two: picks a unit after 200
 * pulls instead of pity, no dupes, two stamina pools, two premium currencies,
 * no history import, no account link, and no Farm or Intel module.
 * If registering it ever needs a change in core/ or tools/, the structure is wrong.
 */
import type { GameContract } from '../../../src/core/contract';

export const fakeGame: GameContract = {
  id: 'fake-quest',
  short: 'FQ',
  name: 'Fake Quest',
  vent: '#5FD4D0',
  terms: {
    rarity: { top: 'UR', mid: 'SR' },
    gear: 'Charms',
    weapon: 'Relic',
    skill: 'Arts',
    character: 'Hero',
    endgame: ['Tower'],
  },
  elements: [
    { id: 'sun', label: 'Sun', color: '#E8D35C' },
    { id: 'moon', label: 'Moon', color: '#8FD3F0' },
  ],
  roles: [{ id: 'striker', label: 'Striker' }],
  currencies: [
    { id: 'gems', name: 'Gems', perPull: 120 },
    { id: 'paid-gems', name: 'Paid Gems', perPull: 120, paid: true },
    { id: 'ticket', name: 'Ticket', pullItemFor: ['pickup'] },
  ],
  teamSize: 4,
  stamina: [
    { id: 'ap', name: 'Action Points', max: 150, minutesPerPoint: 5 },
    { id: 'raid', name: 'Raid Keys', max: 3, minutesPerPoint: 480 },
  ],
  servers: [{ id: 'jp', label: 'Japan', utcOffset: 9 }],
  reset: { hour: 5, weekday: 0 },
  modules: ['today', 'events', 'calendar', 'backlog', 'pulls', 'banners', 'roster'],
  bannerTypes: [
    { id: 'pickup', label: 'Pick-up', pullItem: 'ticket', target: 'character', pity: { kind: 'spark', sparkAt: 200, baseRate: 0.03 } },
  ],
  income: [{ id: 'fq.daily', source: 'daily', label: 'Dailies', currency: 'gems', amount: 50, schedule: { kind: 'per-reset' } }],
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
};
