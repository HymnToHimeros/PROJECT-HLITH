/**
 * The schedule snapshot the app saves in reminder_settings.schedule. It is built
 * in the browser from the game records (servers, reset rules, real banner and
 * event dates; never examples), so server functions need no game data of their own.
 * Pure: shared by the evening-message and ics-feed functions and the tests.
 */
export interface ScheduleGame {
  id: string;
  short: string;
  name: string;
  serverLabel: string;
  /** Hours from UTC of the chosen server (fixed, no daylight saving). */
  utcOffset: number;
  /** Daily reset hour, server time. */
  resetHour: number;
  /** Weekly reset day, 0 = Sunday. */
  resetWeekday: number;
}

export interface ScheduleDate {
  game: string;
  kind: 'banner' | 'event' | 'endgame' | 'version' | 'plan';
  title: string;
  /** ISO times. */
  start: string;
  end: string;
  /** A character on your wanted list is on this banner. */
  wanted?: boolean;
  /** Leak: shown as unverified. */
  unverified?: boolean;
}

export interface Schedule {
  games: ScheduleGame[];
  dates: ScheduleDate[];
  /** Tasks not ticked yet when the app last synced (the evening message lists them). */
  openTasks?: { game: string; label: string }[];
  /** When the app wrote this snapshot (ISO). */
  savedAt?: string;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export function nextDailyReset(now: number, g: ScheduleGame): number {
  const shift = (g.utcOffset - g.resetHour) * HOUR;
  return Math.floor((now + shift) / DAY) * DAY - shift + DAY;
}

export function nextWeeklyReset(now: number, g: ScheduleGame): number {
  let t = nextDailyReset(now, g);
  // Day of week of that reset, in server time.
  for (let i = 0; i < 7; i++) {
    const wd = new Date(t + g.utcOffset * HOUR).getUTCDay();
    if (wd === g.resetWeekday) return t;
    t += DAY;
  }
  return t;
}

/** Reads a snapshot from the database defensively: bad rows give an empty schedule. */
export function readSchedule(raw: unknown): Schedule {
  const r = (raw ?? {}) as Partial<Schedule>;
  const games = Array.isArray(r.games) ? r.games.filter((g) => g && typeof g.id === 'string' && Number.isFinite(g.utcOffset) && Number.isFinite(g.resetHour)) : [];
  const dates = Array.isArray(r.dates) ? r.dates.filter((d) => d && typeof d.title === 'string' && Number.isFinite(Date.parse(d.start)) && Number.isFinite(Date.parse(d.end))) : [];
  const openTasks = Array.isArray(r.openTasks) ? r.openTasks.filter((t) => t && typeof t.label === 'string') : [];
  return { games, dates, openTasks, ...(typeof r.savedAt === 'string' ? { savedAt: r.savedAt } : {}) };
}
