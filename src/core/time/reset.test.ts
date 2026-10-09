import { describe, expect, it } from 'vitest';
import {
  dailyResetsBetween,
  dayStart,
  formatRange,
  formatTime,
  nextDailyReset,
  nextWeeklyReset,
  weekStart,
  weeklyResetsBetween,
  type ServerRule,
} from './reset';

const at = (iso: string) => Date.parse(iso);
const iso = (t: number) => new Date(t).toISOString();
// 04:00 server time, Monday weekly reset.
const europe: ServerRule = { utcOffset: 1, hour: 4, weekday: 1 }; // 04:00 UTC+1 = 03:00 UTC
const america: ServerRule = { utcOffset: -5, hour: 4, weekday: 1 }; // 04:00 UTC-5 = 09:00 UTC
const asia: ServerRule = { utcOffset: 8, hour: 4, weekday: 1 }; // 04:00 UTC+8 = 20:00 UTC previous day

describe('daily reset', () => {
  it('finds the next reset on each server', () => {
    const now = at('2026-10-09T12:00:00Z'); // a Friday
    expect(iso(nextDailyReset(now, europe))).toBe('2026-10-10T03:00:00.000Z');
    expect(iso(nextDailyReset(now, america))).toBe('2026-10-10T09:00:00.000Z');
    expect(iso(nextDailyReset(now, asia))).toBe('2026-10-09T20:00:00.000Z');
  });

  it('a reset exactly now starts a new day', () => {
    const now = at('2026-10-09T03:00:00Z');
    expect(iso(dayStart(now, europe))).toBe('2026-10-09T03:00:00.000Z');
    expect(iso(dayStart(now - 1, europe))).toBe('2026-10-08T03:00:00.000Z');
  });

  it('counts resets in a window, never the start', () => {
    const from = at('2026-10-09T12:00:00Z');
    expect(dailyResetsBetween(from, at('2026-10-10T02:59:59Z'), europe)).toBe(0);
    expect(dailyResetsBetween(from, at('2026-10-10T03:00:00Z'), europe)).toBe(1);
    expect(dailyResetsBetween(from, at('2026-10-19T12:00:00Z'), europe)).toBe(10);
    expect(dailyResetsBetween(from, from, europe)).toBe(0);
  });
});

describe('weekly reset', () => {
  it('is Monday 04:00 server time', () => {
    const friday = at('2026-10-09T12:00:00Z');
    expect(iso(nextWeeklyReset(friday, europe))).toBe('2026-10-12T03:00:00.000Z');
    expect(iso(weekStart(friday, europe))).toBe('2026-10-05T03:00:00.000Z');
  });

  it('Asia resets on Sunday evening UTC, which is Monday morning there', () => {
    expect(iso(nextWeeklyReset(at('2026-10-09T12:00:00Z'), asia))).toBe('2026-10-11T20:00:00.000Z');
  });

  it('just before Monday 04:00 the week has not turned yet', () => {
    const t = at('2026-10-12T02:59:00Z');
    expect(iso(weekStart(t, europe))).toBe('2026-10-05T03:00:00.000Z');
    expect(iso(weekStart(t + 60_000, europe))).toBe('2026-10-12T03:00:00.000Z');
  });

  it('counts weekly resets in a window', () => {
    expect(weeklyResetsBetween(at('2026-10-09T12:00:00Z'), at('2026-10-27T00:00:00Z'), europe)).toBe(3);
  });
});

describe('display in the viewer time zone and locale', () => {
  const t = at('2026-10-10T03:00:00Z');
  it('shows reset time where the viewer is', () => {
    expect(formatTime(t, { locale: 'en-GB', timeZone: 'Europe/Berlin' })).toBe('05:00');
    expect(formatTime(t, { locale: 'en-GB', timeZone: 'America/New_York' })).toBe('23:00');
  });
  it('formats date ranges per locale', () => {
    const a = at('2026-10-12T12:00:00Z');
    const b = at('2026-10-26T12:00:00Z');
    expect(formatRange(a, b, { locale: 'en-GB', timeZone: 'UTC' })).toBe('12–26 Oct');
    // ICU uses thin spaces around the dash; compare with plain spaces.
    expect(formatRange(a, b, { locale: 'en-US', timeZone: 'UTC' }).replace(/\s/g, ' ')).toBe('Oct 12 – 26');
  });
});
