/**
 * Customise → Theme schedule (T52b): a different theme by day and by night, or one theme per
 * game. Off = the one theme you picked in Account → Theme. No React here.
 */
import type { Scope } from '../registry/layout';
import { isOwnerThemeId, type OwnerThemeId } from './ownerThemes';
import { isTheme, type Theme } from './themes';

export type ThemeChoice = Theme | OwnerThemeId;
export type ThemeSchedule =
  | { mode: 'day-night'; day: ThemeChoice; night: ThemeChoice; dayFrom: string; nightFrom: string }
  | { mode: 'per-game'; themes: Record<Scope, ThemeChoice> };

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const isChoice = (v: unknown): v is ThemeChoice => isTheme(v) || isOwnerThemeId(v);

export function cleanSchedule(raw: unknown): ThemeSchedule | null {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  if (!r) return null;
  if (r.mode === 'day-night' && isChoice(r.day) && isChoice(r.night)) {
    return { mode: 'day-night', day: r.day, night: r.night, dayFrom: typeof r.dayFrom === 'string' && HHMM.test(r.dayFrom) ? r.dayFrom : '07:00', nightFrom: typeof r.nightFrom === 'string' && HHMM.test(r.nightFrom) ? r.nightFrom : '19:00' };
  }
  if (r.mode === 'per-game' && r.themes && typeof r.themes === 'object') {
    const themes = Object.fromEntries(Object.entries(r.themes as Record<string, unknown>).filter((e): e is [string, ThemeChoice] => isChoice(e[1])));
    return { mode: 'per-game', themes };
  }
  return null;
}

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** The theme to show now: the schedule's, else your one theme. `now` in your own local time. */
export function scheduledTheme(base: unknown, schedule: unknown, scope: Scope, now: Date): unknown {
  const s = cleanSchedule(schedule);
  if (!s) return base;
  if (s.mode === 'per-game') return s.themes[scope] ?? base;
  const m = now.getHours() * 60 + now.getMinutes();
  const day = minutes(s.dayFrom);
  const night = minutes(s.nightFrom);
  const isDay = day <= night ? m >= day && m < night : m >= day || m < night;
  return isDay ? s.day : s.night;
}
