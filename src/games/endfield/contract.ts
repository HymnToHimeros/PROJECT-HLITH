/**
 * Arknights: Endfield — game contract.
 * Import only from core/ (never tools/ or another game).
 * Unknown numbers stay null; the app shows "No data yet" instead of guessing.
 * List items in data/*.json need stable ids that never change.
 * Add the game to src/games/index.ts. Nothing else in the app changes.
 */
import type { Character, GameContract } from '../../core/contract';
import characters from './data/characters.json';

const list = <T>(rows: unknown) => async () => rows as T[];

export const endfield: GameContract = {
  id: 'endfield',
  short: 'AKEF',
  name: 'Arknights: Endfield',
  vent: '#7BC8DB',
  ownerOnly: true,

  terms: {
    rarity: { top: '6★', mid: '5★' },
    gear: 'Equipment',
    weapon: 'Weapon',
    skill: 'Skills',
    character: 'Operator',
    endgame: ['Contingency Contract'],
  },

  elements: [
    { id: 'physical', label: 'Physical', color: '#C9CFD6' },
    { id: 'fire', label: 'Fire', color: '#E8753A' },
    { id: 'ice', label: 'Ice', color: '#59C4E8' },
    { id: 'electric', label: 'Electric', color: '#C9A0E8' },
    { id: 'corrosion', label: 'Corrosion', color: '#8BD44A' },
  ],

  roles: [
    { id: 'striker', label: 'Striker' },
    { id: 'bulwark', label: 'Bulwark' },
    { id: 'artisan', label: 'Artisan' },
    { id: 'tactician', label: 'Tactician' },
  ],

  dupes: { prefix: 'P', name: 'Potential', max: 6 },

  currencies: [
    { id: 'origeometry', name: 'Origeometry', paid: true },
    { id: 'oroberyl', name: 'Oroberyl', perPull: 500 },
    { id: 'hh-permit', name: 'HH Permit', pullItemFor: ['special', 'rerun', 'joint', 'standard', 'beginner'] },
    { id: 'arsenal-ticket', name: 'Arsenal Ticket', pullItemFor: ['weapon-special', 'weapon-constant', 'weapon-rerun'] },
  ],

  stamina: [{ id: 'sanity', name: 'Sanity', max: 135, minutesPerPoint: 6 }],
  teamSize: 4,

  servers: [
    { id: 'global', label: 'Global', utcOffset: -5 },
    { id: 'cn', label: 'CN', utcOffset: 8 },
  ],
  reset: { hour: 4, weekday: 1 },

  modules: ['today', 'pulls', 'roster', 'calendar', 'events', 'banners', 'backlog', 'farm', 'intel'],

  bannerTypes: [
    {
      id: 'special',
      label: 'Chartered (limited)',
      pullItem: 'hh-permit',
      target: 'character',
      pity: {
        kind: 'hard-pity',
        hardPity: 80,
        baseRate: 0.008,
        featured: { winRate: 0.5, guaranteeAfterLoss: false },
        softPity: { from: 65, stepPerPull: 0.05, source: 'endfield.wiki.gg' },
      },
    },
    {
      id: 'rerun',
      label: 'RE-Factor (rerun)',
      pullItem: 'hh-permit',
      target: 'character',
      pity: {
        kind: 'hard-pity',
        hardPity: 80,
        baseRate: 0.008,
        featured: { winRate: 0.5, guaranteeAfterLoss: false },
        softPity: { from: 65, stepPerPull: 0.05, source: 'endfield.wiki.gg' },
      },
    },
    {
      id: 'joint',
      label: 'Joint',
      pullItem: 'hh-permit',
      target: 'character',
      pity: {
        kind: 'hard-pity',
        hardPity: 80,
        baseRate: 0.008,
        softPity: { from: 65, stepPerPull: 0.05, source: 'endfield.wiki.gg' },
      },
    },
    {
      id: 'standard',
      label: 'Basic (standard)',
      pullItem: 'hh-permit',
      target: 'character',
      pity: {
        kind: 'hard-pity',
        hardPity: 80,
        baseRate: 0.008,
        softPity: { from: 65, stepPerPull: 0.05, source: 'endfield.wiki.gg' },
      },
    },
    {
      id: 'beginner',
      label: 'New Horizons (beginner)',
      pullItem: 'hh-permit',
      target: 'character',
      pity: { kind: 'hard-pity', hardPity: 40, baseRate: null },
    },
    {
      id: 'weapon-special',
      label: 'Arsenal Exchange (weapon)',
      pullItem: 'arsenal-ticket',
      target: 'weapon',
      pity: {
        kind: 'hard-pity',
        hardPity: 40,
        baseRate: 0.04,
      },
    },
    {
      id: 'weapon-constant',
      label: 'Constant (weapon)',
      pullItem: 'arsenal-ticket',
      target: 'weapon',
      pity: { kind: 'hard-pity', hardPity: 40, baseRate: 0.04 },
    },
    {
      id: 'weapon-rerun',
      label: 'Weapon Rerun',
      pullItem: 'arsenal-ticket',
      target: 'weapon',
      pity: { kind: 'hard-pity', hardPity: 40, baseRate: 0.04 },
    },
  ],

  income: [
    { id: 'endfield.daily', source: 'daily', label: 'Daily tasks', currency: 'oroberyl', amount: null, schedule: { kind: 'per-reset' } },
  ],

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

  sources: [
    { what: 'Pity rates and rules', source: 'endfield.wiki.gg/wiki/Headhunting', entered: '2026-10-11', verified: true },
    { what: 'Weapon pool rules', source: 'endfield.wiki.gg/wiki/Arsenal_Exchange', entered: '2026-10-11', verified: true },
    { what: 'Currencies', source: 'endfield.wiki.gg', entered: '2026-10-11', verified: true },
  ],
};
