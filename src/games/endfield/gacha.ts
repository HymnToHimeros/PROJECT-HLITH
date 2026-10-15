/**
 * Arknights: Endfield pull rules (E3), as `custom` pity models the pity
 * engine steps through. Endfield-only rules live here, never in tools/.
 *
 * Sources (read 2026-10-15; the wiki quotes the game's own rules text):
 * - Operators: endfield.wiki.gg/wiki/Headhunting
 * - Weapons: endfield.wiki.gg/wiki/Arsenal_Exchange
 *
 * State: `pulls` = pulls since the last 6★ (carries between banners of the
 * same type); `guaranteed` is always false (a lost 50/50 guarantees nothing);
 * `extra.banner` = counted pulls on this banner (weapons: 10 per issue),
 * `extra.got` = 1 once the featured 6★ came on this banner (both reset when
 * the banner ends).
 */
import type { PityModel, PityState, PullOutcome } from '../../core/contract';

export const HEADHUNTING_SOURCE = 'endfield.wiki.gg Headhunting (the game’s rules text), read 2026-10-15';
export const ARSENAL_SOURCE = 'endfield.wiki.gg Arsenal Exchange (the game’s rules text), read 2026-10-15';

/** Operator banner numbers. */
export const OPERATOR = {
  baseRate: 0.008,
  hardPity: 80,
  /** From the 66th pull without a 6★, each pull adds 5% (5.8% on the 66th, 10.8% on the 67th…). */
  softAfter: 65,
  softStep: 0.05,
  /** Chartered (limited): 50/50, no guarantee after a loss. */
  winRate: 0.5,
  /** Once per banner: the 120th pull is the featured operator if it hasn't come yet. */
  guaranteeAt: 120,
  /** Every 240th pull on the banner gives a copy (Potential token) of the featured operator. */
  tokenEvery: 240,
  /** Urgent Recruitment: a free 10-pull after 30 pulls on the banner, at base rates; touches no counter. RE-Factor (rerun): after 30, 60 and 90. */
  urgentAt: 30,
  rerunUrgentAt: [30, 60, 90],
  urgentSize: 10,
  /** Headhunting Dossier: after 60 pulls, the next banner's first 10-pull is free (and counts normally). */
  dossierAt: 60,
  dossierSize: 10,
  /** Basic (standard): a 6★ of your choice at 300 pulls. */
  selectorAt: 300,
  /** New Horizons (beginner): a 6★ within 40 pulls. */
  beginnerHardPity: 40,
} as const;

/** Weapon (Arsenal Issue) numbers. One issue = 10 weapons for 1980 Arsenal Tickets. */
export const ARSENAL = {
  issueSize: 10,
  issueCost: 1980,
  topRate: 0.04,
  winRate: 0.25,
  /** No 6★ in 3 issues in a row → the 4th issue has one. */
  guaranteeIssues: 4,
  /** Once per banner: the 8th issue has the featured weapon if it hasn't come yet. */
  featuredIssue: 8,
  /** Featured weapon given at issue 18, then every 16 issues (34, 50…); a selection box at 10, 26… (not counted: not the featured weapon). Official: crate and weapon "in alternating order"; the numbers are the wiki's. */
  bonusFirst: 18,
  bonusEvery: 16,
} as const;

/** Arsenal Tickets each operator gives, by rarity (also from events and shop operators). */
export const ARSENAL_TICKETS = { top: 2000, mid: 200, low: 20 } as const;

/** Arsenal Tickets an operator pull gives for sure, on average: 20 for a 4★, and a 5★ (200) at least every 10 pulls → 380 per 10. */
export const ARSENAL_TICKETS_AT_LEAST_PER_PULL = (9 * ARSENAL_TICKETS.low + ARSENAL_TICKETS.mid) / 10;

const bannerOf = (s: PityState) => s.extra?.banner ?? 0;
const gotOf = (s: PityState) => (s.extra?.got ?? 0) > 0;

/** The 6★ rate on the next counted pull, from pulls since the last 6★. */
export function operatorTopRate(pullsSinceTop: number): number {
  const n = pullsSinceTop + 1;
  if (n >= OPERATOR.hardPity) return 1;
  if (n > OPERATOR.softAfter) return Math.min(1, OPERATOR.baseRate + OPERATOR.softStep * (n - OPERATOR.softAfter));
  return OPERATOR.baseRate;
}

/** Chance of k successes in n tries at rate p, for k = 0..n. */
function binomial(n: number, p: number): number[] {
  const out: number[] = [];
  let c = 1;
  for (let k = 0; k <= n; k++) {
    out.push(c * p ** k * (1 - p) ** (n - k));
    c = (c * (n - k)) / (k + 1);
  }
  return out;
}

/** Spreads each outcome over a number of extra copies (from free pulls). */
function withExtra(outcomes: PullOutcome[], extra: number[]): PullOutcome[] {
  return outcomes.flatMap((o) => extra.map((p, k) => ({ p: o.p * p, next: o.next, copies: o.copies + k })));
}

type CustomPity = Extract<PityModel, { kind: 'custom' }>;

/**
 * A featured-operator banner: 50/50 with no guarantee after a loss, the
 * featured operator at the 120th pull once per banner, a featured copy every
 * 240 pulls, and free 10-pulls (after `urgentAt` pulls) that touch no counter.
 */
const featuredOperator = (urgentAt: readonly number[], describe: string, more: Partial<CustomPity> = {}): CustomPity => ({
  kind: 'custom',
  describe,
  source: HEADHUNTING_SOURCE,
  hardPity: OPERATOR.hardPity,
  featured: { winRate: OPERATOR.winRate, guaranteeAfterLoss: false },
  ...more,
  pull: (s) => {
    const b = bannerOf(s) + 1;
    const got = gotOf(s);
    const token = b % OPERATOR.tokenEvery === 0 ? 1 : 0;
    // Once the 120th pull is past, whether it came no longer matters: forget it so states merge.
    const after = (gotNow: boolean, pulls: number): PityState => ({ pulls, guaranteed: false, extra: { banner: b, got: gotNow && b < OPERATOR.guaranteeAt ? 1 : 0 } });
    let outcomes: PullOutcome[];
    if (!got && b === OPERATOR.guaranteeAt) outcomes = [{ p: 1, next: after(true, 0), copies: 1 + token }];
    else {
      const top = operatorTopRate(s.pulls);
      outcomes = [
        { p: top * OPERATOR.winRate, next: after(true, 0), copies: 1 + token },
        { p: top * (1 - OPERATOR.winRate), next: after(got, 0), copies: token },
        { p: 1 - top, next: after(got, s.pulls + 1), copies: token },
      ];
    }
    // Urgent Recruitment: 10 pulls at base rates, featured at 0.8% × 50% each, in a vacuum.
    return urgentAt.includes(b) ? withExtra(outcomes, binomial(OPERATOR.urgentSize, OPERATOR.baseRate * OPERATOR.winRate)) : outcomes;
  },
  worstCase: (s, copies) => {
    // Without luck, featured copies come only from the 120 guarantee and the 240 tokens.
    const b = bannerOf(s);
    const sure = (x: number) => (!gotOf(s) && b < OPERATOR.guaranteeAt && b + x >= OPERATOR.guaranteeAt ? 1 : 0) + Math.floor((b + x) / OPERATOR.tokenEvery) - Math.floor(b / OPERATOR.tokenEvery);
    for (let x = 1; x <= copies * OPERATOR.tokenEvery + OPERATOR.guaranteeAt; x++) if (sure(x) >= copies) return x;
    return null;
  },
});

/** Chartered Headhunting (limited operator), with the Headhunting Dossier for the next banner. */
export const charteredOperator: PityModel = featuredOperator(
  [OPERATOR.urgentAt],
  '6★ 0.8%, rising 5% a pull after 65, certain at 80 (carries over). 50/50 for the featured operator with no guarantee after a loss; the featured operator at the 120th pull once per banner; a copy every 240 pulls; a free 10-pull after 30 that counts toward nothing; after 60 pulls, 10 free pulls on the next banner.',
  { carryOver: { after: OPERATOR.dossierAt, pulls: OPERATOR.dossierSize, label: 'Headhunting Dossier' } },
);

/**
 * RE-Factor Headhunting (rerun): the same, with free 10-pulls after 30, 60 and
 * 90. Officially the 120 guarantee, the free pulls and the 240 tokens count
 * across all banners of the same name (attempts carry over); this models a
 * first run of a name, which every rerun is so far (a test guards it).
 */
export const rerunOperator: PityModel = featuredOperator(
  OPERATOR.rerunUrgentAt,
  '6★ 0.8%, rising 5% a pull after 65, certain at 80 (carries over). 50/50 for the featured operator with no guarantee after a loss; the featured operator at the 120th pull (once per banner name); a copy every 240 pulls; free 10-pulls after 30, 60 and 90 that count toward nothing.',
);

/** Basic Headhunting (standard): any 6★ counts; a 6★ of your choice at 300 pulls, once. */
export const basicOperator: PityModel = {
  kind: 'custom',
  describe: '6★ 0.8%, rising 5% a pull after 65, certain at 80 (carries over). A 6★ of your choice at 300 pulls.',
  source: HEADHUNTING_SOURCE,
  hardPity: OPERATOR.hardPity,
  pull: (s) => {
    const b = bannerOf(s) + 1;
    const pick = b === OPERATOR.selectorAt ? 1 : 0;
    const top = operatorTopRate(s.pulls);
    const next = (pulls: number): PityState => ({ pulls, guaranteed: false, extra: { banner: Math.min(b, OPERATOR.selectorAt) } });
    return [
      { p: top, next: next(0), copies: 1 + pick },
      { p: 1 - top, next: next(s.pulls + 1), copies: pick },
    ];
  },
  worstCase: (s, copies) => {
    const b = bannerOf(s);
    const sure = (x: number) => (s.pulls + x >= OPERATOR.hardPity ? 1 + Math.floor((s.pulls + x - OPERATOR.hardPity) / OPERATOR.hardPity) : 0) + (b < OPERATOR.selectorAt && b + x >= OPERATOR.selectorAt ? 1 : 0);
    for (let x = 1; x <= copies * OPERATOR.hardPity; x++) if (sure(x) >= copies) return x;
    return null;
  },
};

/** New Horizons Headhunting (beginner): a standard 6★ within 40 pulls. Its own rate isn't published, so chances stay "no data". */
export const beginnerOperator: PityModel = { kind: 'hard-pity', hardPity: OPERATOR.beginnerHardPity, baseRate: null };

/**
 * Arsenal Issue (featured weapon), sold in issues of 10. A 6★ by the 4th
 * issue without one, 25% featured, the featured weapon in the 8th issue once
 * per banner, and a featured copy at issue 18, then every 16.
 */
export const arsenalIssue: PityModel = {
  kind: 'custom',
  describe:
    'Issues of 10 weapons for 1980 Arsenal Tickets. 6★ 4% each; a 6★ in the 4th issue without one; 25% of 6★ are the featured weapon; the featured weapon in the 8th issue once per banner; a featured copy at issue 18, then every 16.',
  source: ARSENAL_SOURCE,
  step: ARSENAL.issueSize,
  hardPity: ARSENAL.guaranteeIssues * ARSENAL.issueSize,
  featured: { winRate: ARSENAL.winRate, guaranteeAfterLoss: false },
  pull: (s) => {
    const issue = Math.floor(bannerOf(s) / ARSENAL.issueSize) + 1;
    const got = gotOf(s);
    const sure6 = s.pulls + ARSENAL.issueSize >= ARSENAL.guaranteeIssues * ARSENAL.issueSize;
    const sureFeatured = !got && issue === ARSENAL.featuredIssue;
    const bonus = issue >= ARSENAL.bonusFirst && (issue - ARSENAL.bonusFirst) % ARSENAL.bonusEvery === 0 ? 1 : 0;
    // Each of the 10 weapons: featured 6★ 1%, other 6★ 3%, below 6★ 96%. Grouped by (featured count, any other 6★).
    const pf = ARSENAL.topRate * ARSENAL.winRate;
    const po = ARSENAL.topRate * (1 - ARSENAL.winRate);
    const groups = new Map<string, { f: number; other: boolean; p: number }>();
    const add = (f: number, other: boolean, p: number) => {
      const k = `${f}|${other}`;
      const g = groups.get(k);
      if (g) g.p += p;
      else groups.set(k, { f, other, p });
    };
    const n = ARSENAL.issueSize;
    const featuredCount = binomial(n, pf);
    for (let f = 0; f <= n; f++) {
      // The other n−f weapons (none featured): none is a 6★, or at least one is.
      const noOther = (1 - po / (1 - pf)) ** (n - f);
      for (const [other, p] of [
        [false, noOther],
        [true, 1 - noOther],
      ] as const) {
        const q = (featuredCount[f] ?? 0) * p;
        if (sure6 && f === 0 && !other) {
          // The guaranteed 6★: the featured one when this is also the 8th issue, else featured 25% of the time.
          if (sureFeatured) add(1, false, q);
          else {
            add(1, false, q * ARSENAL.winRate);
            add(0, true, q * (1 - ARSENAL.winRate));
          }
        } else if (sureFeatured && f === 0) add(1, other, q);
        else add(f, other, q);
      }
    }
    return [...groups.values()].map((g) => ({
      p: g.p,
      next: { pulls: g.f > 0 || g.other ? 0 : s.pulls + ARSENAL.issueSize, guaranteed: false, extra: { banner: issue * ARSENAL.issueSize, got: got || g.f > 0 ? 1 : 0 } },
      copies: g.f + bonus,
    }));
  },
  worstCase: (s, copies) => {
    const issues = Math.floor(bannerOf(s) / ARSENAL.issueSize);
    const bonusBy = (i: number) => (i < ARSENAL.bonusFirst ? 0 : 1 + Math.floor((i - ARSENAL.bonusFirst) / ARSENAL.bonusEvery));
    const sure = (j: number) => (!gotOf(s) && issues < ARSENAL.featuredIssue && issues + j >= ARSENAL.featuredIssue ? 1 : 0) + bonusBy(issues + j) - bonusBy(issues);
    for (let j = 1; j <= ARSENAL.bonusFirst + copies * ARSENAL.bonusEvery; j++) if (sure(j) >= copies) return j * ARSENAL.issueSize;
    return null;
  },
};

/** Free pulls the banner gives at a number of counted pulls on it: Urgent Recruitment now, a Dossier for the next banner. */
export function freePulls(pullsOnBanner: number): { urgent: number; nextBanner: number } {
  return {
    urgent: pullsOnBanner >= OPERATOR.urgentAt ? OPERATOR.urgentSize : 0,
    nextBanner: pullsOnBanner >= OPERATOR.dossierAt ? OPERATOR.dossierSize : 0,
  };
}
