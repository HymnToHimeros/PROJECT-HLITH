/**
 * HLITH's own Endfield build picks, from the kit (profile.ts) and the gear and weapon texts. Every pick comes
 * with its reasons, each quoting the kit line or gear text it rests on. Weights: weights.ts.
 */
import type { CharacterSheet, Element, Entry, GameEvent, SkillKind, Stat } from '../kitcheck/types';
import { KIND_LABEL } from './kitNumbers';
import type { OperatorProfile } from './profile';
import { SET_RULES, type Need, type SetRule } from './sets';
import * as W from './weights';

export interface GearPieceData {
  name: string;
  set?: string;
  slot: 'Armor' | 'Gloves' | 'Kit';
  level: number;
  stats: { stat: string; values: number[] }[];
}
export interface GearSetData {
  name: string;
  level: number;
  effects: { label: string; text: string }[];
}
export interface WeaponSkillData {
  weapon: string;
  skills: { name: string; rank1: string; max: string }[];
}

export interface Pick<T> {
  value: T;
  /** Plain-words reasons, each quoting what it rests on. */
  why: string[];
}

const ELEMENT_WORD: Record<Element, string> = { physical: 'Physical', heat: 'Heat', cryo: 'Cryo', electric: 'Electric', nature: 'Nature' };
const isArts = (e: Element) => e !== 'physical';
const pct = (x: number) => `${Math.round(x * 100)}%`;
const q = (e: Entry) => `“${e.quote}”`;

// ── What the kit does, for a set rule's condition ─────────────────────────────────────────────────────────────

const NEED_EVENTS: Partial<Record<Need, GameEvent[]>> = {
  vulnerable: ['vulnerable', 'physical-status', 'lift', 'knock-down', 'crush', 'breach'],
  'crush-or-breach': ['crush', 'breach'],
  'physical-status': ['physical-status', 'lift', 'knock-down', 'crush', 'breach'],
  combustion: ['combustion'],
  corrosion: ['corrosion'],
  electrification: ['electrification'],
  solidification: ['solidification'],
  'nature-or-cryo-burst': ['arts-burst', 'nature-infliction', 'cryo-infliction'],
  'arts-infliction': ['arts-infliction', 'heat-infliction', 'cryo-infliction', 'electric-infliction', 'nature-infliction'],
};
const NEED_WORDS: Record<Need, string> = {
  vulnerable: 'applies Vulnerability',
  'crush-or-breach': 'applies Crush or Breach',
  'physical-status': 'applies a Physical Status',
  combustion: 'applies Combustion',
  corrosion: 'applies Corrosion',
  electrification: 'applies Electrification',
  solidification: 'applies Solidification',
  'nature-or-cryo-burst': 'applies Nature or Cryo Inflictions (for a Burst)',
  'arts-infliction': 'applies Arts Inflictions',
  'consumes-electrification-or-corrosion': 'consumes Electrification or Corrosion',
  'recovers-sp': 'recovers SP',
  heals: 'heals',
  'amp-protect-susceptibility-weaken': 'applies Amp, Protection or Susceptibility',
};

/** Whether the kit meets a set rule's condition, with the kit line that proves it. */
export function meetsNeed(_p: OperatorProfile, sheet: CharacterSheet | undefined, need: Need): Entry | null {
  const entries = (sheet?.entries ?? []).filter((e) => !e.unverified && !e.piece.startsWith('potential'));
  const giving = (stats: Stat[]) => entries.find((e) => e.gives.some((g) => stats.includes(g.stat)) && e.to !== 'self');
  if (need === 'recovers-sp') return giving(['sp']) ?? null;
  if (need === 'heals') return giving(['heal']) ?? null;
  if (need === 'amp-protect-susceptibility-weaken') return giving(['amp', 'protection', 'susceptibility']) ?? null;
  if (need === 'consumes-electrification-or-corrosion') return entries.find((e) => [...(e.causes ?? []), ...(e.reacts ?? [])].some((x) => x === 'electrification' || x === 'corrosion')) ?? null;
  const events = NEED_EVENTS[need] ?? [];
  return entries.find((e) => (e.causes ?? []).some((c) => events.includes(c))) ?? null;
}

// ── Gear set effects ──────────────────────────────────────────────────────────────────────────────────────────

const roleDamage = (p: OperatorProfile) => (p.damageDealer ? 1 : W.SUPPORT_OWN_DAMAGE);
const defensive = (p: OperatorProfile) => p.opClass === 'defender' || p.gives.has('heal') || p.gives.has('shield') || p.gives.has('protection');
/** How much of the kit's damage a skill limit covers (no limit: all of it). */
const skillShare = (p: OperatorProfile, skills?: SkillKind[]) => (skills ? skills.reduce((s, k) => s + (p.damageShare[k] ?? 0), 0) : 1);
const elementMatch = (p: OperatorProfile, elements?: (Element | 'arts')[]) => !elements || elements.includes(p.element) || (elements.includes('arts') && isArts(p.element));
/** The combo's weight in this kit: its share of the damage, or of the team lines for a support. */
function comboWeight(p: OperatorProfile): number {
  if (p.damageDealer) return p.damageShare.combo ?? 0;
  const lines = Object.values(p.teamLines).reduce((s, l) => s + (l?.length ?? 0), 0);
  return lines ? (p.teamLines.combo?.length ?? 0) / lines : (p.damageShare.combo ?? 0);
}
const totalPerMinute = (p: OperatorProfile) => p.skills.reduce((s, k) => s + k.perMinuteDamage, 0);

/** One set rule's points for this kit, and the reason; null when it does nothing for them. */
export function ruleScore(p: OperatorProfile, sheet: CharacterSheet | undefined, rule: SetRule): { points: number; why: string } | null {
  let proof: Entry | null = null;
  if (rule.needs) {
    proof = meetsNeed(p, sheet, rule.needs);
    if (!proof) return null;
  }
  const b = rule.benefit;
  const up = rule.timed ? W.TIMED_UPTIME : 1;
  let points = 0;
  let how = '';
  switch (b.kind) {
    case 'wearer-dmg': {
      if (!elementMatch(p, b.elements)) return null;
      const share = skillShare(p, b.skills);
      points = b.amount * share * up * roleDamage(p);
      how = b.skills ? `${b.skills.map((s) => KIND_LABEL[s]).join(', ')} carry about ${pct(share)} of their estimated damage` : `their damage is ${ELEMENT_WORD[p.element]}`;
      break;
    }
    case 'atk':
      points = b.amount * W.ATK_POINT * up * roleDamage(p);
      how = 'ATK raises all their damage';
      break;
    case 'crit-rate':
      points = b.amount * W.CRIT_RATE_POINT * up * roleDamage(p);
      how = 'more critical hits';
      break;
    case 'arts-intensity': {
      const infl = meetsNeed(p, sheet, 'arts-infliction');
      if (!infl && !p.uses.includes('arts-intensity')) return null;
      points = b.amount * W.ARTS_INTENSITY_POINT * up * roleDamage(p);
      proof ??= infl;
      how = 'Arts Intensity raises the reactions and statuses their kit sets off';
      break;
    }
    case 'team-dmg':
      points = b.amount * up * (p.damageDealer ? W.DD_TEAM_BUFF : W.SUPPORT_TEAM_BUFF);
      how = 'the whole team deals more damage';
      break;
    case 'others-dmg':
      points = b.amount * up * (p.damageDealer ? W.DD_OTHERS_BUFF : W.SUPPORT_TEAM_BUFF);
      how = p.damageDealer ? 'it helps their teammates, not their own damage' : 'their teammates deal more damage';
      break;
    case 'combo-cooldown': {
      const w = comboWeight(p);
      points = b.amount * W.COOLDOWN_POINT * w;
      how = p.damageDealer ? `the Combo Skill carries about ${pct(w)} of their estimated damage` : `${pct(w)} of the kit lines the Kit check counts for the team come from the Combo Skill`;
      break;
    }
    case 'stagger':
      points = b.amount * W.STAGGER_POINT;
      how = 'more Stagger';
      break;
    case 'extra-hit': {
      const total = totalPerMinute(p);
      const share = total ? ((b.amount * 60) / b.every / total) * 100 : 0;
      points = share * roleDamage(p);
      how = `about ${Math.round(share)}% more ${ELEMENT_WORD.physical} damage on top of their estimated damage a minute`;
      break;
    }
    case 'hp':
      if (!defensive(p)) return null;
      points = (b.amount / 1000) * W.HP_1000_POINTS * W.DEFENSIVE_WEIGHT;
      how = p.opClass === 'defender' ? 'a Defender keeps the team standing' : 'their kit protects or heals';
      break;
    case 'dmg-reduction':
    case 'treatment':
      if (!defensive(p)) return null;
      points = b.amount * up * W.DEFENSIVE_WEIGHT;
      how = 'their kit heals';
      break;
  }
  if (points <= 0) return null;
  const because = proof ? `; their kit ${NEED_WORDS[rule.needs ?? 'arts-infliction']}: ${q(proof)}` : '';
  return { points, why: `“${rule.quote}”: ${how}${because}` };
}

export function setEffectScore(p: OperatorProfile, sheet: CharacterSheet | undefined, set: string): { points: number; why: string[] } {
  const parts = (SET_RULES[set] ?? []).map((r) => ruleScore(p, sheet, r)).filter((x): x is { points: number; why: string } => !!x);
  return { points: parts.reduce((s, x) => s + x.points, 0), why: parts.map((x) => x.why) };
}

// ── Gear stats ────────────────────────────────────────────────────────────────────────────────────────────────

const ATTRIBUTES = ['Strength', 'Agility', 'Intellect', 'Will'];
const ELEMENT_STAT: Record<string, Element[]> = { 'Heat & Nature DMG': ['heat', 'nature'], 'Cryo & Electric DMG': ['cryo', 'electric'], 'Physical DMG Bonus': ['physical'] };
const SKILL_STAT: Record<string, SkillKind> = { 'Basic Attack DMG Bonus': 'basic', 'Battle Skill DMG Bonus': 'battle', 'Combo Skill DMG Bonus': 'combo', 'Ultimate DMG Bonus': 'ultimate' };

/** How much one gear stat is worth to this kit (STAT_WEIGHT × the kit's shares), with why. 0 = no use. */
export function statWorth(p: OperatorProfile, sheet: CharacterSheet | undefined, stat: string): { points: number; why: string } {
  const S = W.STAT_WEIGHT;
  const dmg = p.damageDealer ? 1 : W.SUPPORT_DAMAGE_STATS;
  const none = { points: 0, why: '' };
  if (ATTRIBUTES.includes(stat) || stat === 'Main Attribute' || stat === 'Secondary Attribute') {
    if (stat === p.main || stat === 'Main Attribute') return p.main ? { points: S.mainAttribute, why: `${p.main} is their main attribute` } : none;
    if (stat === p.secondary || stat === 'Secondary Attribute') return p.secondary ? { points: S.secondaryAttribute, why: `${p.secondary} is their secondary attribute` } : none;
    return none;
  }
  if (ELEMENT_STAT[stat]) return ELEMENT_STAT[stat]?.includes(p.element) ? { points: S.elementDmg * dmg, why: `their damage is ${ELEMENT_WORD[p.element]}` } : none;
  if (stat === 'Arts DMG') return isArts(p.element) ? { points: S.elementDmg * dmg * 0.9, why: `${ELEMENT_WORD[p.element]} is Arts damage` } : none;
  if (SKILL_STAT[stat]) {
    const k = SKILL_STAT[stat] as SkillKind;
    const share = p.damageShare[k] ?? 0;
    return share ? { points: S.skillDmg * share * 2 * dmg, why: `the ${KIND_LABEL[k]} carries about ${pct(share)} of their estimated damage` } : none;
  }
  if (stat === 'All Skill DMG') {
    const share = skillShare(p, ['battle', 'combo', 'ultimate']);
    return { points: S.allSkillDmg * share * dmg, why: `their skills carry about ${pct(share)} of their estimated damage` };
  }
  if (stat === 'Attack') return { points: S.attack * dmg, why: 'ATK raises all their damage' };
  if (stat === 'Critical Rate') return { points: S.criticalRate * dmg, why: 'more critical hits' };
  if (stat === 'DMG Bonus vs. Staggered') return { points: S.staggered * dmg, why: 'only against Staggered enemies' };
  if (stat === 'Arts Intensity') {
    const infl = meetsNeed(p, sheet, 'arts-infliction');
    return infl || p.uses.includes('arts-intensity') ? { points: S.artsIntensity, why: infl ? `their kit applies Arts Inflictions: ${q(infl)}` : 'their damage notes use Arts Intensity' } : none;
  }
  if (stat === 'Ultimate Gain Efficiency') {
    const w = p.damageDealer ? (p.damageShare.ultimate ?? 0) : (p.teamLines.ultimate?.length ?? 0) / Math.max(1, Object.values(p.teamLines).reduce((s, l) => s + (l?.length ?? 0), 0));
    return w ? { points: S.ultimateGain * w * 2, why: p.damageDealer ? `the Ultimate carries about ${pct(w)} of their estimated damage` : `${pct(w)} of their team kit lines come from the Ultimate` } : none;
  }
  if (stat === 'Treatment Bonus') {
    const heal = p.gives.get('heal')?.[0];
    return heal ? { points: S.treatment, why: `their kit heals: ${q(heal)}` } : none;
  }
  if (stat === 'HP' || stat === 'Final DMG Reduction') return defensive(p) ? { points: stat === 'HP' ? S.hp : S.dmgReduction, why: p.opClass === 'defender' ? 'a Defender keeps the team standing' : 'their kit protects or heals' } : none;
  return none;
}

/** The stats gear pieces offer, ranked for this kit; ones barely worth anything are left off. */
export function rankStats(p: OperatorProfile, sheet: CharacterSheet | undefined, stats: string[]): Pick<string[]> {
  const scored = [...new Set(stats)].map((s) => ({ s, ...statWorth(p, sheet, s) })).filter((x) => x.points > 0);
  scored.sort((a, b) => b.points - a.points || a.s.localeCompare(b.s));
  const top = scored[0]?.points ?? 0;
  const kept = scored.filter((x) => x.points > top * W.STAT_LIST_MIN && !(x.s === 'Main Attribute' && p.main) && !(x.s === 'Secondary Attribute' && p.secondary)).slice(0, W.STAT_LIST_MAX);
  return { value: kept.map((x) => x.s), why: kept.map((x) => `${x.s}: ${x.why}.`) };
}

/** A piece's worth: each stat at its highest artifice level, against the biggest of that stat on an endgame piece. */
export function pieceScore(p: OperatorProfile, sheet: CharacterSheet | undefined, piece: GearPieceData, maxOf: Map<string, number>): number {
  return piece.stats.reduce((s, x) => s + statWorth(p, sheet, x.stat).points * ((x.values[x.values.length - 1] ?? 0) / (maxOf.get(x.stat) || 1)), 0);
}

// ── Gear set + off-piece ──────────────────────────────────────────────────────────────────────────────────────

export interface SetPick {
  set: string;
  /** The four pieces: three (or four) from the set, and the off-piece. */
  pieces: string[];
  offPiece?: string;
}

export function pickSet(p: OperatorProfile, sheet: CharacterSheet | undefined, sets: GearSetData[], pieces: GearPieceData[]): Pick<SetPick> | null {
  const endgame = pieces.filter((x) => x.level >= W.ENDGAME_LEVEL);
  const maxOf = new Map<string, number>();
  for (const x of endgame) for (const s of x.stats) maxOf.set(s.stat, Math.max(maxOf.get(s.stat) ?? 0, s.values[s.values.length - 1] ?? 0));
  const score = (x: GearPieceData) => pieceScore(p, sheet, x, maxOf);
  const best = (list: GearPieceData[], slot: GearPieceData['slot']) => list.filter((x) => x.slot === slot).sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name))[0];
  const candidates = sets
    .filter((s) => s.level >= W.ENDGAME_LEVEL && SET_RULES[s.name])
    .map((s) => {
      const effect = setEffectScore(p, sheet, s.name);
      const own = endgame.filter((x) => x.set === s.name);
      const [armor, gloves, kit] = [best(own, 'Armor'), best(own, 'Gloves'), best(own, 'Kit')];
      if (!armor || !gloves || !kit) return null;
      const any = { Armor: best(endgame, 'Armor'), Gloves: best(endgame, 'Gloves'), Kit: best(endgame, 'Kit') };
      // Three set pieces switch the effect on; the fourth slot takes the best piece for this kit, from any set.
      const options: { pieces: GearPieceData[]; off?: GearPieceData }[] = [{ pieces: [armor, gloves, kit, kit] }];
      for (const slot of ['Armor', 'Gloves', 'Kit'] as const) {
        const off = any[slot];
        if (!off || off.set === s.name) continue;
        const keep = slot === 'Armor' ? [gloves, kit, kit] : slot === 'Gloves' ? [armor, kit, kit] : [armor, gloves, kit];
        options.push({ pieces: [...keep, off], off });
      }
      const total = (o: { pieces: GearPieceData[] }) => o.pieces.reduce((t, x) => t + score(x), 0);
      const chosen = options.reduce((a, b) => (total(b) > total(a) ? b : a));
      return { set: s.name, effect, chosen, points: effect.points + W.PIECE_TIEBREAK * total(chosen) };
    })
    .filter((x): x is NonNullable<typeof x> => !!x && x.effect.points > 0)
    .sort((a, b) => b.points - a.points);
  const [top, second] = candidates;
  if (!top) return null;
  const why = [...top.effect.why, `Only level-${W.ENDGAME_LEVEL} sets are compared; lower sets (Aburrey’s Legacy, Catastrophe, AIC Fieldwork, Mordvolt…) are stepping stones to them.`];
  if (second) why.push(`Next best: ${second.set} (${Math.round(second.points)} points against ${Math.round(top.points)}).`);
  if (top.chosen.off) {
    const best3 = top.chosen.pieces.filter((x) => x !== top.chosen.off).map((x) => x.name);
    why.push(`Off-piece: ${top.chosen.off.name} (${top.chosen.off.stats.map((s) => s.stat).join(', ')}) beats a fourth ${top.set} piece for this kit; the set effect needs only three (${best3.join(', ')}).`);
  } else why.push(`All four from ${top.set}: no other piece beats the set's own for this kit.`);
  return { value: { set: top.set, pieces: top.chosen.pieces.map((x) => x.name), ...(top.chosen.off ? { offPiece: top.chosen.off.name } : {}) }, why };
}

// ── Skill priority ────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Skills to level first, in tiers. A damage dealer: by each skill's share of the kit's estimated damage a minute.
 * A support: first the skills carrying the kit lines the Kit check counts for the team, then damage.
 */
export function rankSkills(p: OperatorProfile): Pick<SkillKind[][]> | null {
  if (!p.skills.length) return null;
  const scored = p.skills.map((k) => {
    const share = p.damageShare[k.kind] ?? 0;
    const lines = p.damageDealer ? [] : (p.teamLines[k.kind] ?? []);
    const points = p.damageDealer ? share * 100 : lines.length * W.SUPPORT_LINE_POINTS + share * 100 * W.SUPPORT_OWN_DAMAGE;
    const dmgWhy = `about ${pct(share)} of the kit's estimated damage a minute (${k.perUse ? `${Math.round(k.perUse)}% ATK a use` : 'no damage multiplier'}, ${k.estimate})`;
    const why = lines.length ? `${lines.length} of the kit lines the Kit check counts for the team (${q(lines[0] as Entry)}); ${dmgWhy}` : dmgWhy;
    return { kind: k.kind, points, why };
  });
  scored.sort((a, b) => b.points - a.points);
  const tiers: (typeof scored)[] = [];
  for (const s of scored) {
    const tier = tiers[tiers.length - 1];
    if (tier && s.points >= (tier[0]?.points ?? 0) * W.SKILL_TIE_RATIO) tier.push(s);
    else tiers.push([s]);
  }
  if (tiers.length < 2) return { value: [tiers[0]?.map((s) => s.kind) ?? []], why: ['The kit text can’t separate the four skills: their estimated shares are within the tie ratio.'] };
  const why = tiers.flatMap((t, i) => t.map((s) => `${i + 1}. ${KIND_LABEL[s.kind]}: ${s.why}.`));
  if (tiers.some((t) => t.length > 1)) why.push(`Skills in one tier are within ${Math.round((1 - W.SKILL_TIE_RATIO) * 100)}% of each other: the estimate can’t separate them.`);
  return { value: tiers.map((t) => t.map((s) => s.kind)), why };
}

// ── Weapon order inside the game's list ──────────────────────────────────────────────────────────────────────

const SKILL_WORDS: [RegExp, SkillKind][] = [
  [/basic attack|final strike/i, 'basic'],
  [/battle skill/i, 'battle'],
  [/combo skill/i, 'combo'],
  [/ultimate/i, 'ultimate'],
];
const STATUS_WORDS: [RegExp, GameEvent][] = [
  [/combustion/i, 'combustion'],
  [/corrosion/i, 'corrosion'],
  [/electrification/i, 'electrification'],
  [/solidification/i, 'solidification'],
  [/vulnerab/i, 'vulnerable'],
  [/crush/i, 'crush'],
  [/breach/i, 'breach'],
  [/infliction/i, 'arts-infliction'],
];

/** The game's recommended weapons, ordered by how well each one's boosts and skill match this kit (ties keep the game's order). */
export function orderWeapons(p: OperatorProfile, list: string[], skills: Map<string, WeaponSkillData>): Pick<string[]> {
  const scored = list.map((w, i) => {
    const ws = skills.get(w);
    if (!ws) return { w, i, points: 0, why: `${w}: its skills aren’t on the wiki yet, so it keeps the game’s place.` };
    let points = 0;
    const hits: string[] = [];
    for (const s of ws.skills.slice(0, 2)) {
      const name = s.name.replace(/\s*\[.\]$/, '');
      if (name === p.main || name === 'Main Attribute') {
        points += W.WEAPON_MAIN_ATTR;
        hits.push(`${s.name} (${p.main ?? 'main attribute'})`);
      } else if (name === p.secondary) {
        points += W.WEAPON_SECONDARY_ATTR;
        hits.push(`${s.name} (secondary attribute)`);
      }
    }
    const own = ws.skills[2];
    const text = own?.rank1 ?? '';
    if (new RegExp(`${ELEMENT_WORD[p.element]} DMG`, 'i').test(text) || (isArts(p.element) && /Arts DMG/i.test(text))) {
      points += W.WEAPON_KIT_MATCH;
      hits.push(`${ELEMENT_WORD[p.element]} damage`);
    }
    for (const [re, kind] of SKILL_WORDS)
      if (re.test(text) && (p.damageShare[kind] ?? 0) >= 0.2) {
        points += W.WEAPON_KIT_MATCH * (p.damageShare[kind] ?? 0) * 2;
        hits.push(`${KIND_LABEL[kind]} (${pct(p.damageShare[kind] ?? 0)} of their estimated damage)`);
      }
    for (const [re, ev] of STATUS_WORDS)
      if (re.test(text) && p.causes.has(ev)) {
        points += W.WEAPON_KIT_MATCH;
        hits.push(`their kit applies ${ev.replace('-', ' ')}`);
      }
    const why = `${w}: ${hits.length ? `matches ${hits.join(', ')}` : 'no match with the kit'}${own ? ` (“${text}”)` : ''}.`;
    return { w, i, points, why };
  });
  const sorted = [...scored].sort((a, b) => b.points - a.points || a.i - b.i);
  return { value: sorted.map((x) => x.w), why: sorted.map((x) => x.why) };
}
