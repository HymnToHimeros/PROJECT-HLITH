/**
 * HSR level-up costs (scripts/import-nanoka-costs.ts, nanoka.cc): what a
 * character needs from one level to another. Pure, no guessing: a character
 * the data doesn't cover needs nothing listed (the screen says "No data yet").
 * Character EXP per level comes from the game's own EXP table, counted in Traveler's Guides (scripts/import-nanoka-costs.ts).
 */
import type { BuildLevel, MaterialNeed } from '../../core/contract';
import costs from './data/costs.json';

type Items = Record<string, number>;
interface CharacterCosts {
  promotions: { atLevel: number; items: Items }[];
  skills: { id: string; label: string; max: number; steps: Record<string, Items> }[];
}
interface CostFile {
  exp: { perLevel: number[]; item: string; itemExp: number } | null;
  characters: Record<string, CharacterCosts>;
}

const data = costs as unknown as CostFile;
/** The highest character level. */
export const MAX_LEVEL = 80;

/** The skills (and Traces) whose levels BuildLevel.skills lists, in that order. */
export const skillsOf = (characterId: string) => data.characters[characterId]?.skills.map((s) => ({ id: s.id, label: s.label, max: s.max })) ?? [];

export function materialsFor(characterId: string, from: BuildLevel, to: BuildLevel): MaterialNeed[] {
  const c = data.characters[characterId];
  if (!c) return [];
  const totals = new Map<string, number>();
  const add = (items: Items) => {
    for (const [id, n] of Object.entries(items)) totals.set(id, (totals.get(id) ?? 0) + n);
  };
  const lo = Math.max(1, Math.min(from.level, MAX_LEVEL));
  const hi = Math.max(lo, Math.min(to.level, MAX_LEVEL));
  // Ascension at a level cap is needed to go past it.
  for (const p of c.promotions) if (p.atLevel >= lo && p.atLevel < hi) add(p.items);
  if (data.exp) {
    const exp = data.exp.perLevel.slice(lo - 1, hi - 1).reduce((a, b) => a + b, 0);
    if (exp > 0) add({ [data.exp.item]: Math.ceil(exp / data.exp.itemExp) });
  }
  c.skills.forEach((s, i) => {
    const levels = Object.keys(s.steps).map(Number);
    const base = Math.min(...levels) - 1;
    const f = Math.max(base, Math.min(from.skills?.[i] ?? base, s.max));
    const t = Math.max(f, Math.min(to.skills?.[i] ?? s.max, s.max));
    for (const lv of levels) if (lv > f && lv <= t) add(s.steps[String(lv)] ?? {});
  });
  return [...totals].map(([material, amount]) => ({ material, amount }));
}
