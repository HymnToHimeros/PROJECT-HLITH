import { describe, expect, it } from 'vitest';
import type { PityModel, PityState } from '../src/core/contract';
import { endfield } from '../src/games/endfield/contract';
import { arsenalIssue, basicOperator, beginnerOperator, charteredOperator, freePulls, operatorTopRate, rerunOperator } from '../src/games/endfield/gacha';
import { pullsFor } from '../src/tools/budget/budget';
import { chance, hardPityOf, featuredOf, stepOf, worstCase } from '../src/tools/pity/pity';

const at = (pulls: number, banner = 0, got = 0): PityState => ({ pulls, guaranteed: false, extra: { banner, got } });
const fresh = at(0);
const value = (k: { known: boolean; value?: number }) => (k.known ? (k.value as number) : NaN);
const steps = (m: PityModel, s: PityState) => (m.kind === 'custom' ? m.pull(s) : []);

describe('Endfield operators: soft and hard pity', () => {
  it('0.8% until 65, then +5% a pull (5.8% on the 66th, 10.8% on the 67th), certain on the 80th', () => {
    expect(operatorTopRate(0)).toBe(0.008);
    expect(operatorTopRate(64)).toBe(0.008); // the 65th pull
    expect(operatorTopRate(65)).toBeCloseTo(0.058, 12); // the 66th
    expect(operatorTopRate(66)).toBeCloseTo(0.108, 12); // the 67th
    expect(operatorTopRate(78)).toBeCloseTo(0.708, 12); // the 79th
    expect(operatorTopRate(79)).toBe(1); // the 80th
  });
  it('the standard banner always gives a 6★ by 80, and the counter carries over (pity 70 → 10 more)', () => {
    expect(value(chance(basicOperator, fresh, 80, 'official'))).toBeCloseTo(1, 12);
    expect(value(chance(basicOperator, fresh, 79, 'official'))).toBeLessThan(1);
    expect(value(chance(basicOperator, at(70), 10, 'official'))).toBeCloseTo(1, 12);
    expect(value(worstCase(basicOperator, at(70)))).toBe(10);
    expect(hardPityOf(basicOperator)).toBe(80);
  });
  it('the standard banner’s 6★ of your choice at 300 counts as one more', () => {
    expect(value(worstCase(basicOperator, fresh, 4))).toBe(300); // 80, 160, 240, then the pick at 300
    expect(value(worstCase(basicOperator, at(0, 299), 1))).toBe(1);
  });
  it('the beginner banner: a 6★ within 40; its own rate isn’t published, so no chance is guessed', () => {
    expect(value(worstCase(beginnerOperator, { pulls: 0, guaranteed: false }))).toBe(40);
    expect(chance(beginnerOperator, { pulls: 0, guaranteed: false }, 40, 'official').known).toBe(false);
  });
});

describe('Endfield limited operator: 120 guarantee, once per banner', () => {
  it('the featured operator is certain by the 120th pull on a new banner', () => {
    expect(value(chance(charteredOperator, fresh, 120, 'official'))).toBeCloseTo(1, 12);
    expect(value(chance(charteredOperator, fresh, 119, 'official'))).toBeLessThan(1);
    expect(value(worstCase(charteredOperator, fresh))).toBe(120);
    expect(value(worstCase(charteredOperator, at(40, 100)))).toBe(20);
  });
  it('once it came (or the 120th is past), only the 240 copy is certain', () => {
    expect(value(worstCase(charteredOperator, at(0, 50, 1)))).toBe(190);
    expect(value(chance(charteredOperator, at(0, 121), 118, 'official'))).toBeLessThan(1);
    expect(value(chance(charteredOperator, at(0, 121), 119, 'official'))).toBeCloseTo(1, 12); // the 240th pull
  });
  it('a new banner starts the guarantee again; the 6★ counter carries over', () => {
    // Pity 70 carried from the last banner: a 6★ is due within 10, but the featured one is only certain at 120.
    expect(value(worstCase(charteredOperator, at(70, 0)))).toBe(120);
    // The 6★ is certain within 10 but the featured one only half the time (plus a little if the 6★ comes early).
    const c = value(chance(charteredOperator, at(70, 0), 10, 'official'));
    expect(c).toBeGreaterThan(0.5);
    expect(c).toBeLessThan(0.53);
  });
  it('a lost 50/50 guarantees nothing', () => {
    expect(featuredOf(charteredOperator)).toEqual({ winRate: 0.5, guaranteeAfterLoss: false });
    const lost = steps(charteredOperator, at(10, 10))[1];
    expect(lost?.next.guaranteed).toBe(false);
    expect(lost?.copies).toBe(0);
  });
  it('a copy every 240 pulls: 2 copies are certain by 240, 3 by 480', () => {
    expect(value(worstCase(charteredOperator, fresh, 2))).toBe(240);
    expect(value(worstCase(charteredOperator, fresh, 3))).toBe(480);
    expect(value(chance(charteredOperator, fresh, 240, 'official', 2))).toBeCloseTo(1, 12);
  });
});

describe('Endfield free pulls', () => {
  it('the free 10-pull after 30 does not count toward pity or the banner counter', () => {
    const out = steps(charteredOperator, at(29, 29));
    expect(out.every((o) => o.next.pulls === 0 || o.next.pulls === 30)).toBe(true); // not 40
    expect(out.every((o) => o.next.extra?.banner === 30)).toBe(true);
    expect(out.reduce((a, o) => a + o.p, 0)).toBeCloseTo(1, 12);
  });
  it('but it can still give the featured operator: 30 paid pulls are 40 tries at 0.4%', () => {
    expect(value(chance(charteredOperator, fresh, 29, 'official'))).toBeCloseTo(1 - 0.996 ** 29, 12);
    expect(value(chance(charteredOperator, fresh, 30, 'official'))).toBeCloseTo(1 - 0.996 ** 40, 12);
  });
  it('Urgent Recruitment at 30, a Dossier for the next banner at 60', () => {
    expect(freePulls(29)).toEqual({ urgent: 0, nextBanner: 0 });
    expect(freePulls(30)).toEqual({ urgent: 10, nextBanner: 0 });
    expect(freePulls(60)).toEqual({ urgent: 10, nextBanner: 10 });
  });
});

describe('Endfield weapons: issues of 10', () => {
  it('sold in issues: 15 pulls buy one issue, the same as 10', () => {
    expect(stepOf(arsenalIssue)).toBe(10);
    expect(value(chance(arsenalIssue, fresh, 15, 'official'))).toBe(value(chance(arsenalIssue, fresh, 10, 'official')));
  });
  it('one issue: 10 weapons, featured 1% each', () => {
    expect(value(chance(arsenalIssue, fresh, 10, 'official'))).toBeCloseTo(1 - 0.99 ** 10, 12);
  });
  it('no 6★ in 3 issues → the 4th has one (featured 25% of the time)', () => {
    const out = steps(arsenalIssue, at(30, 30));
    expect(out.every((o) => o.next.pulls === 0)).toBe(true);
    expect(out.reduce((a, o) => a + o.p, 0)).toBeCloseTo(1, 12);
    // Featured: 1 − 0.99^10 by luck, plus 25% of the "no 6★ at all" case.
    const featured = out.filter((o) => o.copies > 0).reduce((a, o) => a + o.p, 0);
    expect(featured).toBeCloseTo(1 - 0.99 ** 10 + 0.96 ** 10 * 0.25, 12);
  });
  it('the featured weapon by the 8th issue, once per banner; then at issue 18', () => {
    expect(value(chance(arsenalIssue, fresh, 80, 'official'))).toBeCloseTo(1, 12);
    expect(value(chance(arsenalIssue, fresh, 70, 'official'))).toBeLessThan(1);
    expect(value(worstCase(arsenalIssue, fresh))).toBe(80);
    expect(value(worstCase(arsenalIssue, at(0, 30, 1)))).toBe(150); // already came: the next sure one is issue 18
    expect(value(worstCase(arsenalIssue, fresh, 2))).toBe(180);
    expect(value(chance(arsenalIssue, fresh, 180, 'official', 2))).toBeCloseTo(1, 12);
  });
});

describe('Endfield models are complete', () => {
  it.each([
    ['limited operator', charteredOperator],
    ['standard operator', basicOperator],
    ['weapon issue', arsenalIssue],
  ] as const)('%s: the results of every step add up to 1', (_name, model) => {
    for (const s of [fresh, at(29, 29), at(64, 64), at(79, 119), at(5, 239), at(30, 70), at(0, 170, 1), at(20, 299)]) {
      expect(steps(model, s).reduce((a, o) => a + o.p, 0)).toBeCloseTo(1, 12);
    }
  });
});

describe('Endfield currencies buy pulls by the game’s prices', () => {
  const pulls = (balances: Record<string, number>, type: string) => pullsFor(endfield, balances, type);
  it('weapon issues: 1980 Arsenal Tickets for 10, only whole issues', () => {
    expect(pulls({ 'arsenal-ticket': 1979 }, 'weapon')).toBe(0);
    expect(pulls({ 'arsenal-ticket': 1980 }, 'weapon')).toBe(10);
    expect(pulls({ 'arsenal-ticket': 3959 }, 'weapon')).toBe(10);
  });
  it('Oroberyl buys operator pulls (500 each), never weapon issues', () => {
    expect(pulls({ oroberyl: 5000 }, 'chartered')).toBe(10);
    expect(pulls({ oroberyl: 50000 }, 'weapon')).toBe(0);
  });
  it('Origeometry: 75 Oroberyl or 25 Arsenal Tickets each', () => {
    expect(pulls({ origeometry: 20 }, 'chartered')).toBe(3); // 1500 Oroberyl
    expect(pulls({ origeometry: 80 }, 'weapon')).toBe(10); // 2000 tickets
    expect(pulls({ origeometry: 40, 'arsenal-ticket': 980 }, 'weapon')).toBe(10); // 1000 + 980
  });
  it('Arsenal Tickets don’t buy operator pulls; permits do, one each', () => {
    expect(pulls({ 'arsenal-ticket': 5000 }, 'chartered')).toBe(0);
    expect(pulls({ 'chartered-hh-permit': 7 }, 'chartered')).toBe(7);
  });
  it('every operator pull gives at least 38 Arsenal Tickets on average (9 × 20 + 200 per 10)', () => {
    expect(endfield.currencies.find((c) => c.id === 'arsenal-ticket')?.fromPulls?.atLeastPerPull).toBe(38);
  });
  it('every banner type uses the rules from gacha.ts, except Joint (rules not confirmed)', () => {
    const kinds = Object.fromEntries(endfield.bannerTypes.map((t) => [t.id, t.pity]));
    expect(kinds).toMatchObject({ chartered: charteredOperator, rerun: rerunOperator, basic: basicOperator, beginner: beginnerOperator, weapon: arsenalIssue });
  });
});

describe('Endfield lost 50/50: any 6★ but the featured one, an earlier limited operator included', () => {
  it('History matches Chartered and RE-Factor pulls to the banner open at the time; the 120th is a sure pull', () => {
    expect(endfield.historyMapping?.featuredByBanner).toEqual({ types: ['chartered', 'rerun'], guaranteeAt: 120 });
    expect(endfield.historyMapping?.standardTop).toBeUndefined();
  });
  it('the 50% and the 120 guarantee stay as they are', () => {
    expect(featuredOf(charteredOperator)).toEqual({ winRate: 0.5, guaranteeAfterLoss: false });
  });
});
