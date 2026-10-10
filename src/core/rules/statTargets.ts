/**
 * End stats to build a character towards (owner's job T35). Honest: only numbers the game text states, from the
 * character's kit, their signature weapon and the sets the game recommends for them, each with its quote; where the
 * text gives a step and a cap, the working is shown. Nothing else is guessed: no rows = "No data yet". The saved
 * build's totals (the game's stat screen) are "you". Game-free: each game hands over its read facts.
 * Rules: docs/logic/build-score.md, "Target stats".
 */
import type { CharacterBuild, RecommendedBuild, StatTargetRow, StatTargets } from '../contract';

/** One number from the game text. */
export interface TargetFact {
  /** The game's stat name, as the stat screen shows it. */
  stat: string;
  /** The number to reach; for `from`, the point above which the effect starts. */
  value: number;
  unit: '%' | '';
  /** full: the effect is at its maximum here; step: the highest of several steps; from: it starts here, no cap in the text. */
  kind: 'full' | 'step' | 'from';
  /** For `step`: every step, low to high. */
  steps?: number[];
  /** What reaching it does, in plain words. */
  why: string;
  /** The game text, word for word. */
  quote: string;
  working?: string;
  condition?: string;
  /** "initial" (ZZZ: before in-battle buffs) or "current"; said with the target when the text says it. */
  basis?: string;
}

/** A character's own facts: from their kit (`piece` names the kit piece) or their signature weapon. */
export interface CharacterFact extends TargetFact {
  characterId: string;
  /** "Kit: Trace: Hearth Kindle" or "Signature: I Venture Forth to Hunt". */
  source: string;
}

/** A gear set's own condition, shown for characters the game recommends that set for. */
export interface SetFact extends TargetFact {
  set: string;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/ ?%$/, '');
const num = (v: number) => (Number.isInteger(v) ? v.toLocaleString('en-US') : String(Math.round(v * 1000) / 1000));
const show = (v: number, unit: string) => `${num(v)}${unit}`;

function targetWords(f: TargetFact): string {
  const v = show(f.value, f.unit);
  const basis = f.basis ? ` ${f.basis}` : '';
  if (f.kind === 'from') return `above ${v}${basis} (no cap in the text)`;
  if (f.kind === 'step' && f.steps && f.steps.length > 1) return `${v}${basis} (steps ${f.steps.map((s) => show(s, f.unit)).join(' / ')})`;
  return `${v}${basis}`;
}

/** The saved total for a stat, matched by name (ignoring case, spaces and a trailing %). */
export function totalOf(build: CharacterBuild | undefined, stat: string): number | undefined {
  const t = build?.totals;
  if (!t) return undefined;
  const key = Object.keys(t).find((k) => norm(k) === norm(stat));
  return key === undefined ? undefined : t[key];
}

function row(f: TargetFact, source: string, build: CharacterBuild | undefined): StatTargetRow {
  const you = totalOf(build, f.stat);
  return {
    stat: f.stat,
    target: targetWords(f),
    ...(you !== undefined ? { you: show(you, f.unit), met: f.kind === 'from' ? you > f.value : you >= f.value } : {}),
    why: f.why,
    source,
    quote: f.quote,
    ...(f.working ? { working: f.working } : {}),
    ...(f.condition ? { condition: f.condition } : {}),
  };
}

/** Everything a character's page shows: their own facts, then the recommended sets' conditions, then the direction. */
export function statTargets(
  characterId: string,
  facts: CharacterFact[],
  sets: SetFact[],
  recommended: RecommendedBuild | undefined,
  build?: CharacterBuild,
): StatTargets {
  const rows = facts.filter((f) => f.characterId === characterId).map((f) => row(f, f.source, build));
  const recSets = new Set(recommended?.sets.flatMap((s) => s.options) ?? []);
  for (const s of sets) if (recSets.has(s.set)) rows.push(row({ ...s, condition: s.condition ?? `with ${s.set}` }, `Set: ${s.set} (recommended)`, build));
  return {
    rows,
    ...(recommended && (Object.keys(recommended.mainStats).length || recommended.subStats.length)
      ? { direction: { mains: recommended.mainStats, subs: recommended.subStats, source: recommended.source } }
      : {}),
  };
}
