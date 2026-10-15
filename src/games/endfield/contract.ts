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
    rarity: { top: '6★', mid: '5★', low: '4★' },
    gear: 'Equipment',
    weapon: 'Weapon',
    skill: 'Skills',
    character: 'Operator',
    endgame: ['Contingency Contract'],
  },

  elements: [
    { id: 'physical', label: 'Physical', color: '#C9CFD6' },
    { id: 'heat', label: 'Heat', color: '#E8753A' },
    { id: 'cryo', label: 'Cryo', color: '#59C4E8' },
    { id: 'electric', label: 'Electric', color: '#C9A0E8' },
    { id: 'nature', label: 'Nature', color: '#8BD44A' },
  ],

  roles: [
    { id: 'caster', label: 'Caster' },
    { id: 'defender', label: 'Defender' },
    { id: 'guard', label: 'Guard' },
    { id: 'striker', label: 'Striker' },
    { id: 'supporter', label: 'Supporter' },
    { id: 'vanguard', label: 'Vanguard' },
  ],

  dupes: { prefix: 'P', name: 'Potential', max: 6 },

  currencies: [
    { id: 'origeometry', name: 'Origeometry', paid: true },
    { id: 'oroberyl', name: 'Oroberyl', perPull: 500 },
    { id: 'chartered-hh-permit', name: 'Chartered HH Permit', pullItemFor: ['chartered', 'rerun', 'joint'] },
    { id: 'basic-hh-permit', name: 'Basic HH Permit', pullItemFor: ['basic', 'beginner'] },
    { id: 'arsenal-ticket', name: 'Arsenal Ticket', pullItemFor: ['weapon'] },
  ],

  stamina: [{ id: 'sanity', name: 'Sanity', max: 135, minutesPerPoint: 6 }],
  teamSize: 4,

  servers: [
    { id: 'asia', label: 'Asia', utcOffset: 8 },
    { id: 'americas-europe', label: 'Americas / Europe', utcOffset: -5 },
  ],
  reset: { hour: 4, weekday: 1 },

  modules: ['today', 'pulls', 'roster', 'calendar', 'events', 'banners', 'backlog', 'farm', 'intel'],

  bannerTypes: [
    {
      id: 'chartered',
      label: 'Chartered Headhunting (limited)',
      pullItem: 'chartered-hh-permit',
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
      pullItem: 'chartered-hh-permit',
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
      pullItem: 'chartered-hh-permit',
      target: 'character',
      pity: {
        kind: 'hard-pity',
        hardPity: 80,
        baseRate: 0.008,
        softPity: { from: 65, stepPerPull: 0.05, source: 'endfield.wiki.gg' },
      },
    },
    {
      id: 'basic',
      label: 'Basic (standard)',
      pullItem: 'basic-hh-permit',
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
      pullItem: 'basic-hh-permit',
      target: 'character',
      pity: { kind: 'hard-pity', hardPity: 40, baseRate: null },
    },
    {
      id: 'weapon',
      label: 'Arsenal Issue (weapon)',
      pullItem: 'arsenal-ticket',
      target: 'weapon',
      pity: {
        kind: 'hard-pity',
        hardPity: 40,
        baseRate: 0.04,
      },
    },
  ],

  income: [
    { id: 'endfield.daily', source: 'daily', label: 'Daily tasks', currency: 'oroberyl', amount: null, schedule: { kind: 'per-reset' } },
  ],

  historyImporters: [
    { id: 'endfield-link', kind: 'link' as const, label: 'Endfield history link (from HGWebview.log)' },
  ],

  historyMapping: {
    gachaTypes: {
      chartered: 'chartered',
      rerun: 'rerun',
      joint: 'joint',
      basic: 'basic',
      beginner: 'beginner',
      'weapon-limited': 'weapon',
      'weapon-constant': 'weapon',
      'weapon-rerun': 'weapon',
    },
    rarity: { '6': 'top', '5': 'mid', '4': 'low' },
  },

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
    { what: 'Sanity max and regen rate', source: 'endfield.wiki.gg/wiki/Sanity', entered: '2026-10-15', verified: true },
  ],
};
