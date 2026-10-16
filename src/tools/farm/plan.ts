/**
 * Farm maths: total materials for the characters you chose, runs, stamina and
 * days. Every number comes from the game's own rule and material list; when
 * either is missing the result is unknown, never a guess. Pure: no React.
 */
import type { BuildLevel, GameContract, Material, StaminaPool } from '../../core/contract';
import { known, unknown, type Known } from '../../core/contract/known';

/** From a new character to fully built. The game's rule caps `to` at its own highest level. */
const FROM: BuildLevel = { level: 1 };
const FULL: BuildLevel = { level: Number.POSITIVE_INFINITY };

export interface NeedRow {
  material: string;
  name: string;
  /** Its picture, when the game data has one. */
  icon?: string;
  /** Where it comes from (Material.sources), when the game data lists it. */
  sources?: string[];
  amount: number;
  /** Runs to farm it: unknown when the material's drops per run aren't listed. */
  runs: Known<number>;
  /** Stamina for those runs: unknown when runs or stamina per run aren't listed. */
  stamina: Known<number>;
}

export interface FarmPlan {
  needs: Known<NeedRow[]>;
  stamina: Known<number>;
  /** Chosen characters the game has no material amounts for yet (e.g. one not released): not in the rows, and no total. */
  left: string[];
}

export function farmPlan(game: GameContract, characterIds: string[], materials: Material[]): FarmPlan {
  const rule = game.rules.materialsFor;
  if (!rule || characterIds.length === 0) return { needs: unknown(), stamina: unknown(), left: [] };
  const totals = new Map<string, number>();
  const left: string[] = [];
  for (const id of characterIds) {
    const needs = rule(id, FROM, FULL);
    if (needs.length === 0) left.push(id);
    for (const n of needs) totals.set(n.material, (totals.get(n.material) ?? 0) + n.amount);
  }
  // The game has amounts, just none for these characters yet (e.g. not released): no rows, never example rows.
  if (totals.size === 0) return { needs: known([], 'official'), stamina: unknown(), left };

  const rows: NeedRow[] = [...totals].map(([material, amount]) => {
    const m = materials.find((x) => x.id === material);
    const runs = m?.dropsPerRun ? known(Math.ceil(amount / m.dropsPerRun), 'official') : unknown<number>();
    const stamina = runs.known && m?.staminaPerRun ? known(runs.value * m.staminaPerRun, 'official') : unknown<number>();
    return { material, name: m?.name ?? material, ...(m?.icon ? { icon: m.icon } : {}), ...(m?.sources?.length ? { sources: m.sources } : {}), amount, runs, stamina };
  });
  // A total is shown only when every farmable row is known and every chosen character is counted: a partial sum would look complete.
  const allKnown = left.length === 0 && rows.every((r) => r.stamina.known);
  const total = rows.reduce((sum, r) => sum + (r.stamina.known ? r.stamina.value : 0), 0);
  return { needs: known(rows, 'official'), stamina: allKnown ? known(total, 'official') : unknown(), left };
}

export function weaponFarmPlan(game: GameContract, weaponIds: string[], materials: Material[]): FarmPlan {
  const rule = game.rules.weaponMaterialsFor;
  if (!rule || weaponIds.length === 0) return { needs: unknown(), stamina: unknown(), left: [] };
  const totals = new Map<string, number>();
  for (const id of weaponIds) for (const n of rule(id, FROM, FULL).needs) totals.set(n.material, (totals.get(n.material) ?? 0) + n.amount);
  if (totals.size === 0) return { needs: unknown(), stamina: unknown(), left: [] };

  const rows: NeedRow[] = [...totals].map(([material, amount]) => {
    const m = materials.find((x) => x.id === material);
    const runs = m?.dropsPerRun ? known(Math.ceil(amount / m.dropsPerRun), 'official') : unknown<number>();
    const stamina = runs.known && m?.staminaPerRun ? known(runs.value * m.staminaPerRun, 'official') : unknown<number>();
    return { material, name: m?.name ?? material, ...(m?.icon ? { icon: m.icon } : {}), ...(m?.sources?.length ? { sources: m.sources } : {}), amount, runs, stamina };
  });
  const allKnown = rows.every((r) => r.stamina.known);
  const total = rows.reduce((sum, r) => sum + (r.stamina.known ? r.stamina.value : 0), 0);
  return { needs: known(rows, 'official'), stamina: allKnown ? known(total, 'official') : unknown(), left: [] };
}

/** Points a pool refills per day, from the game record's regeneration rate. */
export const perDay = (pool: StaminaPool) => Math.floor((24 * 60) / pool.minutesPerPoint);

export function daysToFinish(stamina: Known<number>, pool: StaminaPool | undefined): Known<number> {
  if (!stamina.known || !pool || perDay(pool) <= 0) return unknown();
  return known(Math.ceil(stamina.value / perDay(pool)), stamina.source, stamina.at);
}
