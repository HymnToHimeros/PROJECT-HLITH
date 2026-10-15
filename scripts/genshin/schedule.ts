/**
 * Genshin Impact versions, wishes (banners), events and endgame periods: pure rules
 * (tests/genshinSchedule.test.ts). Fetching is in scripts/import-genshin-schedule.ts.
 *
 * Sources, in order of trust:
 * 1. HoYoverse: the version notices on the official news list ("Update maintenance begins
 *    2026/09/23 06:00 (UTC+8) and is estimated to take 5 hours") and the in-game notice board
 *    (wish periods, server time marked per time). These win over the wiki.
 * 2. genshin-impact.fandom.com (CC BY-SA): wish pages ({{Wish}} + {{Wish Pool}}), event pages
 *    ({{Event}}, rewards), Imaginarium Theater seasons and Spiral Abyss periods.
 * Nothing is guessed: no start or no end = left out, unknown rewards stay null.
 */
import { at, momentsIn, noticeText, serverMark, slug, type VersionTimes } from '../schedule/text.ts';
import { infobox, mainBox, poolBox, rewardTotal, wikiServer, wikiTime, type WikiPage } from '../schedule/wiki.ts';

export const CURRENCY = 'primogem';
export const WIKI = 'genshin-impact.fandom.com (CC BY-SA)';

const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };

/** "Luna IV" → "6.3" (Luna I–VIII = 6.0–6.7); "7.1" → "7.1". */
export function versionNumber(name: string): string | undefined {
  const t = name.replace(/["“”]/g, '').trim();
  const luna = /^Luna\s+([IVX]+)$/i.exec(t)?.[1];
  if (luna) {
    const n = ROMAN[luna.toUpperCase()];
    return n ? `6.${n - 1}` : undefined;
  }
  return /^\d+\.\d+$/.test(t) ? t : undefined;
}

/** The version a notice title is about: 'Version 7.1 …' or 'Version "Luna VIII" …'. */
export function versionOfTitle(title: string): string | undefined {
  const m = /Version\s+(?:"?(Luna\s+[IVX]+)"?|(\d+\.\d+))/i.exec(title);
  return m ? versionNumber(m[1] ?? m[2] ?? '') : undefined;
}

/** True when `next` is the version right after `id` (7.0 → 7.1, 5.8 → 6.0): a missing version in between leaves no end. */
export function followedBy(id: string, next: string): boolean {
  const [a = 0, b = 0] = id.split('.').map(Number);
  const [c = 0, d = 0] = next.split('.').map(Number);
  return (c === a && d === b + 1) || (c === a + 1 && d === 0);
}

/** "Update maintenance begins 2026/09/23 06:00 (UTC+8) and is estimated to take 5 hours." */
export function versionFromGenshinNotice(id: string, text: string): VersionTimes | undefined {
  const start = /maintenance (?:begins|on)\s*(?:on\s*)?(\d{4}\/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2})\s*\(UTC\+8\)/i.exec(text)?.[1];
  if (!start) return undefined;
  const hours = Number(/estimated to take (\d+) hours?/i.exec(text)?.[1] ?? 5);
  const s = at(start, 8);
  return { id, start: s, open: new Date(Date.parse(s) + hours * 3_600_000).toISOString() };
}

export interface Notes {
  notes: string[];
}

export interface BannerItem {
  id: string;
  type: string;
  title: string;
  featured: string[];
  start: string;
  end: string;
  serverTime?: { base: number; start?: boolean; end?: boolean };
  permanent?: boolean;
}

/**
 * The banner type from a {{Wish}} box. Guard: a weapon pool ({{Wish Pool}} weapon_5_F without
 * character_5_F) is a weapon banner even when the page repeats `type` (Epitome Invocation/2026-10-13).
 */
export function wishType(box: Record<string, string>, pool: Record<string, string>, text: string): string | undefined {
  const type = (box.type ?? '').toLowerCase();
  const weaponPool = Boolean(pool.weapon_5_f) && !pool.character_5_f;
  if (weaponPool || /is an? \[\[Weapon Event Wish/i.test(text)) return 'weapon';
  if (/character event-2/i.test(box.type2 ?? '')) return 'character-2';
  if (type.startsWith('character event')) return 'character';
  if (type.startsWith('weapon event')) return 'weapon';
  if (type.startsWith('chronicled')) return 'chronicled';
  if (type.startsWith('standard')) return 'standard';
  if (type.startsWith('novice') || type.startsWith('beginner')) return 'beginner';
  return undefined;
}

/**
 * One wish page → a banner. Featured: the pool's rate-up 5★ then 4★ (characters, or weapons on a
 * weapon banner), as ids from our lists; Chronicled pools state no rate-up, so their featured is empty.
 * `idOf` maps a name to an id (characters and weapons); `official` wins for the period.
 */
export function wishBanner(
  page: WikiPage,
  idOf: (name: string) => string | undefined,
  out: Notes,
  official?: { start: string; end: string; startServer: boolean; endServer: boolean },
): BannerItem | undefined {
  const box = mainBox(page.text);
  const pool = poolBox(page.text);
  const title = cleanName(box.name || page.title.replace(/\/.*$/, ''));
  const type = wishType(box, pool, page.text);
  if (!type) {
    out.notes.push(`wish "${page.title}" left out: type "${box.type ?? ''}" unknown`);
    return undefined;
  }
  const permanent = /^none$/i.test(box.time_end ?? '') || box.duration === 'perm' || box.duration === 'beginner';
  // The official period is for the run on now: it only replaces this page's times when they are about the
  // same run (starts within a day; the weapon wish has the same name every phase).
  const wikiStart = wikiTime(box, 'start');
  if (official && wikiStart && Math.abs(Date.parse(official.start) - Date.parse(wikiStart)) > 86_400_000) official = undefined;
  const start = official?.start ?? wikiStart;
  const end = official?.end ?? wikiTime(box, 'end');
  if (!start || (!end && !permanent)) {
    out.notes.push(`wish "${page.title}" left out: no ${start ? 'end' : 'start'} yet`);
    return undefined;
  }
  const names = (field: string) =>
    (pool[field] ?? '')
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
  const wanted = type === 'weapon' ? [...names('weapon_5_f'), ...names('weapon_4_f')] : type === 'chronicled' || permanent ? [] : [...names('character_5_f'), ...names('character_4_f')];
  const featured: string[] = [];
  for (const n of wanted) {
    const id = idOf(n);
    if (id) featured.push(id);
    else out.notes.push(`wish "${page.title}": "${n}" not in our lists, not shown as featured`);
  }
  const startServer = official ? official.startServer : wikiServer(box, 'start');
  const endServer = official ? official.endServer : wikiServer(box, 'end');
  return {
    id: `${slug(title)}-${start.slice(0, 10)}`,
    type,
    title,
    featured,
    start,
    // A permanent wish has no end of its own; `end` only says how far it is announced (filled by the caller).
    end: end ?? '',
    ...serverMark(startServer, Boolean(end) && endServer),
    ...(permanent ? { permanent: true } : {}),
  };
}

/** Event Wish periods from the in-game notice board: notice title 'Event Wish "Name"' → its first two times. */
export function officialWishTimes(notices: { title: string; html: string }[], versions: Map<string, VersionTimes>) {
  const out = new Map<string, { start: string; end: string; startServer: boolean; endServer: boolean }>();
  for (const n of notices) {
    const name = /Event Wish\s+"([^"]+)"/i.exec(n.title)?.[1];
    if (!name) continue;
    const text = noticeText(n.html);
    const after = text.slice(Math.max(0, text.search(/Duration/i)));
    const [a, b] = momentsIn(after, versions);
    if (a && b) out.set(name.toLowerCase(), { start: a.at, end: b.at, startServer: a.server, endServer: b.server });
  }
  return out;
}

export interface EventItem {
  id: string;
  title: string;
  kind: 'event' | 'login' | 'web' | 'endgame' | 'bonus';
  start: string;
  end: string;
  reward: number | null;
  currency: string;
  serverTime?: { base: number; start?: boolean; end?: boolean };
}

/** A wiki name without the page's date suffix ("Overflowing Favor 2026-10-26" → "Overflowing Favor"). */
export const cleanName = (s: string) => s.replace(/[\s/]+\d{4}-\d{2}-\d{2}$/, '').trim();

/**
 * Primogems an event gives: the page's stated total or reward cards (rewardTotal); pages that only
 * write {{Item|Primogem|x=60}} add those up; a page that names Primogems without a readable amount
 * is unknown (null), never 0.
 */
export function primogems(text: string): number | null {
  const n = rewardTotal(text, 'Primogem');
  if (n !== null && n > 0) return n;
  // rewardTotal reads {{Item|Primogem|x=60}} as "named without an amount": add the x= amounts first.
  let items = 0;
  for (const m of text.matchAll(/\{\{Item\s*\|\s*Primogem\s*\|[^}]*?\bx\s*=\s*([\d,]+)/gi)) items += Number((m[1] ?? '0').replace(/,/g, ''));
  if (items > 0) return items;
  return /Primogem/i.test(text) ? null : 0;
}

/** The app's kind from an {{Event}} box: Login group = login, Web type = web, Stygian Onslaught = endgame, Overflowing = bonus. */
export function eventKind(box: Record<string, string>, title: string): EventItem['kind'] {
  const groups = [box.group, box.group2, box.group3].map((g) => (g ?? '').toLowerCase());
  if (/^stygian onslaught/i.test(title) || groups.includes('stygian onslaught')) return 'endgame';
  if (/^overflowing (favor|abundance|mastery|bounty)/i.test(title)) return 'bonus';
  if (groups.includes('login')) return 'login';
  if (/^web/i.test(box.type ?? '')) return 'web';
  if (groups.some((g) => /double|drop|bonus/.test(g))) return 'bonus';
  return 'event';
}

/** One event page → an event; Primogems from the page's stated total or its reward cards. */
export function eventFrom(page: WikiPage, out: Notes): EventItem | undefined {
  const box = mainBox(page.text);
  const title = cleanName(box.name || page.title);
  const start = wikiTime(box, 'start');
  const end = wikiTime(box, 'end');
  if (!start || !end) {
    out.notes.push(`event "${page.title}" left out: no ${start ? 'end' : 'start'} yet`);
    return undefined;
  }
  if (Date.parse(end) <= Date.parse(start)) {
    out.notes.push(`event "${page.title}" left out: end not after start`);
    return undefined;
  }
  return {
    id: `${slug(title)}-${start.slice(0, 10)}`,
    title,
    kind: eventKind(box, page.title),
    start,
    end,
    reward: primogems(page.text),
    currency: CURRENCY,
    ...serverMark(wikiServer(box, 'start'), wikiServer(box, 'end')),
  };
}

/**
 * Imaginarium Theater seasons: {{Imaginarium Theater Season |start = 2026-10-01 04:00:00 |end = …}}
 * (server time). The wiki states no Primogem total for a season, so the reward stays unknown.
 */
export function theaterSeason(page: WikiPage, out: Notes): EventItem | undefined {
  const i = page.text.search(/\{\{Imaginarium Theater Season/i);
  const box = i >= 0 ? infobox(page.text.slice(i)) : {};
  if (!/^\d{4}-\d{2}-\d{2} \d/.test(box.start ?? '') || !/^\d{4}-\d{2}-\d{2} \d/.test(box.end ?? '')) {
    out.notes.push(`Imaginarium Theater "${page.title}" left out: no start or end time`);
    return undefined;
  }
  const start = at(box.start as string, 8);
  const end = at(box.end as string, 8);
  return { id: `imaginarium-theater-${start.slice(0, 10)}`, title: `Imaginarium Theater${box.season ? ` (season ${box.season})` : ''}`, kind: 'endgame', start, end, reward: null, currency: CURRENCY, ...serverMark(true, true) };
}

/**
 * Spiral Abyss periods: {{Abyssal Moon Spire |start = 2026-09-16 |end = 2026-10-15}} gives dates only.
 * The spire resets on the 16th at the daily reset, 04:00 server time ("Daily Reset" on the wiki; the
 * Spiral Abyss page: "reset once a month, on the 16th"), so a period runs from its start day 04:00 to
 * the day after its end day 04:00. Reward from the Spiral Abyss page when it states one (else unknown).
 */
export function abyssPeriod(page: WikiPage, reward: number | null, out: Notes): EventItem | undefined {
  const i = page.text.search(/\{\{Abyssal Moon Spire/i);
  const box = i >= 0 ? infobox(page.text.slice(i)) : {};
  const s = /^(\d{4}-\d{2}-\d{2})$/.exec(box.start ?? '')?.[1];
  const e = /^(\d{4}-\d{2}-\d{2})$/.exec(box.end ?? '')?.[1];
  if (!s || !e) {
    out.notes.push(`Spiral Abyss "${page.title}" left out: no start or end date`);
    return undefined;
  }
  const start = at(`${s} 04:00`, 8);
  const end = new Date(Date.parse(at(`${e} 04:00`, 8)) + 86_400_000 - 1000).toISOString();
  return { id: `spiral-abyss-${s}`, title: 'Spiral Abyss', kind: 'endgame', start, end, reward, currency: CURRENCY, ...serverMark(true, true) };
}
