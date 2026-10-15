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
import type { PityModel, PityState, PullOutcome, PullRecord } from '../../core/contract';
import { known, unknown, type Known } from '../../core/contract/known';

export type OddsMode = 'official' | 'community';

/**
 * Every result of the next step from a state. Null when the model lacks the
 * numbers this mode needs. A game's own rule (`custom`) brings its own steps,
 * and its numbers are the game's published rules, so both modes use them.
 */
function stepper(model: PityModel, mode: OddsMode): ((s: PityState) => PullOutcome[]) | null {
  switch (model.kind) {
    case 'hard-pity': {
      if (model.baseRate === null) return null;
      if (mode === 'community' && !model.softPity) return null;
      const { hardPity, baseRate, featured, softPity } = model;
      const topRate = (s: PityState) => {
        const n = s.pulls + 1;
        if (n >= hardPity) return 1;
        if (mode === 'community' && softPity && n >= softPity.from) return Math.min(1, baseRate + softPity.stepPerPull * (n - softPity.from + 1));
        return baseRate;
      };
      return (s) => {
        const top = topRate(s);
        const feat = !featured || s.guaranteed ? 1 : featured.winRate;
        return [
          { p: top * feat, next: { pulls: 0, guaranteed: false }, copies: 1 },
          { p: top * (1 - feat), next: { pulls: 0, guaranteed: Boolean(featured?.guaranteeAfterLoss) }, copies: 0 },
          { p: 1 - top, next: { pulls: s.pulls + 1, guaranteed: s.guaranteed }, copies: 0 },
        ];
      };
    }
    case 'spark': {
      if (model.baseRate === null || mode === 'community') return null;
      const { sparkAt, baseRate } = model;
      // baseRate is the featured rate; pulls counts toward the spark exchange.
      return (s) => {
        const top = s.pulls + 1 >= sparkAt ? 1 : baseRate;
        const next = { pulls: s.pulls + 1 >= sparkAt ? 0 : s.pulls + 1, guaranteed: false };
        return [
          { p: top, next, copies: 1 },
          { p: 1 - top, next, copies: 0 },
        ];
      };
    }
    case 'none': {
      if (model.baseRate === null || mode === 'community') return null;
      const rate = model.baseRate;
      return (s) => [
        { p: rate, next: s, copies: 1 },
        { p: 1 - rate, next: s, copies: 0 },
      ];
    }
    case 'custom':
      return model.pull;
  }
}

/** Pulls in one step of a banner: 10 when the game only sells them in tens. */
export const stepOf = (model: PityModel): number => (model.kind === 'custom' ? (model.step ?? 1) : 1);

/** The top-rarity counter's ceiling ("pity 40/80"), or null when the banner has none. */
export function hardPityOf(model: PityModel): number | null {
  if (model.kind === 'hard-pity') return model.hardPity;
  if (model.kind === 'custom') return model.hardPity ?? null;
  return null;
}

/** The featured split (50/50 and what a loss does), when the banner has one. */
export function featuredOf(model: PityModel): { winRate: number; guaranteeAfterLoss: boolean } | undefined {
  return model.kind === 'hard-pity' || model.kind === 'custom' ? model.featured : undefined;
}

/** The odds of a top result being the featured one, in words: "50/50", or the real share ("25% featured", Endfield's weapons). */
export function oddsWord(featured: { winRate: number } | undefined): string {
  return !featured || featured.winRate === 0.5 ? '50/50' : `${Math.round(featured.winRate * 100)}% featured`;
}

/**
 * Chance of getting at least `copies` featured results within `pulls` pulls,
 * starting from `state`. Exact, by stepping through every reachable state.
 * A banner sold in steps of 10 counts only whole steps.
 */
export function chance(model: PityModel, state: PityState, pulls: number, mode: OddsMode, copies = 1): Known<number> {
  const step = stepper(model, mode);
  if (!step) return unknown();
  if (copies <= 0) return known(1, 'official', new Date(0).toISOString());
  const steps = Math.floor(pulls / stepOf(model));
  const key = (s: PityState, c: number) => `${s.pulls}|${s.guaranteed ? 1 : 0}|${c}|${JSON.stringify(s.extra ?? {})}`;
  let dist = new Map<string, { s: PityState; c: number; p: number }>([[key(state, 0), { s: state, c: 0, p: 1 }]]);
  let success = 0;
  for (let i = 0; i < steps; i++) {
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
    for (const { s, c, p } of dist.values()) for (const o of step(s)) add(o.next, c + o.copies, p * o.p);
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
    case 'custom': {
      const w = model.worstCase(state, copies);
      return w === null ? unknown() : known(w, 'official', new Date(0).toISOString());
    }
  }
}

/**
 * Current pity on one banner type from imported history (oldest first or any order).
 * `guaranteeAfterLoss` false (Endfield): a lost 50/50 never makes the next one guaranteed.
 */
export function pityFromHistory(history: PullRecord[], bannerType: string, guaranteeAfterLoss = true): { pity: Known<number>; guaranteed: Known<boolean> } {
  const pulls = history.filter((p) => p.bannerType === bannerType).sort((a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id));
  if (pulls.length === 0) return { pity: unknown('import-history'), guaranteed: unknown('import-history') };
  const lastTop = findLastIndex(pulls, (p) => p.rarity === 'top');
  const at = new Date().toISOString();
  const pity = known(pulls.length - 1 - lastTop, 'import', at);
  if (lastTop === -1 || !guaranteeAfterLoss) return { pity, guaranteed: known(false, 'import', at) };
  const f = pulls[lastTop]?.featured;
  return { pity, guaranteed: f === undefined ? unknown('import-history') : known(!f, 'import', at) };
}

/**
 * Counted pulls on the current banner of a type (pulls since it opened) and
 * whether its featured result came: the `extra` a game's own rule reads.
 */
export function bannerProgress(history: PullRecord[], bannerType: string, since: number): { banner: number; got: number } {
  const on = history.filter((p) => p.bannerType === bannerType && Date.parse(p.time) >= since);
  return { banner: on.length, got: on.some((p) => p.rarity === 'top' && p.featured === true) ? 1 : 0 };
}

/**
 * Free pulls a banner starts with from the one before it of the same type
 * (Endfield's Headhunting Dossier): `carry.pulls` when history shows at least
 * `carry.after` pulls on the previous banner and none on this one yet (the
 * first pull uses them). 0 otherwise.
 */
export function carryIn(
  history: PullRecord[],
  banners: { type: string; start: string }[],
  banner: { type: string; start: string },
  carry: { after: number; pulls: number },
): number {
  const start = Date.parse(banner.start);
  const prev = banners.filter((x) => x.type === banner.type && Date.parse(x.start) < start).sort((a, b) => Date.parse(b.start) - Date.parse(a.start))[0];
  if (!prev) return 0;
  const from = Date.parse(prev.start);
  const of = history.filter((p) => p.bannerType === banner.type);
  const onPrev = of.filter((p) => Date.parse(p.time) >= from && Date.parse(p.time) < start).length;
  const onThis = of.filter((p) => Date.parse(p.time) >= start).length;
  return onPrev >= carry.after && onThis === 0 ? carry.pulls : 0;
}

export interface LuckStats {
  tops: number;
  averagePity: Known<number>;
  fiftyFifty: { won: number; lost: number; unknown: number };
}

/**
 * Luck from history: average pulls per top result and the 50/50 record. Without a guarantee after a loss, every top result is a 50/50.
 * `fiftyFifty` false: the banner type has no featured result (a standard banner), so nothing on it is a 50/50 won or lost.
 */
export function luck(history: PullRecord[], bannerType: string, guaranteeAfterLoss = true, fiftyFifty = true): LuckStats {
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
    if (!fiftyFifty) continue;
    if (guaranteedNext) {
      guaranteedNext = false; // a guaranteed result is not a 50/50
      continue;
    }
    if (p.featured === undefined) ff.unknown++;
    else if (p.featured) ff.won++;
    else {
      ff.lost++;
      guaranteedNext = guaranteeAfterLoss;
    }
  }
  const at = new Date().toISOString();
  return {
    tops: gaps.length,
    averagePity: gaps.length ? known(gaps.reduce((a, b) => a + b, 0) / gaps.length, 'import', at) : unknown('import-history'),
    fiftyFifty: ff,
  };
}

/** luck() with the banner type's own rules: its guarantee after a loss, and no 50/50 at all where nothing is featured. */
export function luckOf(history: PullRecord[], type: { id: string; pity: PityModel }): LuckStats {
  const featured = featuredOf(type.pity);
  return luck(history, type.id, featured?.guaranteeAfterLoss ?? true, featured !== undefined);
}

export interface BannerRules {
  guarantee: boolean;
  featured: boolean;
}

/** Per-banner-type rules for the server's pull_numbers: guarantee-after-loss and whether there's a featured split. */
export function bannerRulesOf(game: { bannerTypes: readonly { id: string; pity: PityModel }[] }): Record<string, BannerRules> {
  const rules: Record<string, BannerRules> = {};
  for (const bt of game.bannerTypes) {
    const f = featuredOf(bt.pity);
    rules[bt.id] = { guarantee: f?.guaranteeAfterLoss ?? true, featured: f !== undefined };
  }
  return rules;
}

function findLastIndex<T>(list: T[], test: (x: T) => boolean): number {
  for (let i = list.length - 1; i >= 0; i--) if (test(list[i] as T)) return i;
  return -1;
}
