/**
 * Endfield level-up costs (E7; scripts/import-endfield-costs.ts, endfield.wiki.gg): what an operator needs from
 * one level to another. Pure, no guessing: an operator the data doesn't cover needs nothing listed (the screen
 * says "No data yet"). Operator EXP is counted in Advanced Combat Records (up to level 60) and Advanced Cognitive
 * Carriers (61–90), 10,000 EXP each, as the wiki's Operator page lists them.
 */
import type { BuildLevel, MaterialNeed } from '../../core/contract';
import costs from './data/costs.json';

type Items = Record<string, number>;
interface Track {
  id: string;
  label: string;
  max: number;
  steps: Record<string, Items>;
}
interface OperatorCosts {
  promotions: { atLevel: number; items: Items }[];
  tracks: Track[];
}
interface WeaponCosts {
  max: number;
  /** Totals from level 1, only at these levels (the wiki has no per-level table). */
  milestones: { level: number; exp: number; creds: number }[];
  expItem: string;
  expPer: number;
  credsItem: string;
  list: Record<string, { tunings: { atLevel: number; items: Items }[] }>;
}
interface CostFile {
  levels: { max: number; exp: number[]; creds: number[]; credsItem: string; expItems: { upTo: number; item: string; exp: number }[] };
  operators: Record<string, OperatorCosts>;
  weapons: WeaponCosts;
}

const data = costs as unknown as CostFile;
/** The highest operator level. */
export const MAX_LEVEL = data.levels.max;

/** The tracks (combat skills, then Ability Matrix nodes) whose levels BuildLevel.skills lists, in that order. */
export const skillsOf = (characterId: string) => data.operators[characterId]?.tracks.map((t) => ({ id: t.id, label: t.label, max: t.max })) ?? [];

export function materialsFor(characterId: string, from: BuildLevel, to: BuildLevel): MaterialNeed[] {
  const c = data.operators[characterId];
  if (!c) return [];
  const totals = new Map<string, number>();
  const add = (items: Items) => {
    for (const [id, n] of Object.entries(items)) totals.set(id, (totals.get(id) ?? 0) + n);
  };
  const lo = Math.max(1, Math.min(from.level, MAX_LEVEL));
  const hi = Math.max(lo, Math.min(to.level, MAX_LEVEL));
  // A promotion at a level cap is needed to go past it.
  for (const p of c.promotions) if (p.atLevel >= lo && p.atLevel < hi) add(p.items);
  // Levels lo+1 … hi: EXP in the item for that range, and T-Creds.
  const { exp, creds, credsItem, expItems } = data.levels;
  const byItem = new Map<string, { exp: number; per: number }>();
  let tCreds = 0;
  for (let lv = lo + 1; lv <= hi; lv++) {
    const it = expItems.find((x) => lv <= x.upTo);
    if (!it) continue;
    const cur = byItem.get(it.item) ?? { exp: 0, per: it.exp };
    cur.exp += exp[lv] ?? 0;
    byItem.set(it.item, cur);
    tCreds += creds[lv] ?? 0;
  }
  for (const [item, v] of byItem) if (v.exp > 0) add({ [item]: Math.ceil(v.exp / v.per) });
  if (tCreds > 0) add({ [credsItem]: tCreds });
  c.tracks.forEach((t, i) => {
    const levels = Object.keys(t.steps).map(Number);
    const base = Math.min(...levels) - 1;
    const f = Math.max(base, Math.min(from.skills?.[i] ?? base, t.max));
    const top = Math.max(f, Math.min(to.skills?.[i] ?? t.max, t.max));
    for (const lv of levels) if (lv > f && lv <= top) add(t.steps[String(lv)] ?? {});
  });
  return [...totals].map(([material, amount]) => ({ material, amount }));
}

/**
 * What a weapon needs from one level to another: tuning stages to pass each level cap, plus Weapon EXP (in Arms
 * INSP Sets, 10,000 EXP each) and T-Creds. The wiki gives those two only as totals at levels 20, 40, 60, 80 and 90,
 * so only whole stretches between those levels are counted; anything else is named in `partial`, never estimated.
 */
export function weaponMaterialsFor(weaponId: string, from: BuildLevel, to: BuildLevel): { needs: MaterialNeed[]; partial?: string } {
  const all = data.weapons;
  const w = all.list[weaponId];
  if (!w) return { needs: [] };
  const lo = Math.max(1, Math.min(from.level, all.max));
  const hi = Math.max(lo, Math.min(to.level, all.max));
  const totals = new Map<string, number>();
  const add = (id: string, n: number) => n > 0 && totals.set(id, (totals.get(id) ?? 0) + n);
  for (const t of w.tunings) if (t.atLevel >= lo && t.atLevel < hi) for (const [id, n] of Object.entries(t.items)) add(id, n);
  const points = [{ level: 1, exp: 0, creds: 0 }, ...all.milestones];
  let exp = 0;
  let creds = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a && b && a.level >= lo && b.level <= hi) {
      exp += b.exp - a.exp;
      creds += b.creds - a.creds;
    }
  }
  add(all.expItem, Math.ceil(exp / all.expPer));
  add(all.credsItem, creds);
  const needs = [...totals].map(([material, amount]) => ({ material, amount }));
  const known = new Set(points.map((p) => p.level));
  if (lo === hi || (known.has(lo) && known.has(hi))) return { needs };
  const levels = all.milestones.map((m) => m.level).join(', ');
  return { needs, partial: `Weapon EXP and T-Creds between levels ${lo} and ${hi} are counted only for whole stretches between levels 1, ${levels}: the wiki gives them only as totals at those levels.` };
}
