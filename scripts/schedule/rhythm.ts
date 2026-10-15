/**
 * When to look for news. Pure planning; no network (tests/scheduleRhythm.test.ts).
 *
 * Patch day moves (HSR 4.3 and 4.6 opened on a Monday, 4.4 on a Wednesday, 4.5 ran
 * only 33 days), so checks are counted from patch day, never from weekdays. Patch day
 * comes from versions.json (the official update notice). What happens around it keeps
 * its order: the special program is announced about 16 days before, the pre-download
 * notice 2 days before, the patch at 06:00 UTC+8 plus about 5 hours of maintenance.
 *
 * The plan for one game:
 *  - busy start, patch → patch + 14 days: one check a day;
 *  - quiet middle: one check every third day;
 *  - busy end, from 2 days before the expected program announcement to the next patch: daily;
 *  - extra checks 1 hour after each expected notice, 1 hour after maintenance ends on
 *    patch day, and 1 hour after each known banner start (phase 2).
 * Expected notice times are the median of the last 3 versions' real times (rhythm.json,
 * written by `npm run data:schedule` from the official news list), so the plan corrects
 * itself after every version. Every run re-reads versions.json, so a moved patch day
 * moves every check after it.
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Daily checks at 10:30 UTC (18:30 UTC+8), after HoYoverse's usual posting hours. */
export const DAILY_AT_UTC = { h: 10, m: 30 };
export const BUSY_START_DAYS = 14;
export const QUIET_EVERY_DAYS = 3;
/** A version whose end is not stated yet is expected to last this long (when a game has no history yet). */
export const USUAL_LENGTH_DAYS = 42;

/**
 * How long this game's versions usually last: the median of its last 3 finished versions, in
 * days (HSR/ZZZ about 42; Endfield runs 5–7 weeks). Falls back to USUAL_LENGTH_DAYS.
 */
export function usualLength(versions: VersionSpan[]): number {
  const days = [...versions]
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    .slice(0, -1)
    .slice(-3)
    .map((v) => (Date.parse(v.end) - Date.parse(v.start)) / DAY)
    .filter((d) => d > 20 && d < 80)
    .sort((a, b) => a - b);
  if (!days.length) return USUAL_LENGTH_DAYS;
  const mid = Math.floor(days.length / 2);
  return Math.round(days.length % 2 ? (days[mid] ?? USUAL_LENGTH_DAYS) : ((days[mid - 1] ?? 0) + (days[mid] ?? 0)) / 2);
}
const MAINTENANCE_HOURS = 5;
const LEAD_DAYS = 2;

export type Signal = 'program' | 'preDownload';

/** Hours from patch start (version start) to each notice, per version: rhythm.json. */
export type SignalLog = Partial<Record<Signal, Record<string, number>>>;

/** Used until a game has its own history (HSR 2.3 / ZZZ 2.8 programs; pre-download notices 2.x–3.x). */
export const DEFAULT_OFFSETS: Record<string, Record<Signal, number>> = {
  hsr: { program: -372, preDownload: -39.5 },
  zzz: { program: -378, preDownload: -42 },
  // Endfield: the "New Version Guide Page" post (1.6) and the "Version Pre-Download & Update Notice" (1.3–1.6).
  endfield: { program: -208, preDownload: -48 },
};

export interface VersionSpan {
  id: string;
  start: string;
  end: string;
}

export interface Slot {
  at: string;
  why: string[];
}

export interface Plan {
  game: string;
  /** The version running at `now` and the expected next patch. */
  version: string;
  nextPatch: string;
  /** True when the current version's end is stated by the official notice. */
  nextPatchStated: boolean;
  slots: Slot[];
}

const versionKey = (id: string) => id.split('.').map((n) => n.padStart(4, '0')).join('.');

/** Median of the last 3 versions' offsets, or the default. */
export function expectedOffset(game: string, signal: Signal, log: SignalLog): number {
  const seen = Object.entries(log[signal] ?? {})
    .sort(([a], [b]) => versionKey(a).localeCompare(versionKey(b)))
    .slice(-3)
    .map(([, h]) => h)
    .sort((a, b) => a - b);
  if (!seen.length) return DEFAULT_OFFSETS[game]?.[signal] ?? 0;
  const mid = Math.floor(seen.length / 2);
  return seen.length % 2 ? (seen[mid] ?? 0) : ((seen[mid - 1] ?? 0) + (seen[mid] ?? 0)) / 2;
}

/** The daily check time on the day of `t`, or the next day when it has passed. */
function dailyOnOrAfter(t: number): number {
  const d = new Date(t);
  const slot = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), DAILY_AT_UTC.h, DAILY_AT_UTC.m);
  return slot >= t ? slot : slot + DAY;
}

/**
 * Checks for one game from `from` for `days` days.
 * `versions` must hold the current version (stated start and end, as versions.json does).
 * `starts` are known banner starts (ISO), for the phase-2 checks.
 */
export function planChecks(
  game: string,
  versions: VersionSpan[],
  log: SignalLog,
  from: number,
  days: number,
  starts: string[] = [],
  usualDays = USUAL_LENGTH_DAYS,
): Plan | undefined {
  const sorted = [...versions].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const current = sorted.filter((v) => Date.parse(v.start) <= from).at(-1) ?? sorted[0];
  if (!current) return undefined;
  const until = from + days * DAY;
  const raw: { at: number; why: string }[] = [];
  const add = (at: number, why: string) => {
    if (at >= from && at < until) raw.push({ at, why });
  };

  // Walk version by version: the current one, then expected ones after it, until the horizon.
  let start = Date.parse(current.start);
  let end = Date.parse(current.end);
  let id = current.id;
  let stated = true;
  const first = { id, end, stated };
  for (let guard = 0; start < until && guard < 6; guard++) {
    const program = end + expectedOffset(game, 'program', log) * HOUR;
    const busyEnd = program - LEAD_DAYS * DAY;
    const busyStart = start + BUSY_START_DAYS * DAY;

    add(start + (MAINTENANCE_HOURS + 1) * HOUR, `${id} patch day: maintenance over`);
    for (let t = dailyOnOrAfter(start); t < busyStart && t < end; t += DAY) add(t, `${id} first two weeks: daily`);
    for (let t = dailyOnOrAfter(busyStart + QUIET_EVERY_DAYS * DAY - DAY); t < busyEnd; t += QUIET_EVERY_DAYS * DAY) add(t, `${id} middle: every ${QUIET_EVERY_DAYS} days`);
    for (let t = dailyOnOrAfter(Math.max(busyEnd, busyStart)); t < end; t += DAY) add(t, `next patch ${stated ? '' : '(estimated) '}${new Date(end).toISOString().slice(0, 10)}: daily`);
    add(program + HOUR, 'special program announcement expected');
    add(end + (expectedOffset(game, 'preDownload', log) + 1) * HOUR, 'pre-download notice expected');

    // The next version: its start is this one's end; its own end is not known yet.
    start = end;
    end = start + usualDays * DAY;
    id = nextId(id);
    stated = false;
  }
  for (const s of starts) {
    const t = Date.parse(s);
    if (t > Date.parse(current.start) + DAY) add(t + HOUR, 'new banners start');
  }

  return { game, version: first.id, nextPatch: new Date(first.end).toISOString(), nextPatchStated: first.stated, slots: mergeSlots(raw) };
}

function nextId(id: string): string {
  const [major = '0', minor = '0'] = id.split('.');
  return `${major}.${Number(minor) + 1}`;
}

/** Checks within 2 hours of each other are one check (at the later time, so every reason is covered). */
function mergeSlots(raw: { at: number; why: string }[]): Slot[] {
  raw.sort((a, b) => a.at - b.at);
  const out: { at: number; first: number; why: string[] }[] = [];
  for (const r of raw) {
    const last = out.at(-1);
    if (last && r.at - last.first < 2 * HOUR) {
      last.at = r.at;
      if (!last.why.includes(r.why)) last.why.push(r.why);
    } else out.push({ at: r.at, first: r.at, why: [r.why] });
  }
  return out.map((s) => ({ at: new Date(s.at).toISOString(), why: s.why }));
}

/** The checks that fall in (now − window, now]: what a run started now should do. */
export function dueNow(plans: Plan[], now: number, windowMs: number): { game: string; slot: Slot }[] {
  return plans.flatMap((p) => p.slots.filter((s) => Date.parse(s.at) > now - windowMs && Date.parse(s.at) <= now).map((slot) => ({ game: p.game, slot })));
}

/** The first check after `now` over all games. */
export function nextCheck(plans: Plan[], now: number): { game: string; slot: Slot } | undefined {
  return plans
    .flatMap((p) => p.slots.map((slot) => ({ game: p.game, slot })))
    .filter((x) => Date.parse(x.slot.at) > now)
    .sort((a, b) => Date.parse(a.slot.at) - Date.parse(b.slot.at))[0];
}

/**
 * Key moments for the research routine (docs/ROUTINES.md): patch day, the expected program
 * announcement and pre-download notice, new banner starts, and the first check of each quiet
 * middle. Both games share a run when their moments fall within 12 hours of each other
 * (one run, at the later time, so both are covered).
 */
export function keyMoments(plans: Plan[], now: number): { at: string; why: string[] }[] {
  const KEY = /patch day|program announcement|pre-download|new banners start/;
  const raw = plans.flatMap((p) => {
    const middles = new Set<string>();
    return p.slots
      .filter((s) => {
        if (s.why.some((w) => KEY.test(w))) return true;
        const middle = s.why.find((w) => w.includes('middle'));
        if (!middle || middles.has(middle)) return false;
        middles.add(middle);
        return true;
      })
      .map((s) => ({ at: Date.parse(s.at), why: s.why.map((w) => `${p.game.toUpperCase()} ${w}`) }));
  });
  raw.sort((a, b) => a.at - b.at);
  const out: { at: number; first: number; why: string[] }[] = [];
  for (const r of raw) {
    const last = out.at(-1);
    if (last && r.at - last.first < 12 * HOUR) {
      last.at = r.at;
      last.why.push(...r.why.filter((w) => !last.why.includes(w)));
    } else out.push({ at: r.at, first: r.at, why: [...r.why] });
  }
  return out.filter((k) => k.at > now).map((k) => ({ at: new Date(k.at).toISOString(), why: k.why }));
}
