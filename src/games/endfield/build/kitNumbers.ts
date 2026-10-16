/**
 * The numbers in a kit's own text (data/kits.json, "At level 12: …"): each combat skill's damage multipliers
 * per use, and what limits how often it's used (SP cost, cooldown, Ultimate Energy cost). The uses per minute
 * are an estimate from those costs (weights.ts B7), and every reason built on them says so.
 */
import type { SkillKind } from '../kitcheck/types';
import { BASIC_CHAIN_SECONDS, BASIC_CHAINS_PER_MINUTE, COMBO_MAX_PER_MINUTE, SP_PER_MINUTE, ULT_ENERGY_PER_MINUTE } from './weights';

export interface KitSkillText {
  id: string;
  label: string;
  gameText: string;
}

export const KIND_LABEL: Record<SkillKind, string> = { basic: 'Basic Attack', battle: 'Battle Skill', combo: 'Combo Skill', ultimate: 'Ultimate' };
const KIND_OF_LABEL: [string, SkillKind][] = Object.entries(KIND_LABEL).map(([k, v]) => [v, k as SkillKind]);

export interface SkillNumbers {
  kind: SkillKind;
  /** The skill's name in the game ("Twilight"). */
  name: string;
  /** Sum of its damage multipliers per use, in % of ATK (situational Finisher and Dive hits left out). */
  perUse: number;
  /** The cost that limits it, in the game's words ("SP Cost: 100"), when the text gives one. */
  cost?: string;
  /** Estimated uses a minute, from that cost. */
  perMinute: number;
  /** perUse × perMinute. */
  perMinuteDamage: number;
  /** How perMinute was estimated, for the reason ("estimated from SP Cost: 100"). */
  estimate: string;
}

/** "At level 12: A: 1; B Multiplier: 56%; …" → [['A', '1'], ['B Multiplier', '56%'], …]. */
export function levelPairs(gameText: string): [string, string][] {
  const at = gameText.lastIndexOf('At level 12:');
  if (at < 0) return [];
  return gameText
    .slice(at + 'At level 12:'.length)
    .split(';')
    .map((p) => p.trim().replace(/\.$/, ''))
    .flatMap((p) => {
      const i = p.lastIndexOf(':');
      return i > 0 ? [[p.slice(0, i).trim(), p.slice(i + 1).trim()] as [string, string]] : [];
    });
}

const number = (v: string) => Number.parseFloat(v.replace(/[^\d.]/g, '')) || 0;

/** One combat skill's numbers, or none for a piece that isn't one of the four combat skills. */
export function skillNumbers(s: KitSkillText): SkillNumbers | null {
  const kindLabel = KIND_OF_LABEL.find(([label]) => s.label.startsWith(`${label}:`));
  if (!kindLabel) return null;
  const [label, kind] = kindLabel;
  const name = s.label.slice(label.length + 1).trim();
  const pairs = levelPairs(s.gameText);
  const value = (key: RegExp) => pairs.find(([k]) => key.test(k))?.[1];
  // Damage per use: every multiplier, except situational hits and lines that belong to another skill's window.
  const counted = pairs.filter(([k, v]) => /Multiplier/i.test(k) && /%/.test(v) && !/Finisher|Dive/i.test(k) && !(kind !== 'ultimate' && /^During Ultimate/i.test(k)));
  let perUse = counted.reduce((sum, [, v]) => sum + number(v), 0);
  let perMinute: number;
  let cost: string | undefined;
  let estimate: string;
  if (kind === 'basic') {
    perMinute = BASIC_CHAINS_PER_MINUTE;
    estimate = `estimated at ${BASIC_CHAINS_PER_MINUTE} attack chains a minute`;
  } else if (kind === 'battle') {
    const sp = number(value(/^SP Cost$/i) ?? '100') || 100;
    cost = `SP Cost: ${sp}`;
    perMinute = SP_PER_MINUTE / sp;
    estimate = `estimated from ${cost}`;
  } else if (kind === 'combo') {
    const cd = number(value(/^Cooldown$/i) ?? '0');
    cost = cd ? `Cooldown: ${cd}s` : undefined;
    perMinute = Math.min(cd ? 60 / cd : COMBO_MAX_PER_MINUTE, COMBO_MAX_PER_MINUTE);
    estimate = cd ? `estimated from ${cost}, at most ${COMBO_MAX_PER_MINUTE} a minute (it also needs its trigger)` : `estimated at ${COMBO_MAX_PER_MINUTE} a minute`;
  } else {
    const energy = number(value(/^Ultimate Energy Cost$/i) ?? '0');
    cost = energy ? `Ultimate Energy Cost: ${energy}` : undefined;
    perMinute = energy ? ULT_ENERGY_PER_MINUTE / energy : 1;
    estimate = energy ? `estimated from ${cost}` : 'estimated at once a minute';
    // An ultimate that powers up basic attacks for a while: its enhanced chain, repeated over the duration.
    const duration = number(value(/^Duration \(s\)$/i) ?? '0');
    const enhanced = counted.filter(([k]) => /^Enhanced BATK/i.test(k)).reduce((sum, [, v]) => sum + number(v), 0);
    if (enhanced && duration) {
      perUse = perUse - enhanced + enhanced * (duration / BASIC_CHAIN_SECONDS);
      estimate += ` and its ${duration}s of enhanced attacks`;
    }
  }
  return { kind, name, perUse, ...(cost ? { cost } : {}), perMinute, perMinuteDamage: perUse * perMinute, estimate };
}

/** The four combat skills of a kit (the first of each kind when a kit has variants, e.g. Arcane's INT / WILL). */
export function kitSkills(skills: KitSkillText[]): SkillNumbers[] {
  const out = new Map<SkillKind, SkillNumbers>();
  for (const s of skills) {
    const n = skillNumbers(s);
    if (n && !out.has(n.kind)) out.set(n.kind, n);
  }
  return [...out.values()];
}
