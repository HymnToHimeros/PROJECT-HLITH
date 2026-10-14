import { describe, expect, it } from 'vitest';
import type { Currency } from '../../core/contract';
import { balances, type LedgerEntry } from '../../core/data/userData';
import { flowTotals, groupLines, groupPulls, withBalances } from './bankLog';

// The same shape as both games: a premium currency (160 a pull), two pull items and a paid currency.
const currencies: Currency[] = [
  { id: 'jade', name: 'Jade', perPull: 160 },
  { id: 'special', name: 'Special Pass', pullItemFor: ['character'] },
  { id: 'pass', name: 'Pass', pullItemFor: ['standard'] },
  { id: 'shard', name: 'Shard', paid: true },
];
const C1 = '2026-10-10T12:00:00.000Z';
const C2 = '2026-10-14T01:47:00.000Z';
let n = 0;
const e = (at: string, currency: string, kind: LedgerEntry['kind'], amount: number, more: Partial<LedgerEntry> = {}): LedgerEntry => ({ id: `e${++n}`, at, currency, kind, amount, ...more });
const check = (at: string, jade: number, special: number, pass: number, shard: number) => [e(at, 'jade', 'have', jade), e(at, 'special', 'have', special), e(at, 'pass', 'have', pass), e(at, 'shard', 'have', shard)];
const view = (ledger: LedgerEntry[]) => {
  const groups = groupLines(withBalances(ledger), currencies);
  return { groups, totals: flowTotals(groups, currencies) };
};

describe('Bank log: balance checks', () => {
  it('two checks with a rise: the difference counts as Earned, from the balance check', () => {
    // The owner's case: 1,654 → 5,281 Jade and 12 → 15 Passes.
    const { groups, totals } = view([...check(C1, 1654, 15, 12, 0), ...check(C2, 5281, 15, 15, 0)]);
    expect(groups).toHaveLength(2); // one entry per check, not one per currency
    const second = groups[1];
    expect(second?.lines.map((l) => [l.entry.currency, l.change, l.balance])).toEqual([
      ['jade', 3627, 5281],
      ['special', 0, 15],
      ['pass', 3, 15],
      ['shard', 0, 0],
    ]);
    expect(groups[0]?.lines.every((l) => l.change === null)).toBe(true); // the first check has nothing to compare with
    expect(totals.earned).toEqual({ amounts: { jade: 3627, pass: 3 }, pulls: 3627 / 160 + 3, logged: 0, fromChecks: 1 });
    expect(totals.spent.fromChecks).toBe(0);
    expect(second && groupPulls(second, currencies)).toBeCloseTo(25.67, 2); // ≈ +22.7 pulls of Jade + 3 passes
  });

  it('a drop counts as Spent', () => {
    const { groups, totals } = view([e(C1, 'jade', 'have', 5000), e(C1, 'special', 'have', 10), e(C2, 'jade', 'have', 3400), e(C2, 'special', 'have', 0)]);
    expect(groups[1]?.lines.map((l) => [l.change, l.fromCheck])).toEqual([
      [-1600, 'spent'],
      [-10, 'spent'],
    ]);
    expect(totals.spent).toEqual({ amounts: { jade: 1600, special: 10 }, pulls: 20, logged: 0, fromChecks: 1 });
    expect(totals.earned.fromChecks).toBe(0);
  });

  it('Bought raises the balance now, and the next check does not count it as Earned too', () => {
    const ledger = [e(C1, 'jade', 'have', 1000), e('2026-10-11T00:00:00.000Z', 'jade', 'bought', 980), e(C2, 'jade', 'have', 2040)];
    const { groups, totals } = view(ledger);
    expect(groups[1]?.lines[0]?.balance).toBe(1980); // right away
    expect(groups[2]?.lines[0]?.change).toBe(60); // 2,040 − (1,000 + 980): only the 60 is new
    expect(totals.bought.amounts).toEqual({ jade: 980 });
    expect(totals.earned.amounts).toEqual({ jade: 60 });
    expect(balances(ledger)).toMatchObject({ value: { jade: 2040 } });
  });

  it('manual Earned and Spent are part of the expected balance too', () => {
    const ledger = [e(C1, 'jade', 'have', 1000), e('2026-10-11T00:00:00.000Z', 'jade', 'earned', 800, { note: 'Endgame' }), e('2026-10-12T00:00:00.000Z', 'jade', 'spent', 1600), e(C2, 'jade', 'have', 200)];
    const { groups, totals } = view(ledger);
    expect(groups[3]?.lines[0]?.change).toBe(0); // 1,000 + 800 − 1,600 = 200: nothing new
    expect(totals.earned).toMatchObject({ amounts: { jade: 800 }, logged: 1, fromChecks: 0 });
    expect(totals.spent).toMatchObject({ amounts: { jade: 1600 }, logged: 1, fromChecks: 0 });
  });

  it('undo: an undone check stops counting, the next check compares with the one before, totals recompute', () => {
    const first = check(C1, 1654, 15, 12, 0);
    const mid = check('2026-10-12T00:00:00.000Z', 9999, 15, 12, 0); // a typo
    const last = check(C2, 5281, 15, 15, 0);
    const undoAt = '2026-10-12T00:05:00.000Z';
    const undo = mid.map((m) => e(undoAt, m.currency, m.kind, m.amount, { note: 'Undo', reverses: m.id }));
    const { groups, totals } = view([...first, ...mid, ...undo, ...last]);
    expect(groups.map((g) => g.state)).toEqual(['counted', 'undone', 'undo', 'counted']);
    expect(groups[3]?.lines[0]?.change).toBe(3627);
    expect(totals.earned.amounts).toEqual({ jade: 3627, pass: 3 });
    expect(totals.spent.amounts).toEqual({}); // the typo's drop back is not Spent
  });

  it('old entries load as they are: one per currency, saved together, group by their shared time', () => {
    // Exactly what older versions stored (no new fields); nothing is rewritten.
    const stored: LedgerEntry[] = JSON.parse(JSON.stringify([...check(C1, 1654, 15, 12, 0), ...check(C2, 5281, 15, 15, 0)]));
    const copy = JSON.stringify(stored);
    const { groups } = view(stored);
    expect(groups.map((g) => g.lines.length)).toEqual([4, 4]);
    expect(JSON.stringify(stored)).toBe(copy);
  });

  it('a group with one currency undone by itself (older entries) is partly undone', () => {
    const c = check(C1, 100, 1, 1, 0);
    const one = c[1];
    const ledger = one ? [...c, e(C2, one.currency, one.kind, one.amount, { reverses: one.id })] : c;
    expect(view(ledger).groups[0]?.state).toBe('partly');
  });

  it('a paid currency never makes pulls by itself (the contract gives it no pull rule)', () => {
    const { totals } = view([e(C1, 'shard', 'have', 0), e(C2, 'shard', 'have', 980)]);
    expect(totals.earned).toMatchObject({ amounts: { shard: 980 }, pulls: 0 });
  });
});
