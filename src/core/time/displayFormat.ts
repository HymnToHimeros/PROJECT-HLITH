/**
 * Customise → Time and format (T52b): 12- or 24-hour clock, the order of day and month,
 * how big numbers are grouped, and the first day of the week. Missing = this device's own
 * way (its locale), which is how HLITH always worked. The formatters in reset.ts and
 * format.ts read this, so every screen follows one setting. No React here.
 */
export interface DisplayFormat {
  clock?: '12h' | '24h';
  /** Day and month order for short dates ("11 Oct" / "Oct 11"); 'ymd' = 2026-10-11. */
  date?: 'dmy' | 'mdy' | 'ymd';
  /** 1,234.5 / 1.234,5 / 1 234,5 */
  numbers?: 'comma' | 'dot' | 'space';
  weekStart?: 'mon' | 'sun';
  /** Countdowns: time left ("2d 04h", the default), the date and time it happens, or both. */
  countdown?: 'left' | 'date' | 'both';
}

export const CLOCKS = ['12h', '24h'] as const;
export const DATE_ORDERS = ['dmy', 'mdy', 'ymd'] as const;
export const NUMBER_STYLES = ['comma', 'dot', 'space'] as const;
export const WEEK_STARTS = ['mon', 'sun'] as const;
export const COUNTDOWNS = ['left', 'date', 'both'] as const;

const pick = <T extends string>(list: readonly T[], v: unknown): T | undefined => ((list as readonly unknown[]).includes(v) ? (v as T) : undefined);

export function cleanFormat(raw: unknown): DisplayFormat {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out: DisplayFormat = {};
  const clock = pick(CLOCKS, r.clock);
  const date = pick(DATE_ORDERS, r.date);
  const numbers = pick(NUMBER_STYLES, r.numbers);
  const weekStart = pick(WEEK_STARTS, r.weekStart);
  const countdown = pick(COUNTDOWNS, r.countdown);
  if (countdown && countdown !== 'left') out.countdown = countdown;
  if (clock) out.clock = clock;
  if (date) out.date = date;
  if (numbers) out.numbers = numbers;
  if (weekStart) out.weekStart = weekStart;
  return out;
}

let current: DisplayFormat = {};

/** Set by the shell from your settings before it draws. */
export function setDisplayFormat(f: unknown): void {
  current = cleanFormat(f);
}
export const displayFormat = (): DisplayFormat => current;

/** Intl options for the clock choice (nothing = the locale's own). */
export const clockOptions = (): Intl.DateTimeFormatOptions => (current.clock ? { hour12: current.clock === '12h' } : {});

/** A locale whose number grouping matches the choice (nothing = the device's). */
export const numberLocale = (fallback?: string): string | undefined =>
  current.numbers === 'comma' ? 'en-US' : current.numbers === 'dot' ? 'de-DE' : current.numbers === 'space' ? 'fr-FR' : fallback;

/** 0 = Sunday … 1 = Monday: the first day of your week. Missing choice = Monday (HLITH's design). */
export const firstDayOfWeek = (): 0 | 1 => (current.weekStart === 'sun' ? 0 : 1);

/**
 * A short date in the chosen order, keeping the locale's own month names:
 * dmy "11 Oct", mdy "Oct 11", ymd "2026-10-11". Returns null when no order is chosen.
 */
export function orderedDate(t: number, locale: string | undefined, timeZone: string | undefined, withYear = false): string | null {
  if (!current.date) return null;
  const tz = timeZone ? { timeZone } : {};
  if (current.date === 'ymd') {
    const p = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', ...tz }).format(t);
    return withYear ? p : p.slice(5);
  }
  const parts = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), ...tz }).formatToParts(t);
  const get = (type: string) => parts.find((x) => x.type === type)?.value ?? '';
  const [day, month, year] = [get('day'), get('month'), get('year')];
  const core = current.date === 'mdy' ? `${month} ${day}` : `${day} ${month}`;
  return withYear && year ? `${core} ${year}` : core;
}
