import { describe, expect, it } from 'vitest';
import type { PityModel, PullRecord } from '../../core/contract';
import { chance, luck, pityFromHistory, worstCase } from './pity';

const character: PityModel = {
  kind: 'hard-pity',
  hardPity: 90,
  baseRate: 0.006,
  featured: { winRate: 0.5, guaranteeAfterLoss: true },
  softPity: { from: 74, stepPerPull: 0.06, source: 'community' },
};
const weapon: PityModel = { kind: 'hard-pity', hardPity: 80, baseRate: 0.008, featured: { winRate: 0.75, guaranteeAfterLoss: true } };
const unpublished: PityModel = { kind: 'hard-pity', hardPity: 80, baseRate: null };
const spark: PityModel = { kind: 'spark', sparkAt: 200, baseRate: 0.007 };
const fresh = { pulls: 0, guaranteed: false };
const value = (k: { known: boolean; value?: number }) => (k.known ? (k.value as number) : NaN);

describe('worst case (official hard pity only)', () => {
  it('50/50 still to play: two full pities', () => {
    expect(value(worstCase(character, fresh))).toBe(180);
  });
  it('guaranteed: only what is left of this pity', () => {
    expect(value(worstCase(character, { pulls: 30, guaranteed: true }))).toBe(60);
  });
  it('each extra copy adds two full pities', () => {
    expect(value(worstCase(character, fresh, 2))).toBe(360);
  });
  it('75/25 weapon banner', () => {
    expect(value(worstCase(weapon, { pulls: 10, guaranteed: false }))).toBe(150);
  });
  it('spark: pulls left to the exchange', () => {
    expect(value(worstCase(spark, { pulls: 50, guaranteed: false }))).toBe(150);
  });
  it('no ceiling → unknown, never a made-up number', () => {
    expect(worstCase({ kind: 'none', baseRate: 0.01 }, fresh).known).toBe(false);
    expect(worstCase({ kind: 'hard-pity', hardPity: 90, baseRate: 0.006, featured: { winRate: 0.5, guaranteeAfterLoss: false } }, fresh).known).toBe(false);
  });
});

describe('chance (exact, by stepping through states)', () => {
  it('is certain at the worst case and not one pull before', () => {
    expect(value(chance(character, fresh, 180, 'official'))).toBeCloseTo(1, 12);
    expect(value(chance(character, fresh, 179, 'official'))).toBeLessThan(1);
    expect(value(chance(character, { pulls: 89, guaranteed: true }, 1, 'official'))).toBe(1);
  });
  it('matches the closed form far from pity', () => {
    // No 50/50: P(at least one top in 3) = 1 − 0.994³.
    const standard: PityModel = { kind: 'hard-pity', hardPity: 90, baseRate: 0.006 };
    expect(value(chance(standard, fresh, 3, 'official'))).toBeCloseTo(1 - 0.994 ** 3, 12);
    // With the 50/50: win now, or lose now and win the guaranteed one later.
    // Paths: win on pull 1/2/3 after misses, or lose a 50/50 and hit any top after it.
    const p = 0.006;
    const w = p / 2; // top and featured
    const l = p / 2; // top but lost
    const m = 1 - p; // no top
    const exact = w * (1 + m + m * m) + l * p * (1 + m) + m * l * p;
    expect(value(chance(character, fresh, 3, 'official'))).toBeCloseTo(exact, 9);
  });
  it('grows with more pulls', () => {
    const a = value(chance(character, fresh, 50, 'official'));
    const b = value(chance(character, fresh, 100, 'official'));
    expect(b).toBeGreaterThan(a);
  });
  it('community odds (rising before pity) are higher than official, and labelled separately', () => {
    const off = value(chance(character, { pulls: 70, guaranteed: true }, 10, 'official'));
    const com = value(chance(character, { pulls: 70, guaranteed: true }, 10, 'community'));
    expect(com).toBeGreaterThan(off);
  });
  it('more copies is harder', () => {
    expect(value(chance(character, fresh, 180, 'official', 2))).toBeLessThan(1);
    expect(value(chance(character, fresh, 360, 'official', 2))).toBeCloseTo(1, 12);
  });
  it('is unknown when the game does not publish the rate, or has no community data', () => {
    expect(chance(unpublished, fresh, 50, 'official').known).toBe(false);
    expect(chance(weapon, fresh, 50, 'community').known).toBe(false);
  });
  it('works for a spark banner', () => {
    expect(value(chance(spark, fresh, 200, 'official'))).toBeCloseTo(1, 12);
    expect(value(chance(spark, fresh, 1, 'official'))).toBeCloseTo(0.007, 9);
  });
  it('works for a game’s own rule', () => {
    const custom: PityModel = {
      kind: 'custom',
      describe: 'guaranteed every 10th pull',
      topRate: (s) => (s.pulls + 1 >= 10 ? 1 : 0),
      next: (s, top) => ({ pulls: top ? 0 : s.pulls + 1, guaranteed: false }),
      worstCase: (s) => 10 - s.pulls,
    };
    expect(value(chance(custom, fresh, 9, 'official'))).toBe(0);
    expect(value(chance(custom, fresh, 10, 'official'))).toBe(1);
    expect(value(worstCase(custom, { pulls: 4, guaranteed: false }, 2))).toBe(16);
  });
});

const pull = (i: number, rarity: PullRecord['rarity'], featured?: boolean, bannerType = 'character'): PullRecord => ({
  id: String(i).padStart(4, '0'),
  bannerType,
  itemId: `item${i}`,
  name: `Item ${i}`,
  rarity,
  time: `2026-01-01T00:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}Z`,
  ...(featured === undefined ? {} : { featured }),
});

describe('pity and luck from history', () => {
  const history: PullRecord[] = [
    ...Array.from({ length: 59 }, (_, i) => pull(i, i % 10 === 9 ? 'mid' : 'low')),
    pull(59, 'top', false), // lost the 50/50 at 60
    ...Array.from({ length: 19 }, (_, i) => pull(60 + i, 'low')),
    pull(79, 'top', true), // guaranteed at 20
    ...Array.from({ length: 12 }, (_, i) => pull(80 + i, 'low')),
    pull(500, 'top', true, 'weapon'),
  ];

  it('counts pulls since the last top on that banner and the guarantee', () => {
    expect(pityFromHistory(history, 'character')).toEqual({
      pity: expect.objectContaining({ known: true, value: 12 }),
      guaranteed: expect.objectContaining({ known: true, value: false }),
    });
  });
  it('a lost 50/50 last means guaranteed next', () => {
    const lostLast = history.slice(0, 60 + 5);
    expect(pityFromHistory(lostLast, 'character').guaranteed).toMatchObject({ known: true, value: true });
  });
  it('no history → no data, with the fix', () => {
    expect(pityFromHistory([], 'character').pity).toEqual({ known: false, fix: 'import-history' });
  });
  it('unknown featured flag → guarantee unknown, pity still known', () => {
    const r = pityFromHistory([pull(1, 'top')], 'character');
    expect(r.pity).toMatchObject({ known: true, value: 0 });
    expect(r.guaranteed.known).toBe(false);
  });
  it('luck: average pity and the 50/50 record, guaranteed tops not counted as 50/50s', () => {
    const l = luck(history, 'character');
    expect(l.tops).toBe(2);
    expect(l.averagePity).toMatchObject({ known: true, value: 40 });
    expect(l.fiftyFifty).toEqual({ won: 0, lost: 1, unknown: 0 });
  });
});
