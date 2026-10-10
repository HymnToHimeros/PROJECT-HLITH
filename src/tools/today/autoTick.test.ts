import { beforeEach, describe, expect, it } from 'vitest';
import type { GameContract } from '../../core/contract';
import { serverRule } from '../../core/time/reset';
import { fakeGame } from '../account-links/fakeGame';
import { autoTicks, autoTickWhy, claimAutoTicks } from './autoTick';

// A server at UTC+1 with the reset at 04:00 local = 03:00 UTC.
const hsr: GameContract = {
  ...fakeGame(),
  id: 'hsr',
  stamina: [{ id: 'trailblaze-power', name: 'Trailblaze Power', max: 240, minutesPerPoint: 6 }],
  servers: [{ id: 'europe', label: 'Europe', utcOffset: 1 }],
  income: [
    { id: 'hsr.daily-training', source: 'daily', label: 'Daily Training', currency: 'jade', amount: 60, schedule: { kind: 'per-reset' } },
    { id: 'hsr.pass', source: 'paid', label: 'Pass', currency: 'jade', amount: 90, paid: true, schedule: { kind: 'per-reset' } },
  ],
};
const rule = serverRule(hsr, 'europe');
const read = (current: number, at: string, fullInSeconds = (240 - current) * 360) => ({ current, max: 240, fullInSeconds, readAt: at });

describe('ticks that HoYoLAB proves', () => {
  beforeEach(() => localStorage.clear());

  it('stamina lower than the last read counted forward = spent, so "Spend Trailblaze Power" is ticked', () => {
    // 100 at 10:00; one hour later it would be 110 by itself. HoYoLAB says 40.
    const out = autoTicks({ game: hsr, rule, previous: read(100, '2026-10-10T10:00:00Z'), next: read(40, '2026-10-10T11:00:00Z'), dailies: null, ticks: {} });
    expect(out).toEqual([{ taskId: 'stamina:trailblaze-power', at: '2026-10-10T11:00:00Z', why: 'HoYoLAB: Trailblaze Power is 40, it should be 110 by now, so it was spent' }]);
  });

  it('spent, then refilled past the last read: still ticked, because it is below what it should be by now', () => {
    // 50 at 10:00. By 16:00 it should be 110 (one point per 6 min). HoYoLAB says 70: higher than
    // the last read, but 40 short of what it should be, so 40 were spent in between.
    const out = autoTicks({ game: hsr, rule, previous: read(50, '2026-10-10T10:00:00Z'), next: read(70, '2026-10-10T16:00:00Z'), dailies: null, ticks: {} });
    expect(out.map((t) => t.why)).toEqual(['HoYoLAB: Trailblaze Power is 70, it should be 110 by now, so it was spent']);
  });

  it('stamina that only grew proves nothing', () => {
    expect(autoTicks({ game: hsr, rule, previous: read(100, '2026-10-10T10:00:00Z'), next: read(110, '2026-10-10T11:00:00Z'), dailies: null, ticks: {} })).toEqual([]);
  });

  it('a drop since a read from before the daily reset proves nothing (it may have been spent yesterday)', () => {
    expect(autoTicks({ game: hsr, rule, previous: read(200, '2026-10-10T01:00:00Z'), next: read(40, '2026-10-10T11:00:00Z'), dailies: null, ticks: {} })).toEqual([]);
  });

  it('no earlier read: nothing to compare, nothing ticked', () => {
    expect(autoTicks({ game: hsr, rule, previous: null, next: read(40, '2026-10-10T11:00:00Z'), dailies: null, ticks: {} })).toEqual([]);
  });

  it('daily activity full ticks the daily income row (Daily Training); not full ticks nothing', () => {
    const next = read(240, '2026-10-10T11:00:00Z', 0);
    expect(autoTicks({ game: hsr, rule, previous: null, next, dailies: { current: 500, max: 500 }, ticks: {} }).map((t) => t.taskId)).toEqual(['income:hsr.daily-training']);
    expect(autoTicks({ game: hsr, rule, previous: null, next, dailies: { current: 400, max: 500 }, ticks: {} })).toEqual([]);
  });

  it('already ticked today: left alone', () => {
    const out = autoTicks({ game: hsr, rule, previous: null, next: read(240, '2026-10-10T11:00:00Z', 0), dailies: { current: 500, max: 500 }, ticks: { 'income:hsr.daily-training': '2026-10-10T09:00:00Z' } });
    expect(out).toEqual([]);
  });

  it('HoYoLAB ticks a task once per day: untick it and the next read leaves it unticked; the reason is kept for the row', () => {
    const tick = { taskId: 'income:hsr.daily-training', at: '2026-10-10T11:00:00Z', why: 'HoYoLAB: daily activity 500/500' };
    expect(claimAutoTicks('hsr', rule, [tick])).toEqual([tick]);
    expect(claimAutoTicks('hsr', rule, [{ ...tick, at: '2026-10-10T12:00:00Z' }])).toEqual([]);
    expect(autoTickWhy('hsr', tick.taskId, rule, Date.parse('2026-10-10T13:00:00Z'))).toBe('HoYoLAB: daily activity 500/500');
    // The next game day it may tick again.
    expect(autoTickWhy('hsr', tick.taskId, rule, Date.parse('2026-10-11T13:00:00Z'))).toBeNull();
    expect(claimAutoTicks('hsr', rule, [{ ...tick, at: '2026-10-11T11:00:00Z' }])).toHaveLength(1);
  });
});
