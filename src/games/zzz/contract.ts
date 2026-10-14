/**
 * Zenless Zone Zero. Numbers here are checked against the sources listed at the
 * bottom; anything not confirmed stays null and shows "No data yet".
 */
import type { BacklogItem, Banner, Character, GameContract, GameEvent, RecommendedBuild, Material, TeamPreset, Version, SampleArt, Weapon } from '../../core/contract';
import backlog from './data/backlog.json';
import banners from './data/banners.json';
import characters from './data/characters.json';
import events from './data/events.json';
import builds from './data/builds.json';
import weapons from './data/weapons.json';
import { scoreBuild } from '../../core/rules/buildScore';
import materials from './data/materials.json';
import teams from './data/teams.json';
import sampleArt from './data/sample-art.json';
import versions from './data/versions.json';
import { materialsFor } from './costs';
import { GEAR_SLOTS, LEVEL_MAX, SET_SLOTS } from './gear';
import { KITS, SHEETS } from './kitcheck/library';
import { withTags } from './kitcheck/tags';
import { recommendedTeams, zzzTeamRules } from './kitcheck/team';
import { TOTAL_STATS, zzzStatTargets } from './statTargets';

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
  potential: { name: 'Agent Potential', max: 6 },
  build: {
    levelMax: 60,
    weaponLevelMax: 60,
    refine: { name: 'Phase', max: 5 },
    slots: GEAR_SLOTS,
    subStats: ['HP', 'ATK', 'DEF', 'HP %', 'ATK %', 'DEF %', 'CRIT Rate', 'CRIT DMG', 'PEN', 'Anomaly Proficiency'],
    totalStats: TOTAL_STATS,
    skills: [
      { name: 'Basic Attack', max: 16 },
      { name: 'Dodge', max: 16 },
      { name: 'Assist', max: 16 },
      { name: 'Special Attack', max: 16 },
      { name: 'Chain Attack', max: 16 },
      { name: 'Core Skill', max: 7 },
    ],
  },
  currencies: [
    { id: 'polychrome', name: 'Polychrome', perPull: 160 },
    { id: 'encrypted-master-tape', name: 'Encrypted Master Tape', pullItemFor: ['exclusive', 'w-engine'] },
    { id: 'master-tape', name: 'Master Tape', pullItemFor: ['standard'] },
    { id: 'boopon', name: 'Boopon', pullItemFor: ['bangboo'] },
    { id: 'monochrome', name: 'Monochrome', perPull: 160, paid: true },
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
      pity: { kind: 'hard-pity', hardPity: 80, baseRate: 0.01 },
    },
  ],
  income: [
    { id: 'zzz.daily', source: 'daily', label: 'Daily Engagement', currency: 'polychrome', amount: 60, schedule: { kind: 'per-reset' } },
    { id: 'zzz.weekly', source: 'weekly', label: 'Weekly rewards (Ridu Weekly 60 + Hollow Zero Bounty Commission 160)', currency: 'polychrome', amount: 220, schedule: { kind: 'weekly' } },
    { id: 'zzz.shiyu-defense', source: 'endgame', label: 'Shiyu Defense: Critical Node', currency: 'polychrome', amount: 780, schedule: { kind: 'cycle', anchor: '2026-10-01T20:00:00.000Z', days: 14 } },
    { id: 'zzz.deadly-assault', source: 'endgame', label: 'Deadly Assault', currency: 'polychrome', amount: 300, schedule: { kind: 'cycle', anchor: '2026-10-09T02:00:00.000Z', days: 14 } },
    { id: 'zzz.membership', source: 'monthly', label: 'Inter-Knot Membership', currency: 'polychrome', amount: 90, schedule: { kind: 'pass', perDay: 90 }, paid: true },
    { id: 'zzz.events', source: 'events', label: 'Events', currency: 'polychrome', amount: null, schedule: { kind: 'from-events' } },
    { id: 'zzz.login', source: 'login', label: 'Login events', currency: 'polychrome', amount: null, schedule: { kind: 'from-login-events' } },
  ],
  historyMapping: {
    uigfKey: 'nap',
    // 1 Stable Channel · 2 Exclusive Channel · 3 W-Engine Channel · 5 Bangboo Channel.
    gachaTypes: { '1': 'standard', '2': 'exclusive', '3': 'w-engine', '5': 'bangboo' },
    rarity: { '4': 'top', '3': 'mid', '2': 'low' },
    // Stable Channel (standard) S-rank: Grace, Rina, Koleda, Nekomata, Soldier 11, Lycaon and their
    // six W-Engines (pool box on zenless-zone-zero.fandom.com/wiki/Stable_Channel, checked 2026-10-11; icy-veins stable-channel).
    standardTop: ['1181', '1211', '1101', '1021', '1041', '1141', '14118', '14121', '14110', '14102', '14104', '14114'],
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
    // Recommended teams: the best squads the kit check finds for each damage dealer (docs/logic/zzz-method.md).
    teams: async () => [...(teams as TeamPreset[]), ...recommendedTeams()],
    sampleArt: async () => sampleArt as SampleArt[],
    versions: list<Version>(versions),
    // Kit text with the cheat sheet's tags (docs/logic/zzz-method.md, Part A).
    kits: async () => withTags(KITS, SHEETS),
    // The game's own recommended builds (npm run data:builds).
    builds: list<RecommendedBuild>(builds),
    // Every Light Cone / W-Engine with its picture (npm run data:builds); weapon banners show them.
    weapons: async () => weapons as Weapon[],
  },
  accountLinks: [{ provider: 'hoyolab', supports: ['stamina', 'checkin', 'roster', 'endgame'], config: { gameBiz: 'nap_global' } }],
  scan: { screen: 'character', fields: ['level', 'mindscape', 'w-engine', 'drive-discs', 'skills'] },
  rules: {
    // Build score: the saved build against the game's own recommendation (docs/logic/build-score.md).
    scoreBuild: (b) =>
      scoreBuild(
        b,
        (builds as unknown as RecommendedBuild[]).find((x) => x.characterId === b.characterId),
        { levelMax: LEVEL_MAX, weaponLevelMax: 60, setSlots: SET_SLOTS },
      ),
    teams: zzzTeamRules,
    // End stats to build towards, only from numbers the game text states (T35).
    statTargets: zzzStatTargets,
    materialsFor,
    materialsNote: 'From the game data (nanoka.cc): ascension, every skill and the Core Skill to max. Agent EXP is counted as Senior Investigator Logs (3,000 EXP each).',
  },
  sources: [
    { what: 'Monochrome → Polychrome', source: 'in-game exchange, 1 Monochrome = 1 Polychrome, so 160 make one pull (owner, 2026-10-14)', entered: '2026-10-14', verified: true },
    { what: 'Agent list (names, rank, specialty, attribute)', source: 'nanoka.cc data files (community data site), game data 3.3.4', entered: '2026-10-09', verified: false },
    { what: 'Pull rates, hard pity, 50/50 and 75/25', source: 'official rates shown on the in-game Signal Search details page', entered: '2026-10-09', verified: false },
    { what: 'Rising odds before hard pity (Exclusive Channel)', source: COMMUNITY, entered: '2026-10-09', verified: false },
    { what: 'Bangboo Channel rate', source: 'S-Rank 1% base (gamewith.net/zenless-zone-zero/46129), hard pity 80 (zenless-zone-zero.fandom.com/wiki/Bangboo_Channel)', entered: '2026-10-10', verified: false },
    { what: 'Stamina cap and regeneration', source: 'V1 design (docs/DESIGN.md); verify in game', entered: '2026-10-09', verified: false },
    { what: 'Weekly and endgame rewards', source: 'zenless-zone-zero.fandom.com reward tables: Ridu Weekly total 60, Hollow Zero/Bounty Commission total 160, Shiyu Defense/Critical Node all S 780, Deadly Assault maximum 300', entered: '2026-10-10', verified: false },
    { what: 'Versions, banners, events and endgame dates', source: 'official version notices (zenless.hoyoverse.com) and in-game notices; rewards, featured items and endgame cycles from zenless-zone-zero.fandom.com (scripts/import-schedule.ts)', entered: '2026-10-10', verified: false },
  ],
};
