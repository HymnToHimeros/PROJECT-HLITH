/**
 * Arknights: Endfield — game contract.
 * Import only from core/ (never tools/ or another game).
 * Unknown numbers stay null; the app shows "No data yet" instead of guessing.
 * List items in data/*.json need stable ids that never change.
 * Add the game to src/games/index.ts. Nothing else in the app changes.
 */
import type { Banner, Character, GameContract, GameEvent, Version, Weapon } from '../../core/contract';
import banners from './data/banners.json';
import characters from './data/characters.json';
import events from './data/events.json';
import versions from './data/versions.json';
import weapons from './data/weapons.json';
import { ARSENAL, ARSENAL_SOURCE, ARSENAL_TICKETS_AT_LEAST_PER_PULL, arsenalIssue, basicOperator, beginnerOperator, charteredOperator, HEADHUNTING_SOURCE, rerunOperator } from './gacha';

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
    // 1 Origeometry = 75 Oroberyl (500 a pull) or 25 Arsenal Tickets (198 a weapon pull).
    { id: 'origeometry', name: 'Origeometry', paid: true, perPull: 500 / 75, perPullOn: { weapon: ARSENAL.issueCost / ARSENAL.issueSize / 25 } },
    { id: 'oroberyl', name: 'Oroberyl', perPull: 500 },
    { id: 'chartered-hh-permit', name: 'Chartered HH Permit', pullItemFor: ['chartered', 'rerun', 'joint'] },
    { id: 'basic-hh-permit', name: 'Basic HH Permit', pullItemFor: ['basic', 'beginner'] },
    {
      id: 'arsenal-ticket',
      name: 'Arsenal Ticket',
      perPullOn: { weapon: ARSENAL.issueCost / ARSENAL.issueSize },
      fromPulls: {
        on: ['chartered', 'rerun', 'joint', 'basic', 'beginner'],
        atLeastPerPull: ARSENAL_TICKETS_AT_LEAST_PER_PULL,
        why: '20 for every 4★ operator, and a 5★ (200) at least every 10 pulls',
      },
    },
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
      pity: charteredOperator,
    },
    {
      id: 'rerun',
      label: 'RE-Factor (rerun)',
      pullItem: 'chartered-hh-permit',
      target: 'character',
      pity: rerunOperator,
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
      pity: basicOperator,
    },
    {
      id: 'beginner',
      label: 'New Horizons (beginner)',
      pullItem: 'basic-hh-permit',
      target: 'character',
      pity: beginnerOperator,
    },
    {
      id: 'weapon',
      label: 'Arsenal Issue (weapon)',
      pullItem: 'arsenal-ticket',
      target: 'weapon',
      pity: arsenalIssue,
      // Only Arsenal Tickets (and Origeometry turned into them) buy weapon issues.
      currencies: ['arsenal-ticket', 'origeometry'],
    },
  ],

  income: [
    { id: 'endfield.daily', source: 'daily', label: 'Daily tasks', currency: 'oroberyl', amount: null, schedule: { kind: 'per-reset' } },
  ],

  historyImporters: [],

  data: {
    characters: list<Character>(characters),
    banners: list<Banner>(banners),
    events: list<GameEvent>(events),
    backlog: async () => [],
    materials: async () => [],
    teams: async () => [],
    versions: list<Version>(versions),
    weapons: async () => weapons as Weapon[],
  },

  rules: {},

  sources: [
    { what: 'Pity rates and rules (gacha.ts, docs/logic/endfield-gacha.md)', source: HEADHUNTING_SOURCE, entered: '2026-10-15', verified: true },
    { what: 'Weapon issue rules (gacha.ts)', source: ARSENAL_SOURCE, entered: '2026-10-15', verified: true },
    { what: 'Joint banner rules', source: 'not confirmed: a placeholder with the standard banner’s 6★ odds and no featured rule', entered: '2026-10-15', verified: false },
    { what: 'Currencies', source: 'endfield.wiki.gg', entered: '2026-10-11', verified: true },
    { what: 'Sanity max and regen rate', source: 'endfield.wiki.gg/wiki/Sanity', entered: '2026-10-15', verified: true },
    { what: 'Server time zones (Asia UTC+8, Americas / Europe UTC-5)', source: 'Official notices, footer (web-news.gryphline.com, e.g. "[Sanctuary of Ink] Version Update Notes")', entered: '2026-10-15', verified: true },
    { what: 'Daily reset 04:00, weekly reset Monday 04:00 (server time)', source: 'endfield.wiki.gg/wiki/Endfield_Talos_Wiki/servertime; official notices say "updated at 04:00 server time"', entered: '2026-10-15', verified: true },
    { what: 'Operators, weapons, banners, events, versions (data/*.json, npm run data:endfield)', source: 'endfield.wiki.gg Cargo tables (CC BY-SA), versions checked against the official update notes', entered: '2026-10-15', verified: true },
  ],
};
