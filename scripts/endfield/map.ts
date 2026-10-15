/**
 * Arknights: Endfield lists from endfield.wiki.gg's Cargo tables (CC BY-SA, credited) and
 * the official news list. Pure: rows in, list items out (tests/endfieldImport.test.ts).
 * The fetching is in scripts/import-endfield.ts.
 *
 * The wiki stores Cargo times in UTC, one pair per server: Asia (UTC+8) and Americas /
 * Europe (UTC-5). Our lists keep the Asia time; when the two servers differ the time is
 * "server time" (the same clock time on each server) and `serverTime` says so, like HSR/ZZZ.
 */

export type Row = Record<string, string>;

export const ASIA_OFFSET = 8;
/** Where every entry comes from, as the lists show it. */
export const WIKI = 'endfield.wiki.gg (CC BY-SA)';
export const CURRENCY = 'oroberyl';

/** A Cargo time ("2026-10-15 04:00:00", UTC) as ISO, or undefined when empty. */
export function utc(s: string | undefined): string | undefined {
  if (!s?.trim()) return undefined;
  const t = Date.parse(`${s.trim().replace(' ', 'T')}Z`);
  return Number.isFinite(t) ? new Date(t).toISOString() : undefined;
}

export const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Which of start and end follow each server's own clock (the two servers differ there). */
export function serverTime(r: Row): { base: number; start?: boolean; end?: boolean } | undefined {
  const start = Boolean(r.AmeuStartTime && r.AsiaStartTime !== r.AmeuStartTime);
  const end = Boolean(r.AmeuEndTime && r.AsiaEndTime !== r.AmeuEndTime);
  if (!start && !end) return undefined;
  return { base: ASIA_OFFSET, ...(start ? { start } : {}), ...(end ? { end } : {}) };
}

export type Rarity = 'top' | 'mid' | 'low';
/** 6★ top, 5★ mid, 4★ low (the contract's third tier; `lowTier` false leaves 4★ out). */
export function rarityOf(stars: string, lowTier: boolean): Rarity | undefined {
  if (stars === '6') return 'top';
  if (stars === '5') return 'mid';
  if (stars === '4' && lowTier) return 'low';
  return undefined;
}

export interface Notes {
  notes: string[];
}

export interface Operator {
  id: string;
  /** The wiki's game id (chr_00xx_…), kept when `id` differs (keepIds). */
  gameId?: string;
  name: string;
  rarity: Rarity;
  element: string;
  role: string;
  releasedAt?: string;
  art?: string;
  portrait?: string;
  source: string;
}

/**
 * Operators. Release date: the first banner that features them (rate-up, limited list or
 * quota), as the wiki's own release-date field is empty everywhere. No banner = no date.
 */
export function operators(rows: Row[], banners: Row[], images: Map<string, string>, lowTier: boolean, out: Notes, launch?: string): Operator[] {
  const count = new Map<string, number>();
  for (const r of rows) count.set(r.Operator?.trim() ?? '', (count.get(r.Operator?.trim() ?? '') ?? 0) + 1);
  const firstSeen = new Map<string, string>();
  for (const b of [...banners].sort((a, b2) => (a.AsiaStartTime ?? '').localeCompare(b2.AsiaStartTime ?? ''))) {
    const start = utc(b.AsiaStartTime);
    if (!start) continue;
    const names = [b.RateUpOperator, b.QuotaOperator, ...(b.LimitedOperators ?? '').split(';')].map((n) => n?.trim()).filter(Boolean) as string[];
    for (const n of names) if (!firstSeen.has(n)) firstSeen.set(n, start);
  }
  const list: Operator[] = [];
  for (const r of rows) {
    const base = r.Operator?.trim();
    if (!base) continue;
    // One name on several rows (the Endministrator, male and female): told apart by the wiki's own file name.
    const variant = (count.get(base) ?? 0) > 1 ? /\(([^)]+)\)/.exec(r.Icon ?? '')?.[1] : undefined;
    const name = variant ? `${base} (${variant})` : base;
    const rarity = rarityOf(r.Rarity ?? '', lowTier);
    if (!rarity) {
      out.notes.push(`operator "${name}" left out: ${r.Rarity}★ has no rarity tier in the contract yet`);
      continue;
    }
    if (!r.Element || !r.Class) {
      out.notes.push(`operator "${name}" left out: no element or class on the wiki`);
      continue;
    }
    // The player character (no headhunting at all) is there from the game's launch.
    const released = firstSeen.get(base) ?? (!r.Headhunting?.trim() && /^endministrator$/i.test(base) ? launch : undefined);
    const art = images.get(r.Splash ?? '');
    const portrait = images.get(r.Icon ?? '');
    list.push({
      // An upcoming operator has no game id on the wiki yet: one from the name (kept for good by keepIds).
      id: r.Id?.trim() || `chr_${slug(name)}`,
      ...(r.Id?.trim() ? { gameId: r.Id.trim() } : {}),
      name,
      rarity,
      element: slug(r.Element),
      role: slug(r.Class),
      ...(released ? { releasedAt: released } : {}),
      ...(art ? { art } : {}),
      ...(portrait ? { portrait } : {}),
      source: WIKI,
    });
    if (!released) out.notes.push(`operator "${name}": no release date (on no banner, no source states one)`);
  }
  return list.sort((a, b) => a.id.localeCompare(b.id));
}

export interface WeaponItem {
  id: string;
  name: string;
  rarity: Rarity;
  icon?: string;
  /** Weapon type (sword, great-sword, polearm, handcannon, arts-unit). */
  type: string;
  source: string;
}

export function weapons(rows: Row[], images: Map<string, string>, out: Notes): WeaponItem[] {
  const list: WeaponItem[] = [];
  for (const r of rows) {
    const name = r.Weapon?.trim();
    if (!name || !r.Id) continue;
    // Weapons already have three tiers in the app: 6★ top, 5★ mid, 4★ low.
    const rarity = rarityOf(r.Rarity ?? '', true);
    if (!rarity) {
      out.notes.push(`weapon "${name}" left out: ${r.Rarity}★ has no rarity tier`);
      continue;
    }
    const icon = images.get(r.Icon ?? '');
    list.push({ id: r.Id, name, rarity, ...(icon ? { icon } : {}), type: slug(r.Type ?? ''), source: WIKI });
  }
  return list.sort((a, b) => a.id.localeCompare(b.id));
}

export interface BannerItem {
  id: string;
  type: string;
  title: string;
  featured: string[];
  start: string;
  end: string;
  serverTime?: { base: number; start?: boolean; end?: boolean };
  art?: string;
  permanent?: boolean;
  /** Chartered: the other limited operators on the banner's list (a lost 50/50 can give them). */
  alsoAvailable?: string[];
}

/**
 * The banner type. The wiki has no type field, so it follows the rules the game uses:
 * a rate-up operator = Chartered; "New Horizons" = beginner; "Basic" = standard; one
 * returning limited operator = rerun (RE-Factor); several without a rate-up = joint (Fest).
 */
export function bannerType(r: Row): string {
  const title = r.Banner ?? '';
  if (/new horizons/i.test(title)) return 'beginner';
  if (/^basic/i.test(title)) return 'basic';
  if (r.RateUpOperator?.trim()) return 'chartered';
  const limited = (r.LimitedOperators ?? '').split(';').filter((s) => s.trim());
  return limited.length === 1 ? 'rerun' : 'joint';
}

/**
 * Operator banners and weapon banners (Arsenal Issues). A banner with no end on the wiki
 * (Basic, New Horizons) is permanent; its `end` then only says how long it is announced:
 * the end of the current version.
 */
export function banners(
  opRows: Row[],
  issueRows: Row[],
  ops: Operator[],
  wpns: WeaponItem[],
  versionEnd: string | undefined,
  out: Notes,
  official: Map<string, OfficialTimes> = new Map(),
  /** The end of the version running at a time (for "before version update and maintenance"). */
  versionEndAt: (iso: string) => string | undefined = () => versionEnd,
): BannerItem[] {
  const opId = new Map(ops.map((o) => [o.name, o.id]));
  const wpn = new Map(wpns.map((w) => [w.name, w]));
  const list: BannerItem[] = [];
  const add = (r: Row, title: string, type: string, featured: string[], art?: string, permanentFlag = false, also: string[] = []) => {
    let start = utc(r.AsiaStartTime);
    let end = utc(r.AsiaEndTime);
    let st = serverTime(r);
    // The official notice's own period wins over the wiki's copy.
    const o = official.get(title.toLowerCase());
    if (o) {
      const flags = { start: Boolean(st?.start), end: Boolean(st?.end) };
      if (o.start && 'at' in o.start) [start, flags.start] = [o.start.at, true];
      else if (o.start) flags.start = false;
      if (o.end && 'at' in o.end) [end, flags.end] = [o.end.at, true];
      else if (o.end && start) [end, flags.end] = [versionEndAt(start) ?? end, false];
      st = flags.start || flags.end ? { base: ASIA_OFFSET, ...(flags.start ? { start: true } : {}), ...(flags.end ? { end: true } : {}) } : undefined;
      if (o.end && !('at' in o.end)) out.notes.push(`banner "${title}": ends "before version update" (official); shown with the version's end`);
    }
    if (!start) return out.notes.push(`banner "${title}" left out: no start yet`);
    const permanent = permanentFlag || !end;
    const shownEnd = end ?? versionEnd;
    if (!shownEnd) return out.notes.push(`banner "${title}" left out: no end and no current version end`);
    list.push({
      id: `${slug(title)}-${start.slice(0, 10)}`,
      type,
      title,
      featured,
      start,
      end: shownEnd,
      ...(st ? { serverTime: st } : {}),
      ...(art ? { art } : {}),
      ...(permanent ? { permanent } : {}),
      ...(also.length ? { alsoAvailable: also } : {}),
    });
  };
  for (const r of opRows) {
    const title = r.Banner?.trim();
    if (!title) continue;
    const type = bannerType(r);
    // Chartered: its rate-up operator; the others: the operators the banner lists (Basic and New Horizons: their 6★ pool).
    const names = type === 'chartered' ? [r.RateUpOperator] : (r.LimitedOperators ?? '').split(';');
    const featured = names.map((n) => opId.get((n ?? '').trim())).filter((x): x is string => Boolean(x));
    const missing = names.map((n) => (n ?? '').trim()).filter((n) => n && !opId.has(n));
    if (missing.length) out.notes.push(`banner "${title}": ${missing.join(', ')} not in the operator list yet (no wiki entry), so not shown as featured`);
    // A character banner leads with a known operator; without one it waits until the wiki has them.
    if (!featured.length) {
      out.notes.push(`banner "${title}" left out until its operator is on the wiki`);
      continue;
    }
    // Chartered: the banner list's other limited operators (the previous two Chartered ones), from the wiki, never guessed.
    const also =
      type === 'chartered'
        ? (r.LimitedOperators ?? '')
            .split(';')
            .map((n) => n.trim())
            .filter((n) => n && n !== r.RateUpOperator?.trim())
            .map((n) => opId.get(n))
            .filter((x): x is string => Boolean(x))
        : [];
    add(r, title, type, featured, undefined, false, also);
  }
  for (const r of issueRows) {
    const title = r.Issue?.trim();
    if (!title) continue;
    const w = wpn.get(r.RateUpWeapon?.trim() ?? '');
    if (r.RateUpWeapon?.trim() && !w) out.notes.push(`weapon banner "${title} Issue": ${r.RateUpWeapon.trim()} not in the weapon list yet, so not shown as featured`);
    add(r, `${title} Issue`, 'weapon', w ? [w.id] : [], w?.icon, r.IsPermanent === '1');
  }
  return list.sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
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

/** The app's event kind for the wiki's event type. Contingency Contract seasons are the endgame. */
export function eventKind(r: Row): EventItem['kind'] | undefined {
  const type = (r.Type ?? '').toLowerCase();
  const page = r.Page ?? r.Event ?? '';
  if (/^contingency contract/i.test(page)) return 'endgame';
  if (type === 'sign-in') return 'login';
  if (['guide', 'camera', 'sharing'].includes(type)) return 'web';
  if (['special sanity gift', 'supply', 'giveaway', 'mail', 'tribute', 'return'].includes(type)) return 'bonus';
  if (type === 'permanent') return undefined;
  return 'event';
}

/** Events with both ends known. Rewards are prose on the wiki and in the notices: null until a source states a number. */
export function events(rows: Row[], out: Notes, rewards: Map<string, number> = new Map()): EventItem[] {
  const list: EventItem[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const title = (r.Event ?? r.Page ?? '').trim();
    if (!title) continue;
    const kind = eventKind(r);
    if (!kind) continue;
    const start = utc(r.AsiaStartTime);
    const end = utc(r.AsiaEndTime);
    if (!start || !end) {
      out.notes.push(`event "${title}" left out: no ${start ? 'end' : 'start'} yet`);
      continue;
    }
    if (Date.parse(end) <= Date.parse(start)) {
      out.notes.push(`event "${title}" left out: the wiki's end (${end}) is not after its start (${start})`);
      continue;
    }
    const id = `${slug(title)}-${start.slice(0, 10)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const st = serverTime(r);
    list.push({ id, title, kind, start, end, reward: rewards.get(slug(title)) ?? null, currency: CURRENCY, ...(st ? { serverTime: st } : {}) });
  }
  return list.sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
}

export interface VersionItem {
  id: string;
  name: string;
  start: string;
  end: string;
}

export interface NewsItem {
  title: string;
  displayTime: number;
}

/**
 * Versions from the wiki, each checked against the official news list: a version whose name
 * has no official "[Name] Version Update Notes" (or 1.0's release notice) gets a note, not a guess.
 * A version without an end yet ends where the next one starts; the last one needs a stated end.
 */
export function versions(rows: Row[], news: NewsItem[], out: Notes): VersionItem[] {
  const sorted = rows.filter((r) => r.VersionNumber && utc(r.StartTime)).sort((a, b) => (a.StartTime ?? '').localeCompare(b.StartTime ?? ''));
  const list: VersionItem[] = [];
  sorted.forEach((r, i) => {
    const start = utc(r.StartTime) as string;
    const end = utc(r.EndTime) ?? utc(sorted[i + 1]?.StartTime);
    const name = (r.Version ?? '').trim();
    if (!end) return out.notes.push(`version ${r.VersionNumber} "${name}" left out: no end yet`);
    const official = news.some((n) => n.title.toLowerCase().includes(`[${name.toLowerCase()}]`) && /version update notes|update notes/i.test(n.title));
    if (!official && i > 0) out.notes.push(`version ${r.VersionNumber} "${name}": no official update notes found in the news list (wiki only)`);
    list.push({ id: r.VersionNumber as string, name, start, end });
  });
  return list;
}

export interface NewsPost extends NewsItem {
  cid?: string;
}

/**
 * When Endfield's notices come out, in hours from each version's start (for the check rhythm,
 * scripts/schedule/rhythm.ts): `preDownload` = the "Version Pre-Download & Update Notice"
 * (earlier versions: "Version Update & Maintenance Preview"), `program` = the "New Version
 * Guide Page" post. The notices name the version, not its number.
 */
export function rhythmFrom(news: NewsItem[], list: VersionItem[]): Partial<Record<'program' | 'preDownload', Record<string, number>>> {
  const out: Partial<Record<'program' | 'preDownload', Record<string, number>>> = {};
  const kinds: ['program' | 'preDownload', RegExp][] = [
    ['program', /New Version Guide Page|Special (Program|Broadcast)|Livestream/i],
    ['preDownload', /Pre-Download & Update Notice|Update & Maintenance Preview/i],
  ];
  for (const n of [...news].sort((a, b) => a.displayTime - b.displayTime)) {
    const kind = kinds.find(([, re]) => re.test(n.title))?.[0];
    const name = /^\[([^\]]+)\]/.exec(n.title)?.[1]?.toLowerCase();
    const v = name ? list.find((x) => x.name.toLowerCase() === name) : undefined;
    if (!kind || !v) continue;
    const hours = Math.round(((n.displayTime * 1000 - Date.parse(v.start)) / 3_600_000) * 10) / 10;
    if (hours > 0 || hours < -24 * 30) continue;
    (out[kind] ??= {})[v.id] ??= hours;
  }
  return out;
}

// ── Official notices: times and new 6★ weapons the wiki doesn't have yet ──────────

const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };

/** "Nov. 5, 2026 at 12:00" in server time, as the Asia server's instant (UTC+8). */
export function serverDate(s: string): string | undefined {
  const m = /([A-Za-z]{3,5})\.?\s+(\d{1,2}),\s*(\d{4})\s+at\s+(\d{1,2}):(\d{2})/.exec(s);
  const month = m ? MONTHS[(m[1] ?? '').toLowerCase()] : undefined;
  if (!m || month === undefined) return undefined;
  return new Date(Date.UTC(Number(m[3]), month, Number(m[2]), Number(m[4]) - ASIA_OFFSET, Number(m[5]))).toISOString();
}

/** One end of a banner's official period: a server-time instant, or tied to the version update. */
export type OfficialEnd = { at: string; server: true } | { version: true };
export interface OfficialTimes {
  start?: OfficialEnd;
  end?: OfficialEnd;
}

function officialEnd(s: string): OfficialEnd | undefined {
  if (/version update/i.test(s)) return { version: true };
  const at = serverDate(s);
  return at ? { at, server: true } : undefined;
}

/**
 * Banner periods from official notice text: the "Availability:" line under a "[Title] … Headhunting"
 * or "[Title] … Issue" heading (or in a post whose own title names it). "After … version update" /
 * "Before version update and maintenance" tie a side to the patch; dates are server time.
 * "ends after 3 [Chartered Headhunting] banners" gives no end.
 */
export function officialTimes(posts: { title: string; text: string }[]): Map<string, OfficialTimes> {
  const out = new Map<string, OfficialTimes>();
  for (const p of posts) {
    let current = /^\[([^\]]+)\]\s.*(Headhunting|Issue)/i.exec(p.title)?.[1];
    for (const raw of p.text.split('\n')) {
      const line = raw.trim();
      const heading = /^(?:\d+\.\s*)?\[([^\]]+)\][^:]*(Headhunting|Issue)\b/i.exec(line);
      if (heading?.[1]) current = heading[1];
      const avail = /Availability:\s*(.+)$/i.exec(line)?.[1];
      if (!current || !avail) continue;
      const [a, b] = avail.split(/\s+[–-]\s+|;\s*ends\s+/);
      const t: OfficialTimes = {};
      const start = a ? (/^opens?\s+/i.test(a) ? officialEnd(a.replace(/^opens?\s+/i, '')) : officialEnd(a)) : undefined;
      const end = b && !/after \d+ \[/i.test(b) ? officialEnd(b) : undefined;
      if (start) t.start = start;
      if (end) t.end = end;
      if ((t.start || t.end) && !out.has(current.toLowerCase())) out.set(current.toLowerCase(), t);
    }
  }
  return out;
}

/**
 * Oroberyl each event gives, from the official update notes: every "[Oroberyl]×N" in an event's
 * block ("3. [All the Inky Hues] Guide Event", "○[Season of Phantasia]"), keyed by the event's slug.
 * A block can name its limited event inside ("the [Monumental Etching: Forest of Maras] limited-time
 * event will begin"); that name gets the amount too. The notes say "rewards including", so this is
 * what Gryphline states, never more. Events the notes give no amount for are left out (reward stays null).
 */
export function officialRewards(posts: { title: string; text: string }[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of posts) {
    if (!/Update Notes/i.test(p.title)) continue;
    let names: string[] = [];
    let total = 0;
    const flush = () => {
      if (total > 0) for (const n of names) if (!out.has(slug(n))) out.set(slug(n), total);
      names = [];
      total = 0;
    };
    for (const raw of p.text.split('\n')) {
      const line = raw.trim();
      if (/^■/.test(line)) flush();
      const head = /^(?:\d+\.|○)\s*[^[]*\[([^\]]+)\]/.exec(line)?.[1];
      if (head) {
        flush();
        names.push(head);
      }
      for (const m of line.matchAll(/\[([^\]]+)\]\s*limited-time event/gi)) if (m[1]) names.push(m[1]);
      for (const m of line.matchAll(/\[Oroberyls?\]\s*[×x]\s*([\d,]+)/gi)) total += Number((m[1] ?? '').replace(/,/g, ''));
    }
    flush();
  }
  return out;
}

/** 6★ weapons the official notes name, e.g. "[Lunar Calling (Sword)]": name and type. */
export function officialWeapons(texts: string[]): { name: string; type: string }[] {
  const seen = new Map<string, string>();
  for (const t of texts)
    for (const line of t.split('\n')) {
      if (!/6★ weapons?\b/i.test(line)) continue;
      for (const m of line.matchAll(/\[([^\]()]+?)\s*\((Sword|Greatsword|Great Sword|Polearm|Handcannon|Arts Unit)\)\]/gi)) {
        const name = (m[1] ?? '').trim();
        if (name && !seen.has(name)) seen.set(name, slug((m[2] ?? '').replace(/^greatsword$/i, 'great sword')));
      }
    }
  return [...seen].map(([name, type]) => ({ name, type }));
}

/**
 * Ids never change: an item keeps the id it was first listed with (matched by name), even
 * when the wiki later gives it a game id. New items without a wiki id get one from their name.
 */
export function keepIds<T extends { id: string; name: string; gameId?: string }>(items: T[], previous: { id: string; name: string }[]): T[] {
  const byName = new Map(previous.map((p) => [p.name, p.id]));
  return items.map((x) => {
    const id = byName.get(x.name) ?? x.id;
    // The game's own id stays on the item only when it differs from ours (pull history matches on it).
    const { gameId, ...rest } = x;
    return { ...rest, id, ...(gameId && gameId !== id ? { gameId } : {}) } as T;
  });
}
