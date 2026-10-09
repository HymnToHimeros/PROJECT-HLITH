// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONFIRM_WORD, deletionRequest, GRACE_DAYS, isFeedToken, redact, USER_TABLES } from '../supabase/functions/_shared/accountPlan.ts';
import { buildEveningMessage, DEFAULT_CHOICES, readChoices } from '../supabase/functions/_shared/evening.ts';
import { buildIcs, fold, icsText } from '../supabase/functions/_shared/ics.ts';
import { nextDailyReset, nextWeeklyReset, readSchedule, type Schedule } from '../supabase/functions/_shared/schedule.ts';

const HOUR = 3_600_000;
// Friday 9 Oct 2026, 19:00 UTC.
const NOW = Date.UTC(2026, 9, 9, 19);
const hsr = { id: 'hsr', short: 'HSR', name: 'Honkai: Star Rail', serverLabel: 'Europe', utcOffset: 1, resetHour: 4, resetWeekday: 1 };
const schedule: Schedule = {
  games: [hsr],
  dates: [
    { game: 'hsr', kind: 'banner', title: 'Starfall', start: new Date(NOW - 200 * HOUR).toISOString(), end: new Date(NOW + 30 * HOUR).toISOString(), wanted: true },
    { game: 'hsr', kind: 'banner', title: 'Old Light', start: new Date(NOW - 200 * HOUR).toISOString(), end: new Date(NOW + 20 * HOUR).toISOString() },
    { game: 'hsr', kind: 'event', title: 'Festival; day, two', start: new Date(NOW - 50 * HOUR).toISOString(), end: new Date(NOW + 40 * HOUR).toISOString() },
    { game: 'hsr', kind: 'event', title: 'Far event', start: new Date(NOW - 50 * HOUR).toISOString(), end: new Date(NOW + 400 * HOUR).toISOString() },
  ],
};

describe('server resets from the snapshot', () => {
  it('next daily reset is 04:00 server time (03:00 UTC for UTC+1)', () => {
    expect(nextDailyReset(NOW, hsr)).toBe(Date.UTC(2026, 9, 10, 3));
  });
  it('next weekly reset is Monday 04:00 server time', () => {
    expect(nextWeeklyReset(NOW, hsr)).toBe(Date.UTC(2026, 9, 12, 3));
  });
  it('a broken snapshot reads as empty, never throws', () => {
    expect(readSchedule(null)).toEqual({ games: [], dates: [], openTasks: [] });
    expect(readSchedule({ games: [{ id: 1 }], dates: [{ title: 'x', start: 'no', end: 'no' }] }).dates).toEqual([]);
  });
});

describe('calendar feed (.ics)', () => {
  const ics = buildIcs(schedule, NOW);
  it('is a valid calendar with CRLF line ends', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
  });
  it('repeats daily and weekly resets, and lists real dates', () => {
    expect(ics).toContain('SUMMARY:HSR daily reset');
    expect(ics).toContain('RRULE:FREQ=DAILY');
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO');
    expect(ics).toContain('DTSTART:20261010T030000Z');
    expect(ics).toContain('SUMMARY:HSR · Festival\\; day\\, two');
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(2 + schedule.dates.length);
  });
  it('escapes and folds text', () => {
    expect(icsText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
    expect(fold('x'.repeat(160)).split('\r\n ').length).toBe(3);
  });
});

describe('evening message', () => {
  it('lists resets, wanted banners, banners and events ending, never stamina without data', () => {
    const m = buildEveningMessage(schedule, DEFAULT_CHOICES, NOW);
    expect(m.lines[0]).toBe('HSR: daily reset in 8 h.');
    expect(m.text).toContain('★ Starfall leaves in 1 d 6 h: on your wanted list.');
    expect(m.text).toContain('Banner ending: Old Light in 20 h.');
    expect(m.text).toContain('Event ending: Festival; day, two in 1 d 16 h.');
    expect(m.text).not.toContain('Far event');
    expect(m.text).not.toMatch(/stamina/i);
    expect(m.noData[0]).toMatch(/stamina/);
  });
  it('respects your choices and says when all is done', () => {
    const quiet = buildEveningMessage(schedule, readChoices({ items: { resets: false, banners: false, events: false, wanted: false, stamina: false } }), NOW);
    expect(quiet.lines).toEqual(['All caught up. Nothing ends before the next reset.']);
    expect(readChoices({ eventDays: 9 }).eventDays).toBe(2);
  });
});

describe('export and delete my account', () => {
  const sql = readdirSync('supabase/migrations')
    .filter((f) => f.endsWith('.sql'))
    .map((f) => readFileSync(`supabase/migrations/${f}`, 'utf8'))
    .join('\n');
  it('exports every table that holds a user_id', () => {
    const withUser = [...sql.matchAll(/create table public\.(\w+)\s*\(([\s\S]*?)\n\);/g)].filter((m) => /\buser_id\b/.test(m[2] ?? '') && m[1] !== 'owners').map((m) => m[1]);
    expect([...USER_TABLES].sort()).toEqual(withUser.sort());
  });
  it('leaves secrets out of an export', () => {
    const rows = redact('reminder_settings', [{ user_id: 'u', feed_token: 'abc', push_subscription: null, notify: {} }]);
    expect(rows[0]).toEqual({ user_id: 'u', feed_token: '(left out: secret)', push_subscription: null, notify: {} });
    expect(redact('pulls', [{ id: 1 }])).toEqual([{ id: 1 }]);
  });
  it('a deletion request removes nothing and gives a 30-day grace period', () => {
    const r = deletionRequest('u', NOW);
    expect(Date.parse(r.purge_after) - NOW).toBe(GRACE_DAYS * 24 * HOUR);
    expect(r.cancelled_at).toBeNull();
    expect(CONFIRM_WORD).toBe('DELETE');
    expect(readFileSync('supabase/functions/delete-account/index.ts', 'utf8')).not.toMatch(/\.delete\(/);
  });
  it('calendar tokens must be long and URL-safe', () => {
    expect(isFeedToken('a'.repeat(40))).toBe(true);
    expect(isFeedToken('short')).toBe(false);
    expect(isFeedToken(`${'a'.repeat(40)}/../x`)).toBe(false);
    expect(isFeedToken(null)).toBe(false);
  });
});
