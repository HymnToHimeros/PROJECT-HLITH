import { describe, expect, it } from 'vitest';
import { dueNow, expectedOffset, keyMoments, nextCheck, planChecks, type Plan, type SignalLog } from '../scripts/schedule/rhythm.ts';

const DAY = 86_400_000;
const hsr46 = { id: '4.6', start: '2026-09-27T22:00:00.000Z', end: '2026-11-10T22:00:00.000Z' };
const zzz32 = { id: '3.2', start: '2026-09-08T22:00:00.000Z', end: '2026-10-20T22:00:00.000Z' };
const hsrLog: SignalLog = { preDownload: { '2.2': -39.5, '2.5': -15.5, '2.7': -39.5 }, program: { '2.3': -372 } };
const zzzLog: SignalLog = { preDownload: { '3.0': -41.9, '3.1': -41.9, '3.2': -41.9 }, program: { '1.5': -273.6, '2.8': -378 } };
const NOW = Date.parse('2026-10-10T12:00:00Z');

const at = (p: Plan, day: string) => p.slots.filter((s) => s.at.startsWith(day));
const reasons = (p: Plan, day: string) => at(p, day).flatMap((s) => s.why);

describe('when to look for news', () => {
  it('expects a notice at the median of the last 3 versions, or the default', () => {
    expect(expectedOffset('hsr', 'preDownload', hsrLog)).toBe(-39.5);
    expect(expectedOffset('zzz', 'program', zzzLog)).toBeCloseTo(-325.8);
    expect(expectedOffset('hsr', 'program', {})).toBe(-372);
  });

  it('ZZZ 3.3: daily now (end of 3.2), pre-download check, patch-day check, daily first two weeks, then every third day', () => {
    const p = planChecks('zzz', [zzz32], zzzLog, NOW, 40, ['2026-10-21T03:00:00.000Z']);
    if (!p) throw new Error('no plan');
    expect([p.version, p.nextPatch, p.nextPatchStated]).toEqual(['3.2', zzz32.end, true]);
    for (let d = 11; d <= 20; d++) expect(at(p, `2026-10-${d}`).length, `10-${d}`).toBeGreaterThan(0);
    // Pre-download notice about 41.9 h before the patch (19 Oct about 04:05 UTC): check an hour later.
    expect(at(p, '2026-10-19').map((s) => s.at)).toContain('2026-10-19T05:06:00.000Z');
    // Patch 06:00 UTC+8 on 21 Oct, about 5 hours of maintenance: check at 04:00 UTC, with the new banners.
    expect(at(p, '2026-10-21')[0]).toEqual({ at: '2026-10-21T04:00:00.000Z', why: ['3.3 patch day: maintenance over', 'new banners start'] });
    for (let d = 21; d <= 31; d++) expect(at(p, `2026-10-${d}`).length, `10-${d}`).toBeGreaterThan(0);
    // 3.3's end is not stated yet: expected 42 days on, marked estimated; quiet middle in between.
    expect(reasons(p, '2026-11-06')).toEqual(['3.3 middle: every 3 days']);
    expect(at(p, '2026-11-07')).toEqual([]);
    expect(reasons(p, '2026-11-16')).toEqual(['next patch (estimated) 2026-12-01: daily']);
  });

  it('HSR 4.7: every third day in the middle of 4.6, phase 2, daily from before the program, pre-download, patch day', () => {
    const p = planChecks('hsr', [hsr46], hsrLog, NOW, 40, ['2026-10-21T04:00:00.000Z']);
    if (!p) throw new Error('no plan');
    expect(p.slots.filter((s) => s.at >= '2026-10-12' && s.at < '2026-10-24').map((s) => s.at)).toEqual([
      '2026-10-14T10:30:00.000Z',
      '2026-10-17T10:30:00.000Z',
      '2026-10-20T10:30:00.000Z',
      '2026-10-21T05:00:00.000Z',
      '2026-10-23T10:30:00.000Z',
    ]);
    // Program announcement expected 372 h before the patch: 26 Oct 10:00 UTC. Daily from two days before.
    expect(reasons(p, '2026-10-24')).toEqual(['next patch 2026-11-10: daily']);
    expect(reasons(p, '2026-10-26')).toContain('special program announcement expected');
    expect(at(p, '2026-11-09').map((s) => s.at)).toContain('2026-11-09T07:30:00.000Z');
    expect(at(p, '2026-11-11')[0]?.at).toBe('2026-11-11T04:00:00.000Z');
  });

  it('follows patch day, not weekdays: a later end moves every check after it', () => {
    const later = { ...hsr46, end: new Date(Date.parse(hsr46.end) + 2 * DAY).toISOString() };
    const a = planChecks('hsr', [hsr46], hsrLog, NOW, 40);
    const b = planChecks('hsr', [later], hsrLog, NOW, 40);
    const patch = (p?: Plan) => p?.slots.find((s) => s.why.some((w) => w.includes('patch day')))?.at;
    expect(Date.parse(patch(b) ?? '') - Date.parse(patch(a) ?? '')).toBe(2 * DAY);
  });

  it('says what is due in the last window and when the next check is', () => {
    const plans = [planChecks('zzz', [zzz32], zzzLog, NOW - 2 * 3_600_000, 10)].filter((p): p is Plan => Boolean(p));
    expect(dueNow(plans, Date.parse('2026-10-19T06:00:00Z'), 2 * 3_600_000).map((d) => d.slot.at)).toEqual(['2026-10-19T05:06:00.000Z']);
    expect(dueNow(plans, Date.parse('2026-10-19T08:00:00Z'), 2 * 3_600_000)).toEqual([]);
    expect(nextCheck(plans, Date.parse('2026-10-19T08:00:00Z'))?.slot.at).toBe('2026-10-19T10:30:00.000Z');
  });

  it('key moments for the research routine: one run when both games meet within 12 hours', () => {
    const plans = [planChecks('hsr', [hsr46], hsrLog, NOW, 21, ['2026-10-21T04:00:00.000Z']), planChecks('zzz', [zzz32], zzzLog, NOW, 21, ['2026-10-21T03:00:00.000Z'])].filter((p): p is Plan => Boolean(p));
    expect(keyMoments(plans, NOW)).toEqual([
      { at: '2026-10-14T10:30:00.000Z', why: ['HSR 4.6 middle: every 3 days'] },
      { at: '2026-10-19T05:06:00.000Z', why: ['ZZZ pre-download notice expected'] },
      { at: '2026-10-21T05:00:00.000Z', why: ['ZZZ 3.3 patch day: maintenance over', 'ZZZ new banners start', 'HSR new banners start'] },
      { at: '2026-10-26T11:00:00.000Z', why: ['HSR next patch 2026-11-10: daily', 'HSR special program announcement expected'] },
    ]);
  });
});

describe('each game its own version length', () => {
  it('the median of the last 3 finished versions; a game without history keeps 42 days', async () => {
    const { usualLength } = await import('../scripts/schedule/rhythm.ts');
    const v = (id: string, start: string, end: string) => ({ id, start: `${start}T04:00:00.000Z`, end: `${end}T04:00:00.000Z` });
    // Endfield 1.3–1.6: 41, 48, 43 days; 1.6 is still running and doesn't count.
    expect(usualLength([v('1.3', '2026-06-05', '2026-07-16'), v('1.4', '2026-07-16', '2026-09-02'), v('1.5', '2026-09-02', '2026-10-15'), v('1.6', '2026-10-15', '2026-11-25')])).toBe(43);
    expect(usualLength([])).toBe(42);
  });

  it('Endfield expects its pre-download notice 48 hours before the patch', () => {
    expect(expectedOffset('endfield', 'preDownload', { preDownload: { '1.4': -48, '1.5': -48, '1.6': -48 } })).toBe(-48);
    expect(expectedOffset('endfield', 'program', {})).toBe(-208);
  });
});
