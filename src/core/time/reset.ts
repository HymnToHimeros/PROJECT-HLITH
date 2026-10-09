/**
 * Server resets and local time. Reset rules belong to the game record, never the
 * shell. Game servers run on fixed UTC offsets (no daylight saving), so all maths
 * is done in UTC with that offset; only display uses the viewer's time zone.
 */
import type { GameContract } from '../contract';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

export interface ServerRule {
  utcOffset: number; // hours
  hour: number; // daily reset hour, server time
  weekday: number; // weekly reset day, 0 = Sunday
}

export function serverRule(game: GameContract, serverId: string): ServerRule {
  const server = game.servers.find((s) => s.id === serverId) ?? game.servers[0];
  if (!server) throw new Error(`${game.id} has no servers`);
  return { utcOffset: server.utcOffset, hour: game.reset.hour, weekday: game.reset.weekday };
}

/** Start of the current game day: the latest daily reset at or before `now`. */
export function dayStart(now: number, rule: ServerRule): number {
  // Shift so a "game day" starts at 00:00 in shifted time.
  const shift = (rule.utcOffset - rule.hour) * HOUR;
  return Math.floor((now + shift) / DAY) * DAY - shift;
}

export function nextDailyReset(now: number, rule: ServerRule): number {
  return dayStart(now, rule) + DAY;
}

/** Start of the current game week: the latest weekly reset at or before `now`. */
export function weekStart(now: number, rule: ServerRule): number {
  const today = dayStart(now, rule);
  // Weekday of this game day in server time (1970-01-01 was a Thursday = 4).
  const serverDay = Math.floor((today + rule.utcOffset * HOUR + rule.hour * HOUR) / DAY);
  const weekday = (serverDay + 4) % 7;
  const back = (weekday - rule.weekday + 7) % 7;
  return today - back * DAY;
}

export function nextWeeklyReset(now: number, rule: ServerRule): number {
  return weekStart(now, rule) + WEEK;
}

/** How many daily resets happen in (from, to]. */
export function dailyResetsBetween(from: number, to: number, rule: ServerRule): number {
  if (to <= from) return 0;
  return Math.round((dayStart(to, rule) - dayStart(from, rule)) / DAY);
}

/** How many weekly resets happen in (from, to]. */
export function weeklyResetsBetween(from: number, to: number, rule: ServerRule): number {
  if (to <= from) return 0;
  return Math.round((weekStart(to, rule) - weekStart(from, rule)) / WEEK);
}

// ── Display: always the viewer's time zone and locale ─────────────────

export interface Viewer {
  locale?: string | undefined;
  timeZone?: string | undefined;
}

const opts = (v: Viewer, o: Intl.DateTimeFormatOptions): Intl.DateTimeFormatOptions =>
  v.timeZone ? { ...o, timeZone: v.timeZone } : o;

export function formatTime(t: number, v: Viewer = {}): string {
  return new Intl.DateTimeFormat(v.locale, opts(v, { hour: '2-digit', minute: '2-digit' })).format(t);
}

export function formatDate(t: number, v: Viewer = {}): string {
  return new Intl.DateTimeFormat(v.locale, opts(v, { day: 'numeric', month: 'short' })).format(t);
}

export function formatDateTime(t: number, v: Viewer = {}): string {
  return new Intl.DateTimeFormat(v.locale, opts(v, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })).format(t);
}

/** "12–26 Oct", "28 Oct – 3 Nov" style, in the viewer's locale. */
export function formatRange(start: number, end: number, v: Viewer = {}): string {
  return new Intl.DateTimeFormat(v.locale, opts(v, { day: 'numeric', month: 'short' })).formatRange(start, end);
}

/** What the server picker shows: the next daily reset in the viewer's own time. */
export function resetInLocalTime(game: GameContract, serverId: string, now: number, v: Viewer = {}): string {
  return `Daily reset ${formatTime(nextDailyReset(now, serverRule(game, serverId)), v)} your time`;
}
