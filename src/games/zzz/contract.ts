/**
 * Zenless Zone Zero. Numbers here are checked against the sources listed at the
 * bottom; anything not confirmed stays null and shows "No data yet".
 */
import type { BacklogItem, Banner, Character, GameContract, GameEvent, Kit, Material, TeamPreset, Version, SampleArt } from '../../core/contract';
import backlog from './data/backlog.json';
import banners from './data/banners.json';
import characters from './data/characters.json';
import events from './data/events.json';
import kits from './data/kits.json';
import materials from './data/materials.json';
import teams from './data/teams.json';
import sampleArt from './data/sample-art.json';
import versions from './data/versions.json';
import { SHEETS } from './kitcheck/library';
import { withTags } from './kitcheck/tags';
import { zzzTeamRules } from './kitcheck/team';

const list = <T>(rows: unknown) => async () => rows as T[];
const COMMUNITY = 'community pull-log statistics (not published by the game)';

export const zzz: GameContract = {
  id: 'zzz',
  short: 'ZZZ',
  name: 'Zenless Zone Zero',
  vent: '#D4F23A',
  terms: {
    rarity: { top: 'S', mid: 'A' },
    gear: 'Drive Discs',
    weapon: 'W-Engine',
    skill: 'Skills',
    character: 'Agent',
    endgame: ['Shiyu Defense', 'Deadly Assault'],
  },
  elements: [
    { id: 'physical', label: 'Physical', color: '#C9CFD6' },
    { id: 'fire', label: 'Fire', color: '#E8664A' },
    { id: 'ice', label: 'Ice', color: '#8FD3F0' },
    { id: 'electric', label: 'Electric', color: '#B98AF0' },
    { id: 'ether', label: 'Ether', color: '#E07AD0' },
    // Names as the game uses them for these attributes' level-up chips.
    { id: 'windbite', label: 'Windbite', color: '#6FD3A8' },
    { id: 'lumiflux', label: 'Lumiflux', color: '#E8D35C' },
  ],
  roles: [
    { id: 'attack', label: 'Attack' },
    { id: 'stun', label: 'Stun' },
    { id: 'anomaly', label: 'Anomaly' },
    { id: 'support', label: 'Support' },
    { id: 'defense', label: 'Defense' },
    { id: 'rupture', label: 'Rupture' },
    { id: 'armorer', label: 'Armorer' },
  ],
  dupes: { prefix: 'M', name: 'Mindscape', max: 6 },
  currencies: [
    { id: 'polychrome', name: 'Polychrome', perPull: 160 },
    { id: 'encrypted-master-tape', name: 'Encrypted Master Tape', pullItemFor: ['exclusive', 'w-engine'] },
    { id: 'master-tape', name: 'Master Tape', pullItemFor: ['standard'] },
    { id: 'boopon', name: 'Boopon', pullItemFor: ['bangboo'] },
    { id: 'monochrome', name: 'Monochrome', paid: true },
  ],
  stamina: [{ id: 'battery-charge', name: 'Battery Charge', max: 240, minutesPerPoint: 6 }],
  teamSize: 3,
  servers: [
    { id: 'america', label: 'America', utcOffset: -5 },
    { id: 'europe', label: 'Europe', utcOffset: 1 },
    { id: 'asia', label: 'Asia', utcOffset: 8 },
    { id: 'tw-hk-mo', label: 'TW, HK, MO', utcOffset: 8 },
  ],
  reset: { hour: 4, weekday: 1 },
  modules: ['today', 'events', 'calendar', 'backlog', 'pulls', 'banners', 'roster', 'farm', 'intel'],
  bannerTypes: [
    {
      id: 'exclusive',
      label: 'Exclusive Channel',
      pullItem: 'encrypted-master-tape',
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
      id: 'w-engine',
      label: 'W-Engine Channel',
      pullItem: 'encrypted-master-tape',
      target: 'weapon',
      pity: { kind: 'hard-pity', hardPity: 80, baseRate: 0.01, featured: { winRate: 0.75, guaranteeAfterLoss: true } },
    },
    {
      id: 'standard',
      label: 'Stable Channel',
      pullItem: 'master-tape',
      target: 'other',
      pity: { kind: 'hard-pity', hardPity: 90, baseRate: 0.006 },
    },
    {
      id: 'bangboo',
      label: 'Bangboo Channel',
      pullItem: 'boopon',
      target: 'other',
      pity: { kind: 'hard-pity', hardPity: 80, baseRate: null },
    },
  ],
  income: [
    { id: 'zzz.daily', source: 'daily', label: 'Daily Engagement', currency: 'polychrome', amount: 60, schedule: { kind: 'per-reset' } },
    { id: 'zzz.weekly', source: 'weekly', label: 'Weekly rewards', currency: 'polychrome', amount: null, schedule: { kind: 'weekly' } },
    { id: 'zzz.shiyu-defense', source: 'endgame', label: 'Shiyu Defense', currency: 'polychrome', amount: null, schedule: { kind: 'cycle', days: 14 } },
    { id: 'zzz.deadly-assault', source: 'endgame', label: 'Deadly Assault', currency: 'polychrome', amount: null, schedule: { kind: 'cycle', days: 14 } },
    { id: 'zzz.membership', source: 'monthly', label: 'Inter-Knot Membership', currency: 'polychrome', amount: 90, schedule: { kind: 'pass', perDay: 90 }, paid: true },
    { id: 'zzz.events', source: 'events', label: 'Events', currency: 'polychrome', amount: null, schedule: { kind: 'from-events' } },
    { id: 'zzz.login', source: 'login', label: 'Login events', currency: 'polychrome', amount: null, schedule: { kind: 'from-login-events' } },
  ],
  historyMapping: {
    uigfKey: 'nap',
    // 1 Stable Channel · 2 Exclusive Channel · 3 W-Engine Channel · 5 Bangboo Channel.
    gachaTypes: { '1': 'standard', '2': 'exclusive', '3': 'w-engine', '5': 'bangboo' },
    rarity: { '4': 'top', '3': 'mid', '2': 'low' },
  },
  historyImporters: [
    { id: 'uigf-v4', kind: 'file', label: 'UIGF v4 export file' },
    { id: 'zzz-link', kind: 'link', label: 'In-game history link' },
  ],
  data: {
    characters: list<Character>(characters),
    banners: list<Banner>(banners),
    events: list<GameEvent>(events),
    backlog: list<BacklogItem>(backlog),
    materials: list<Material>(materials),
    teams: list<TeamPreset>(teams),
    sampleArt: async () => sampleArt as SampleArt[],
    versions: list<Version>(versions),
    // Kit text with the cheat sheet's tags (docs/logic/zzz-method.md, Part A).
    kits: async () => withTags(kits as Kit[], SHEETS),
  },
  accountLinks: [{ provider: 'hoyolab', supports: ['stamina', 'checkin', 'roster', 'endgame'], config: { gameBiz: 'nap_global' } }],
  scan: { screen: 'character', fields: ['level', 'mindscape', 'w-engine', 'drive-discs', 'skills'] },
  rules: { teams: zzzTeamRules },
  sources: [
    { what: 'Agent list (names, rank, specialty, attribute)', source: 'nanoka.cc data files, game data 3.3.4, used with permission', entered: '2026-10-09', verified: false },
    { what: 'Pull rates, hard pity, 50/50 and 75/25', source: 'official rates shown on the in-game Signal Search details page', entered: '2026-10-09', verified: false },
    { what: 'Rising odds before hard pity (Exclusive Channel)', source: COMMUNITY, entered: '2026-10-09', verified: false },
    { what: 'Bangboo Channel rate', source: 'not entered yet', entered: '2026-10-09', verified: false },
    { what: 'Stamina cap and regeneration', source: 'V1 design (docs/DESIGN.md); verify in game', entered: '2026-10-09', verified: false },
    { what: 'Weekly and endgame rewards', source: 'not entered yet', entered: '2026-10-09', verified: false },
  ],
};
