/**
 * Honkai: Star Rail. Numbers here are checked against the sources listed at the
 * bottom; anything not confirmed stays null and shows "No data yet".
 */
import type { BacklogItem, Banner, Character, GameContract, GameEvent, Material, TeamPreset, Version } from '../../core/contract';
import backlog from './data/backlog.json';
import banners from './data/banners.json';
import characters from './data/characters.json';
import events from './data/events.json';
import materials from './data/materials.json';
import teams from './data/teams.json';
import versions from './data/versions.json';

const list = <T>(rows: unknown) => async () => rows as T[];
const COMMUNITY = 'community pull-log statistics (not published by the game)';

export const hsr: GameContract = {
  id: 'hsr',
  short: 'HSR',
  name: 'Honkai: Star Rail',
  vent: '#A99BFF',
  terms: {
    rarity: { top: '5★', mid: '4★' },
    gear: 'Relics',
    weapon: 'Light Cone',
    skill: 'Traces',
    character: 'Character',
    endgame: ['Memory of Chaos', 'Pure Fiction', 'Apocalyptic Shadow'],
  },
  elements: [
    { id: 'physical', label: 'Physical', color: '#C9CFD6' },
    { id: 'fire', label: 'Fire', color: '#E8664A' },
    { id: 'ice', label: 'Ice', color: '#8FD3F0' },
    { id: 'lightning', label: 'Lightning', color: '#B98AF0' },
    { id: 'wind', label: 'Wind', color: '#6FD3A8' },
    { id: 'quantum', label: 'Quantum', color: '#7C7CF0' },
    { id: 'imaginary', label: 'Imaginary', color: '#E8D35C' },
  ],
  roles: [
    { id: 'destruction', label: 'Destruction' },
    { id: 'hunt', label: 'The Hunt' },
    { id: 'erudition', label: 'Erudition' },
    { id: 'harmony', label: 'Harmony' },
    { id: 'nihility', label: 'Nihility' },
    { id: 'preservation', label: 'Preservation' },
    { id: 'abundance', label: 'Abundance' },
    { id: 'remembrance', label: 'Remembrance' },
    { id: 'elation', label: 'Elation' },
  ],
  dupes: { prefix: 'E', name: 'Eidolon', max: 6 },
  currencies: [
    { id: 'stellar-jade', name: 'Stellar Jade', perPull: 160 },
    { id: 'special-pass', name: 'Star Rail Special Pass', pullItemFor: ['character', 'light-cone'] },
    { id: 'pass', name: 'Star Rail Pass', pullItemFor: ['standard', 'departure'] },
    { id: 'oneiric-shard', name: 'Oneiric Shard', paid: true },
  ],
  stamina: [{ id: 'trailblaze-power', name: 'Trailblaze Power', max: 240, minutesPerPoint: 6 }],
  servers: [
    { id: 'america', label: 'America', utcOffset: -5 },
    { id: 'europe', label: 'Europe', utcOffset: 1 },
    { id: 'asia', label: 'Asia', utcOffset: 8 },
    { id: 'tw-hk-mo', label: 'TW, HK, MO', utcOffset: 8 },
  ],
  reset: { hour: 4, weekday: 1 },
  modules: ['today', 'events', 'calendar', 'backlog', 'pulls', 'banners', 'roster', 'farm', 'intel'],
  defaultOrder: ['today', 'pulls', 'roster', 'calendar', 'events', 'banners', 'backlog', 'farm', 'intel'],
  bannerTypes: [
    {
      id: 'character',
      label: 'Character Event Warp',
      pullItem: 'special-pass',
      target: 'character',
      pity: {
        kind: 'hard-pity',
        hardPity: 90,
        baseRate: 0.006,
        featured: { winRate: 0.5, guaranteeAfterLoss: true },
        softPity: { from: 74, stepPerPull: 0.06, source: COMMUNITY },
      },
    },
    {
      id: 'light-cone',
      label: 'Light Cone Event Warp',
      pullItem: 'special-pass',
      target: 'weapon',
      pity: {
        kind: 'hard-pity',
        hardPity: 80,
        baseRate: 0.008,
        featured: { winRate: 0.75, guaranteeAfterLoss: true },
        softPity: { from: 66, stepPerPull: 0.07, source: COMMUNITY },
      },
    },
    {
      id: 'departure',
      label: 'Departure Warp',
      pullItem: 'pass',
      target: 'other',
      pity: { kind: 'hard-pity', hardPity: 50, baseRate: 0.006 },
    },
    {
      id: 'standard',
      label: 'Stellar Warp',
      pullItem: 'pass',
      target: 'other',
      pity: { kind: 'hard-pity', hardPity: 90, baseRate: 0.006, softPity: { from: 74, stepPerPull: 0.06, source: COMMUNITY } },
    },
  ],
  income: [
    { id: 'hsr.daily-training', source: 'daily', label: 'Daily Training', currency: 'stellar-jade', amount: 60, schedule: { kind: 'per-reset' } },
    { id: 'hsr.weekly-universe', source: 'weekly', label: 'Simulated Universe weekly points', currency: 'stellar-jade', amount: 225, schedule: { kind: 'weekly' } },
    { id: 'hsr.memory-of-chaos', source: 'endgame', label: 'Memory of Chaos', currency: 'stellar-jade', amount: null, schedule: { kind: 'cycle', days: 42 } },
    { id: 'hsr.pure-fiction', source: 'endgame', label: 'Pure Fiction', currency: 'stellar-jade', amount: null, schedule: { kind: 'cycle', days: 42 } },
    { id: 'hsr.apocalyptic-shadow', source: 'endgame', label: 'Apocalyptic Shadow', currency: 'stellar-jade', amount: null, schedule: { kind: 'cycle', days: 42 } },
    { id: 'hsr.express-pass', source: 'monthly', label: 'Express Supply Pass', currency: 'stellar-jade', amount: 90, schedule: { kind: 'pass', perDay: 90 }, paid: true },
    { id: 'hsr.events', source: 'events', label: 'Events', currency: 'stellar-jade', amount: null, schedule: { kind: 'from-events' } },
    { id: 'hsr.login', source: 'login', label: 'Login events', currency: 'stellar-jade', amount: null, schedule: { kind: 'from-login-events' } },
  ],
  historyMapping: {
    uigfKey: 'hkrpg',
    // 1 Stellar Warp · 2 Departure Warp · 11 character event · 12 light cone event.
    // Collaboration warps (21, 22) are skipped until their pity rules are confirmed.
    gachaTypes: { '1': 'standard', '2': 'departure', '11': 'character', '12': 'light-cone' },
    rarity: { '5': 'top', '4': 'mid', '3': 'low' },
  },
  historyImporters: [
    { id: 'srgf', kind: 'file', label: 'SRGF export file' },
    { id: 'uigf-v4', kind: 'file', label: 'UIGF v4 export file' },
    { id: 'hsr-link', kind: 'link', label: 'In-game history link' },
  ],
  data: {
    characters: list<Character>(characters),
    banners: list<Banner>(banners),
    events: list<GameEvent>(events),
    backlog: list<BacklogItem>(backlog),
    materials: list<Material>(materials),
    teams: list<TeamPreset>(teams),
    versions: list<Version>(versions),
    // No kits yet: Kit check shows "No data yet" until kit data is added (Override 1).
  },
  accountLinks: [{ provider: 'hoyolab', supports: ['stamina', 'checkin', 'roster', 'endgame'], config: { gameBiz: 'hkrpg_global' } }],
  scan: { screen: 'character', fields: ['level', 'eidolon', 'light-cone', 'relics', 'traces'] },
  rules: {},
  sources: [
    { what: 'Character list (names, rarity, path, element, release date)', source: 'nanoka.cc data files, game data 4.6.51, used with permission', entered: '2026-10-09', verified: false },
    { what: 'Pull rates, hard pity, 50/50 and 75/25', source: 'official rates shown on the in-game Warp details page', entered: '2026-10-09', verified: false },
    { what: 'Rising odds before hard pity', source: COMMUNITY, entered: '2026-10-09', verified: false },
    { what: 'Stamina cap and regeneration', source: 'V1 design (docs/DESIGN.md); verify in game', entered: '2026-10-09', verified: false },
    { what: 'Endgame rewards per cycle', source: 'not entered yet (depends on your clears)', entered: '2026-10-09', verified: false },
  ],
};
