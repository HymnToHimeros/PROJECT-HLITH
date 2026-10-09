// Tests only: a small made-up game for the account-links, scan and share tests.
import type { Character, GameContract } from '../../core/contract';

export const fakeCharacters: Character[] = [
  { id: '1001', name: 'Ice Friend', rarity: 'mid', element: 'ice', role: 'support' },
  { id: '1002', name: 'Wind Blade', rarity: 'mid', element: 'fire', role: 'attack' },
  { id: '1003', name: 'Fire Queen', rarity: 'top', element: 'fire', role: 'attack' },
  { id: '1004', name: 'Old Knight', rarity: 'top', element: 'ice', role: 'support' },
];

export function fakeGame(over: Partial<GameContract> = {}): GameContract {
  return {
    id: 'aa',
    short: 'AA',
    name: 'Game A',
    vent: '#A99BFF',
    terms: { rarity: { top: '5★', mid: '4★' }, gear: 'Relics', weapon: 'Light Cone', skill: 'Traces', character: 'Character', endgame: ['Hard Mode', 'Story Mode'] },
    elements: [
      { id: 'fire', label: 'Fire', color: '#E8664A' },
      { id: 'ice', label: 'Ice', color: '#8FD3F0' },
    ],
    roles: [
      { id: 'attack', label: 'Attack' },
      { id: 'support', label: 'Support' },
    ],
    dupes: { prefix: 'E', name: 'Eidolon', max: 6 },
    currencies: [],
    teamSize: 4,
    stamina: [{ id: 'power', name: 'Power', max: 240, minutesPerPoint: 6 }],
    servers: [],
    reset: { hour: 4, weekday: 1 },
    modules: ['roster'],
    bannerTypes: [],
    income: [],
    historyImporters: [],
    accountLinks: [{ provider: 'hoyolab', supports: ['stamina', 'checkin', 'roster', 'endgame'], config: { gameBiz: 'hkrpg_global' } }],
    scan: { screen: 'character', fields: ['level', 'eidolon', 'light-cone', 'relics', 'traces'] },
    data: {
      characters: async () => fakeCharacters,
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
