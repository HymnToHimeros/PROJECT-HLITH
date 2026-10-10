/**
 * Is a saved build built for one stat? (owner's job T18: "if you run Robin with Phainon her value is taken as an
 * HP-only user for her build".) Read roughly, in bands, never as damage math: each main stat of that stat on a slot
 * that could have rolled something else counts 5, each sub-stat roll of it counts 1. Game-free: the game hands over
 * its gear slots (game contract `build.slots`). Rules: docs/logic/hsr-decisions.md 25–26.
 */
import type { CharacterBuild } from '../contract';

/** Stats a teammate's buff can scale with (the kit says "equal to X% of <name>'s <stat>"). */
export type BuildStat =
  | 'hp'
  | 'atk'
  | 'def'
  | 'spd'
  | 'crit-rate'
  | 'crit-dmg'
  | 'break-effect'
  | 'effect-hit-rate'
  | 'energy-regen'
  | 'outgoing-healing'
  | 'anomaly-proficiency'
  | 'anomaly-mastery'
  | 'impact';

export const BUILD_STAT_WORD: Record<BuildStat, string> = {
  hp: 'HP',
  atk: 'ATK',
  def: 'DEF',
  spd: 'SPD',
  'crit-rate': 'CRIT Rate',
  'crit-dmg': 'CRIT DMG',
  'break-effect': 'Break Effect',
  'effect-hit-rate': 'Effect Hit Rate',
  'energy-regen': 'Energy Regen',
  'outgoing-healing': 'Outgoing Healing',
  'anomaly-proficiency': 'Anomaly Proficiency',
  'anomaly-mastery': 'Anomaly Mastery',
  impact: 'Impact',
};

/** Main stat names (both games' slot lists) and sub-stat names that are this stat. Flat and % both count as subs. */
const MAIN: Record<BuildStat, RegExp> = {
  hp: /^hp ?%$/,
  atk: /^atk ?%$/,
  def: /^def ?%$/,
  spd: /^spd$/,
  'crit-rate': /^crit rate$/,
  'crit-dmg': /^crit dmg$/,
  'break-effect': /^break effect$/,
  'effect-hit-rate': /^effect hit rate$/,
  'energy-regen': /^energy regen(eration rate)?$/,
  'outgoing-healing': /^outgoing healing( boost)?$/,
  'anomaly-proficiency': /^anomaly proficiency$/,
  'anomaly-mastery': /^anomaly mastery$/,
  impact: /^impact$/,
};
const SUB: Record<BuildStat, RegExp> = { ...MAIN, hp: /^hp( ?%)?$/, atk: /^atk( ?%)?$/, def: /^def( ?%)?$/ };
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export type Fit = 'built' | 'partly' | 'not' | 'no-build';
export interface BuildFit {
  fit: Fit;
  points: number;
  /** What the saved build has, in plain words. */
  have: string;
}

export const FIT_WORD: Record<Fit, string> = { built: 'built for it', partly: 'partly built for it', not: 'not built for it', 'no-build': 'no build saved, scored at base' };
/** Points a fully built teammate adds; the best team found assumes it. */
export const BUILT_POINTS = 2;

/** The band for one stat. `slots`: the game's gear slots with the main stats each can roll. */
export function buildFit(build: CharacterBuild | undefined, stat: BuildStat, slots: { id: string; mains: string[] }[]): BuildFit {
  if (!build || !build.gear.length) return { fit: 'no-build', points: 0, have: 'no build saved' };
  // Slots where this stat is a choice (Head is always HP: no choice, so no sign of a build).
  const free = slots.filter((s) => s.mains.length > 1 && s.mains.some((m) => MAIN[stat].test(norm(m))));
  const onMain = free.filter((s) => {
    const piece = build.gear.find((g) => g.slot === s.id);
    return piece ? MAIN[stat].test(norm(piece.main)) : false;
  });
  let rolls = 0;
  for (const g of build.gear)
    for (const sub of Object.keys(g.subs)) if (SUB[stat].test(norm(sub))) rolls += g.rolls?.[sub] ?? 1;
  const score = onMain.length * 5 + rolls;
  // Full marks: every slot that can have it has it, plus 5 rolls.
  const target = free.length * 5 + 5;
  const word = BUILD_STAT_WORD[stat];
  const have = `${onMain.length ? `${word} main stat on ${onMain.map((s) => s.id).join(', ')}` : `no ${word} main stat`}${free.length ? ` (of ${free.length} slot${free.length === 1 ? '' : 's'} that can have it)` : ''}, ${rolls} ${word} sub-stat roll${rolls === 1 ? '' : 's'}`;
  if (score >= target * 0.8) return { fit: 'built', points: BUILT_POINTS, have };
  if (score >= target * 0.35) return { fit: 'partly', points: 1, have };
  return { fit: 'not', points: 0, have };
}
