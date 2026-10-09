/**
 * Pity engine (docs/PLAN.md §4, FEATURES Connection 2). Pure functions.
 * Works for any PityModel in the contract, including a game's own rule,
 * by stepping through states. Two odds modes:
 *  - 'official': only published numbers (base rate, hard pity, 50/50)
 *  - 'community': adds community-measured rising odds, labelled as such in the UI
 * Chance needs pull history (DESIGN: locked until history). Worst case uses only
 * official hard pity, so it can be shown without history (assuming pity 0 and a
 * 50/50 still to play).
 */
import type { PityModel, PityState, PullRecord } from '../../core/contract';
import { known, unknown, type Known } from '../../core/contract/known';

export type OddsMode = 'official' | 'community';

interface Stepper {
  topRate(s: PityState): number;
  featuredRate(s: PityState): number;
  next(s: PityState, gotTop: boolean, gotFeatured: boolean): PityState;
}

/** null when the model lacks the numbers this mode needs. */
function stepper(model: PityModel, mode: OddsMode): Stepper | null {
  switch (model.kind) {
    case 'hard-pity': {
      if (model.baseRate === null) return null;
      if (mode === 'community' && !model.softPity) return null;
      const { hardPity, baseRate, featured, softPity } = model;
      return {
        topRate: (s) => {
          const n = s.pulls + 1;
          if (n >= hardPity) return 1;
          if (mode === 'community' && softPity && n >= softPity.from) return Math.min(1, baseRate + softPity.stepPerPull * (n - softPity.from + 1));
          return baseRate;
        },
        featuredRate: (s) => (!featured || s.guaranteed ? 1 : featured.winRate),
        next: (s, gotTop, gotFeatured) =>
          gotTop
            ? { pulls: 0, guaranteed: Boolean(featured && !gotFeatured && featured.guaranteeAfterLoss) }
            : { pulls: s.pulls + 1, guaranteed: s.guaranteed },
      };
    }
    case 'spark': {
      if (model.baseRate === null || mode === 'community') return null;
      const { sparkAt, baseRate } = model;
      // baseRate is the featured rate; pulls counts toward the spark exchange.
      return {
        topRate: (s) => (s.pulls + 1 >= sparkAt ? 1 : baseRate),
        featuredRate: () => 1,
        next: (s) => ({ pulls: s.pulls + 1 >= sparkAt ? 0 : s.pulls + 1, guaranteed: false }),
      };
    }
    case 'none':
      if (model.baseRate === null || mode === 'community') return null;
      return { topRate: () => model.baseRate as number, featuredRate: () => 1, next: (s) => s };
    case 'custom':
      if (mode === 'community') return null;
      return { topRate: model.topRate, featuredRate: () => 1, next: model.next };
  }
}

/**
 * Chance of getting at least `copies` featured results within `pulls` pulls,
 * starting from `state`. Exact, by stepping through every reachable state.
 */
export function chance(model: PityModel, state: PityState, pulls: number, mode: OddsMode, copies = 1): Known<number> {
  const step = stepper(model, mode);
  if (!step) return unknown();
  if (copies <= 0) return known(1, 'official', new Date(0).toISOString());
  const key = (s: PityState, c: number) => `${s.pulls}|${s.guaranteed ? 1 : 0}|${c}|${JSON.stringify(s.extra ?? {})}`;
  let dist = new Map<string, { s: PityState; c: number; p: number }>([[key(state, 0), { s: state, c: 0, p: 1 }]]);
  let success = 0;
  for (let i = 0; i < pulls; i++) {
    const nextDist = new Map<string, { s: PityState; c: number; p: number }>();
    const add = (s: PityState, c: number, p: number) => {
      if (p <= 0) return;
      if (c >= copies) {
        success += p;
        return;
      }
      const k = key(s, c);
      const cur = nextDist.get(k);
      if (cur) cur.p += p;
      else nextDist.set(k, { s, c, p });
    };
    for (const { s, c, p } of dist.values()) {
      const top = step.topRate(s);
      const feat = step.featuredRate(s);
      add(step.next(s, true, true), c + 1, p * top * feat);
      add(step.next(s, true, false), c, p * top * (1 - feat));
      add(step.next(s, false, false), c, p * (1 - top));
    }
    dist = nextDist;
    if (dist.size === 0) break;
  }
  return known(Math.min(1, success), 'official', new Date(0).toISOString());
}

/**
 * Most pulls that could be needed for `copies` featured results. Official numbers only.
 * Unknown when the model has no ceiling (no hard pity, or a 50/50 without guarantee).
 */
export function worstCase(model: PityModel, state: PityState, copies = 1): Known<number> {
  if (copies <= 0) return known(0, 'official', new Date(0).toISOString());
  switch (model.kind) {
    case 'hard-pity': {
      const { hardPity, featured } = model;
      if (featured && featured.winRate < 1 && !featured.guaranteeAfterLoss) return unknown();
      const perCopy = featured && featured.winRate < 1 ? 2 * hardPity : hardPity;
      const first = hardPity - state.pulls + (featured && featured.winRate < 1 && !state.guaranteed ? hardPity : 0);
      return known(first + (copies - 1) * perCopy, 'official', new Date(0).toISOString());
    }
    case 'spark':
      return known(model.sparkAt - state.pulls + (copies - 1) * model.sparkAt, 'official', new Date(0).toISOString());
    case 'none':
      return unknown();
    case 'custom':
      return known(model.worstCase(state) + (copies - 1) * model.worstCase({ pulls: 0, guaranteed: false }), 'official', new Date(0).toISOString());
  }
}

/** Current pity on one banner type from imported history (oldest first or any order). */
export function pityFromHistory(history: PullRecord[], bannerType: string): { pity: Known<number>; guaranteed: Known<boolean> } {
  const pulls = history.filter((p) => p.bannerType === bannerType).sort((a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id));
  if (pulls.length === 0) return { pity: unknown('import-history'), guaranteed: unknown('import-history') };
  const lastTop = findLastIndex(pulls, (p) => p.rarity === 'top');
  const at = new Date().toISOString();
  const pity = known(pulls.length - 1 - lastTop, 'import', at);
  if (lastTop === -1) return { pity, guaranteed: known(false, 'import', at) };
  const f = pulls[lastTop]?.featured;
  return { pity, guaranteed: f === undefined ? unknown('import-history') : known(!f, 'import', at) };
}

export interface LuckStats {
  tops: number;
  averagePity: Known<number>;
  fiftyFifty: { won: number; lost: number; unknown: number };
}

/** Luck from history: average pulls per top result and the 50/50 record. */
export function luck(history: PullRecord[], bannerType: string): LuckStats {
  const pulls = history.filter((p) => p.bannerType === bannerType).sort((a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id));
  const gaps: number[] = [];
  let since = 0;
  let guaranteedNext = false;
  const ff = { won: 0, lost: 0, unknown: 0 };
  for (const p of pulls) {
    since++;
    if (p.rarity !== 'top') continue;
    gaps.push(since);
    since = 0;
    if (guaranteedNext) {
      guaranteedNext = false; // a guaranteed result is not a 50/50
      continue;
    }
    if (p.featured === undefined) ff.unknown++;
    else if (p.featured) ff.won++;
    else {
      ff.lost++;
      guaranteedNext = true;
    }
  }
  const at = new Date().toISOString();
  return {
    tops: gaps.length,
    averagePity: gaps.length ? known(gaps.reduce((a, b) => a + b, 0) / gaps.length, 'import', at) : unknown('import-history'),
    fiftyFifty: ff,
  };
}

function findLastIndex<T>(list: T[], test: (x: T) => boolean): number {
  for (let i = list.length - 1; i >= 0; i--) if (test(list[i] as T)) return i;
  return -1;
}
