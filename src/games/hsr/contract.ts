/**
 * Honkai: Star Rail. Numbers here are checked against the sources listed at the
 * bottom; anything not confirmed stays null and shows "No data yet".
 */
import type { BacklogItem, Banner, Character, GameContract, GameEvent, RecommendedBuild, Material, SampleArt, TeamPreset, Version, Weapon } from '../../core/contract';
import backlog from './data/backlog.json';
import banners from './data/banners.json';
import characters from './data/characters.json';
import events from './data/events.json';
import builds from './data/builds.json';
import weapons from './data/weapons.json';
import { scoreBuild } from '../../core/rules/buildScore';
import { materialsFor } from './costs';
import { GEAR_SLOTS, LEVEL_MAX, SET_SLOTS } from './gear';
import materials from './data/materials.json';
import teams from './data/teams.json';
import sampleArt from './data/sample-art.json';
import versions from './data/versions.json';
import { KITS, SHEETS } from './kitcheck/library';
import { withTags } from './kitcheck/tags';
import { gameTeams, hsrTeamRules } from './kitcheck/team';
import { hsrStatTargets, TOTAL_STATS } from './statTargets';

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
  potential: { name: 'Enhanced', max: 1 },
  // The Trailblazer: one entry per Path for each, named "Trailblazer · Harmony (Caelus)" in characters.json.
  protagonist: {
    label: 'Trailblazer',
    options: [
      { id: 'caelus', name: 'Caelus' },
      { id: 'stelle', name: 'Stelle' },
    ],
    of: (c) => {
      const m = /^(Trailblazer · .+) \((Caelus|Stelle)\)$/.exec(c.name);
      return m?.[1] && m[2] ? { option: m[2].toLowerCase(), form: m[1] } : undefined;
    },
  },
  build: {
    levelMax: 80,
    weaponLevelMax: 80,
    refine: { name: 'Superimposition', max: 5 },
    slots: GEAR_SLOTS,
    subStats: ['HP', 'ATK', 'DEF', 'HP %', 'ATK %', 'DEF %', 'SPD', 'CRIT Rate', 'CRIT DMG', 'Effect Hit Rate', 'Effect RES', 'Break Effect'],
    totalStats: TOTAL_STATS,
    skills: [
      { name: 'Basic ATK', max: 7 },
      { name: 'Skill', max: 15 },
      { name: 'Ultimate', max: 15 },
      { name: 'Talent', max: 15 },
    ],
  },
  currencies: [
    { id: 'stellar-jade', name: 'Stellar Jade', perPull: 160 },
    { id: 'special-pass', name: 'Star Rail Special Pass', pullItemFor: ['character', 'light-cone'] },
    { id: 'pass', name: 'Star Rail Pass', pullItemFor: ['standard', 'departure'] },
    { id: 'oneiric-shard', name: 'Oneiric Shard', paid: true },
  ],
  stamina: [{ id: 'trailblaze-power', name: 'Trailblaze Power', max: 240, minutesPerPoint: 6 }],
  teamSize: 4,
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
    // Collaboration warps (e.g. the Fate collaboration): listed so their banners show; their pity
    // rules aren't confirmed yet, so no odds are worked out for them ("none", rate not published).
    {
      id: 'collab-character',
      label: 'Character Collaboration Warp',
      pullItem: 'special-pass',
      target: 'character',
      pity: { kind: 'none', baseRate: null },
    },
    {
      id: 'collab-light-cone',
      label: 'Light Cone Collaboration Warp',
      pullItem: 'special-pass',
      target: 'weapon',
      pity: { kind: 'none', baseRate: null },
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
    // Memory of Chaos has no anchor: Version 4.6 runs it 5 weeks, then 6 (official 4.6 notice), so no fixed rhythm
    // fits both; its real dates come from the endgame entries in data/events.json.
    { id: 'hsr.memory-of-chaos', source: 'endgame', label: 'Memory of Chaos', currency: 'stellar-jade', amount: 800, schedule: { kind: 'cycle', days: 42 } },
    { id: 'hsr.pure-fiction', source: 'endgame', label: 'Pure Fiction', currency: 'stellar-jade', amount: 800, schedule: { kind: 'cycle', anchor: '2026-10-18T20:00:00.000Z', days: 42 } },
    { id: 'hsr.apocalyptic-shadow', source: 'endgame', label: 'Apocalyptic Shadow', currency: 'stellar-jade', amount: 800, schedule: { kind: 'cycle', anchor: '2026-10-04T20:00:00.000Z', days: 42 } },
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
    // Stellar Warp (standard) 5★: Himeko, Welt, Bronya, Gepard, Clara, Yanqing, Bailu and their
    // seven light cones (pool box on honkai-star-rail.fandom.com/wiki/Stellar_Warp, checked 2026-10-11; game8 408765).
    standardTop: ['1003', '1004', '1101', '1104', '1107', '1209', '1211', '23000', '23002', '23003', '23004', '23005', '23012', '23013'],
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
    // The game's own recommended teams, built around their real carry and scored by the kit check (docs/logic/hsr-theory.md).
    // The kit check's own "best" teams aren't listed for HSR: the game's teams are the ones players run (decision 21).
    teams: async () => gameTeams(teams as TeamPreset[]),
    sampleArt: async () => sampleArt as SampleArt[],
    versions: list<Version>(versions),
    // Kit text (npm run data:hsr-kits) with the cheat sheet's tags (docs/logic/hsr-theory.md, Part A).
    kits: async () => withTags(KITS, SHEETS),
    // The game's own recommended builds (npm run data:builds).
    builds: list<RecommendedBuild>(builds),
    // Every Light Cone / W-Engine with its picture (npm run data:builds); weapon banners show them.
    weapons: async () => weapons as Weapon[],
  },
  accountLinks: [{ provider: 'hoyolab', supports: ['stamina', 'checkin', 'roster', 'endgame'], config: { gameBiz: 'hkrpg_global' } }],
  scan: { screen: 'character', fields: ['level', 'eidolon', 'light-cone', 'relics', 'traces'] },
  // Level-up costs from nanoka.cc; team scoring waits for the owner's OK on docs/logic/hsr-theory.md.
  rules: {
    // Build score: the saved build against the game's own recommendation (docs/logic/build-score.md).
    scoreBuild: (b) =>
      scoreBuild(
        b,
        (builds as unknown as RecommendedBuild[]).find((x) => x.characterId === b.characterId),
        { levelMax: LEVEL_MAX, weaponLevelMax: 80, setSlots: SET_SLOTS },
      ),
    teams: hsrTeamRules,
    // End stats to build towards, only from numbers the game text states (T35).
    statTargets: hsrStatTargets,
    materialsFor,
    materialsNote: "From the game data (nanoka.cc): ascension, every skill and every Trace to max. Character EXP 1 → 80 (5,797,920, from the game's own EXP table) is counted as Traveler's Guides (20,000 EXP each).",
  },
  sources: [
    { what: 'Character list (names, rarity, path, element, release date)', source: 'nanoka.cc data files, game data 4.6.51, used with permission', entered: '2026-10-09', verified: false },
    { what: 'Pull rates, hard pity, 50/50 and 75/25', source: 'official rates shown on the in-game Warp details page', entered: '2026-10-09', verified: false },
    { what: 'Rising odds before hard pity', source: COMMUNITY, entered: '2026-10-09', verified: false },
    { what: 'Stamina cap and regeneration', source: 'V1 design (docs/DESIGN.md); verify in game', entered: '2026-10-09', verified: false },
    { what: 'Endgame rewards per cycle', source: '800 Stellar Jade per full clear of each mode since 2.3 (honkai.gg/stellar-jades-calculation-in-version-2-3, games.gg Memory of Chaos guide 4.1); Starward Mode adds 100 more (honkai-star-rail.fandom.com/wiki/Treasures_Lightward), not counted', entered: '2026-10-10', verified: false },
    { what: 'Versions, banners, events and endgame dates', source: 'official version notices (hsr.hoyoverse.com) and in-game notices; rewards and featured items from honkai-star-rail.fandom.com (scripts/import-schedule.ts)', entered: '2026-10-10', verified: false },
  ],
};
