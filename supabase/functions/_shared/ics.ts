/**
 * Calendar feed (R52): builds an .ics file from a schedule snapshot. Daily and
 * weekly resets repeat (RRULE); banners, events, endgame cycles and your plans are
 * single events with their real dates. Pure: used by ics-feed and the tests.
 */
import type { Schedule } from './schedule.ts';
import { nextDailyReset, nextWeeklyReset } from './schedule.ts';

const pad = (n: number) => String(n).padStart(2, '0');
/** 20261009T040000Z */
export const icsTime = (t: number) => {
  const d = new Date(t);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
};

/** RFC 5545 text escaping. */
export const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Lines longer than 75 octets are folded with CRLF + space. */
export function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  let curLen = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (curLen + n > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
      curLen = 0;
    }
    cur += ch;
    curLen += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const KIND_LABEL: Record<string, string> = { banner: 'Banner', event: 'Event', endgame: 'Endgame', version: 'Version', plan: 'Your plan' };
const WEEKDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function uid(parts: string[]): string {
  let h = 0;
  for (const ch of parts.join('|')) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return `${parts[0]}-${(h >>> 0).toString(36)}@hlith`;
}

export function buildIcs(schedule: Schedule, now: number): string {
  const stamp = icsTime(now);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PROJECT-HLITH//HLITH calendar feed//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:HLITH', 'X-PUBLISHED-TTL:PT6H'];
  const event = (id: string[], start: number, end: number, summary: string, description: string, rrule?: string) => {
    lines.push('BEGIN:VEVENT', `UID:${uid(id)}`, `DTSTAMP:${stamp}`, `DTSTART:${icsTime(start)}`, `DTEND:${icsTime(end)}`, `SUMMARY:${icsText(summary)}`, `DESCRIPTION:${icsText(description)}`);
    if (rrule) lines.push(`RRULE:${rrule}`);
    lines.push('END:VEVENT');
  };
  for (const g of schedule.games) {
    const daily = nextDailyReset(now, g);
    event([g.id, 'daily'], daily, daily + 15 * 60_000, `${g.short} daily reset`, `${g.name}, ${g.serverLabel} server. Dailies and stamina-based tasks start over.`, 'FREQ=DAILY');
    const weekly = nextWeeklyReset(now, g);
    event([g.id, 'weekly'], weekly, weekly + 15 * 60_000, `${g.short} weekly reset`, `${g.name}, ${g.serverLabel} server. Weekly tasks start over.`, `FREQ=WEEKLY;BYDAY=${WEEKDAY[g.resetWeekday] ?? 'MO'}`);
  }
  for (const d of schedule.dates) {
    const g = schedule.games.find((x) => x.id === d.game);
    const start = Date.parse(d.start);
    const end = Date.parse(d.end);
    const tag = g ? `${g.short} · ` : '';
    const flags = [d.wanted ? 'on your wanted list' : '', d.unverified ? 'UNVERIFIED leak' : ''].filter(Boolean).join(', ');
    event([d.game, d.kind, d.title, d.start], start, Math.max(end, start + 60_000), `${tag}${d.title}`, `${KIND_LABEL[d.kind] ?? d.kind}${flags ? ` (${flags})` : ''}. From HLITH.`);
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
