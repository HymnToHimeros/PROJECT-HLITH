import { describe, expect, it } from 'vitest';
import type { Banner, PullRecord } from '../../core/contract';
import { featuredByBanner } from './featuredByBanner';
import { topsWithPity } from './History';

const banner = (id: string, featured: string[], start: string, end: string, type = 'chartered'): Banner => ({ id, type, title: id, featured, start: `${start}T04:00:00.000Z`, end: `${end}T04:00:00.000Z` });
// Si's banner can also give Typhoeus and Liino on a lost 50/50 (alsoAvailable): still a loss.
const si = { ...banner('rejuvenation', ['si'], '2026-10-15', '2026-11-05'), alsoAvailable: ['typhoeus', 'liino'] } as Banner;
const typhoeusBanner = banner('typhoeus-banner', ['typhoeus'], '2026-09-02', '2026-09-23');
const rule = { types: ['chartered', 'rerun'], guaranteeAt: 120 };

let seq = 0;
const pull = (day: string, itemId: string, rarity: PullRecord['rarity'] = 'top', bannerType = 'chartered', extra: Partial<PullRecord> = {}): PullRecord => ({ id: String(++seq).padStart(6, '0'), bannerType, itemId, name: itemId, rarity, time: `${day}T12:00:${String(seq % 60).padStart(2, '0')}.000Z`, ...extra });
const fill = (n: number, day: string) => Array.from({ length: n }, () => pull(day, 'x', 'low'));

describe('featured or not from the banner open at the time (Endfield)', () => {
  it('the featured operator is a won 50/50; an earlier limited one on the same banner is a lost 50/50', () => {
    const out = featuredByBanner([pull('2026-10-16', 'si'), pull('2026-10-17', 'typhoeus'), pull('2026-09-05', 'typhoeus')], [si, typhoeusBanner], rule);
    expect(out.map((p) => p.featured)).toEqual([true, false, true]);
    const tops = topsWithPity(out, new Set(['chartered']));
    expect(tops.map((t) => t.result)).toEqual(['won', 'won', 'lost']);
  });
  it('never guessed: no banner open, two open at once, or an empty featured list leave it unknown', () => {
    const twin = banner('twin', ['other'], '2026-10-15', '2026-10-20');
    const empty = banner('empty', [], '2026-12-01', '2026-12-20');
    const out = featuredByBanner([pull('2026-08-01', 'si'), pull('2026-10-16', 'si'), pull('2026-12-05', 'si')], [si, twin, empty], rule);
    expect(out.map((p) => p.featured)).toEqual([undefined, undefined, undefined]);
  });
  it('the banner’s own sure pull (the 120th) is not a 50/50: left unknown; a featured one before it counts', () => {
    const sure = featuredByBanner([...fill(119, '2026-10-16'), pull('2026-10-17', 'si')], [si], rule);
    expect(sure.find((p) => p.itemId === 'si')?.featured).toBeUndefined();
    const early = featuredByBanner([pull('2026-10-16', 'si'), ...fill(118, '2026-10-16'), pull('2026-10-17', 'si')], [si], rule);
    expect(early.filter((p) => p.itemId === 'si').map((p) => p.featured)).toEqual([true, true]);
  });
  it('only the listed banner types; results that already say featured or not, leaks and lower rarities are kept', () => {
    const weapon = banner('weapon', ['w1'], '2026-10-15', '2026-11-05', 'weapon');
    const leak = { ...banner('leak', ['si'], '2027-01-01', '2027-01-20'), leak: { source: 'x' } };
    const out = featuredByBanner([pull('2026-10-16', 'w2', 'top', 'weapon'), pull('2026-10-16', 'typhoeus', 'top', 'chartered', { featured: true }), pull('2027-01-05', 'si'), pull('2026-10-16', 'si', 'mid')], [si, weapon, leak], rule);
    expect(out.map((p) => p.featured)).toEqual([undefined, true, undefined, undefined]);
  });
});
