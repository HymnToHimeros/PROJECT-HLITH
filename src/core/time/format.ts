/** Locale-aware numbers and the countdown rules from DESIGN.md (Layer 4 · Timer). */
import { numberLocale } from './displayFormat';

/** Grouped the way Customise → Time and format says (displayFormat.ts); missing = the device's own way. */
export function formatNumber(n: number, locale?: string): string {
  return new Intl.NumberFormat(numberLocale(locale)).format(n);
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * ≥ 1 day → "2d 04h" · < 1 day → "14:22:07" (ticks live) · past → "0:00:00".
 */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  if (ms >= DAY) return `${Math.floor(ms / DAY)}d ${pad(Math.floor((ms % DAY) / HOUR))}h`;
  const s = Math.floor(ms / 1000);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** Deadlines under 72 hours turn ember.soft. */
export const isUrgent = (ms: number): boolean => ms > 0 && ms < 72 * HOUR;

/** Whether the countdown needs a once-a-second tick. */
export const ticksLive = (ms: number): boolean => ms > 0 && ms < DAY;
