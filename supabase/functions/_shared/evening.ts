/**
 * The evening message (R51): what is still open before the next reset, built
 * from the schedule snapshot and your notification choices. Honest: stamina is
 * only mentioned when a live reading exists (none yet), and nothing is guessed.
 * Pure: used by the evening-message function and the tests.
 */
import type { Schedule } from './schedule.ts';
import { nextDailyReset, nextWeeklyReset } from './schedule.ts';

export interface NotifyChoices {
  items: { resets: boolean; stamina: boolean; banners: boolean; events: boolean; wanted: boolean };
  /** An unfinished event joins the message in its last N evenings. */
  eventDays: number;
}

export const DEFAULT_CHOICES: NotifyChoices = { items: { resets: true, stamina: true, banners: true, events: true, wanted: true }, eventDays: 2 };

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export function inWords(ms: number): string {
  const h = Math.max(0, Math.round(ms / HOUR));
  if (h < 1) return 'under an hour';
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  const rest = h % 24;
  return rest ? `${d} d ${rest} h` : `${d} d`;
}

export function readChoices(raw: unknown): NotifyChoices {
  const r = (raw ?? {}) as Partial<NotifyChoices>;
  const items = { ...DEFAULT_CHOICES.items, ...(r.items ?? {}) };
  const eventDays = r.eventDays === 1 || r.eventDays === 2 ? r.eventDays : DEFAULT_CHOICES.eventDays;
  return { items, eventDays };
}

export interface EveningMessage {
  title: string;
  lines: string[];
  text: string;
  /** Items you asked for that have no data yet (e.g. stamina without a live link). */
  noData: string[];
}

export function buildEveningMessage(schedule: Schedule, choices: NotifyChoices, now: number): EveningMessage {
  const lines: string[] = [];
  const noData: string[] = [];
  const short = (id: string) => schedule.games.find((g) => g.id === id)?.short ?? id.toUpperCase();
  const tags = schedule.games.length > 1;

  if (choices.items.resets) {
    for (const g of schedule.games) {
      const daily = nextDailyReset(now, g);
      const weekly = nextWeeklyReset(now, g);
      const weeklySoon = weekly - now <= DAY;
      lines.push(`${g.short}: daily reset in ${inWords(daily - now)}${weeklySoon ? `, weekly reset in ${inWords(weekly - now)}` : ''}.`);
    }
  }
  const open = schedule.openTasks ?? [];
  if (open.length) lines.push(`Still open: ${open.slice(0, 6).map((t) => (tags ? `${t.label} (${short(t.game)})` : t.label)).join(', ')}${open.length > 6 ? ` and ${open.length - 6} more` : ''}.`);

  const ending = (kind: string, within: number) =>
    schedule.dates.filter((d) => d.kind === kind && Date.parse(d.start) <= now && Date.parse(d.end) > now && Date.parse(d.end) - now <= within).sort((a, b) => Date.parse(a.end) - Date.parse(b.end));

  if (choices.items.wanted) {
    for (const d of ending('banner', 3 * DAY).filter((x) => x.wanted)) lines.push(`★ ${d.title}${tags ? ` (${short(d.game)})` : ''} leaves in ${inWords(Date.parse(d.end) - now)}: on your wanted list.`);
  }
  if (choices.items.banners) {
    for (const d of ending('banner', 2 * DAY).filter((x) => !(choices.items.wanted && x.wanted))) lines.push(`Banner ending: ${d.title}${tags ? ` (${short(d.game)})` : ''} in ${inWords(Date.parse(d.end) - now)}.`);
  }
  if (choices.items.events) {
    for (const d of ending('event', choices.eventDays * DAY)) lines.push(`Event ending: ${d.title}${tags ? ` (${short(d.game)})` : ''} in ${inWords(Date.parse(d.end) - now)}.`);
  }
  if (choices.items.stamina) noData.push('stamina (no live reading: link HoYoLAB)');

  const quiet = lines.length === 0 || (choices.items.resets && lines.length === schedule.games.length && !open.length);
  if (quiet) lines.push('All caught up. Nothing ends before the next reset.');
  return { title: 'Good evening', lines, text: lines.join('\n'), noData };
}
