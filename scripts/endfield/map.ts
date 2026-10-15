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
/** 6★ top, 5★ mid, and 4★ low only when the game contract has a third tier (`lowTier`). */
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
    if (!base || !r.Id) continue;
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
      id: r.Id,
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
}

/**
 * The banner type. The wiki has no type field, so it follows the rules the game uses:
 * a rate-up operator = Chartered; "New Horizons" = beginner; "Basic" = standard; one
 * returning limited operator = rerun (RE-Factor); several without a rate-up = special.
 */
export function bannerType(r: Row): string {
  const title = r.Banner ?? '';
  if (/new horizons/i.test(title)) return 'beginner';
  if (/^basic/i.test(title)) return 'basic';
  if (r.RateUpOperator?.trim()) return 'chartered';
  const limited = (r.LimitedOperators ?? '').split(';').filter((s) => s.trim());
  return limited.length === 1 ? 'rerun' : 'special';
}

/**
 * Operator banners and weapon banners (Arsenal Issues). A banner with no end on the wiki
 * (Basic, New Horizons) is permanent; its `end` then only says how long it is announced:
 * the end of the current version.
 */
export function banners(opRows: Row[], issueRows: Row[], ops: Operator[], wpns: WeaponItem[], versionEnd: string | undefined, out: Notes): BannerItem[] {
  const opId = new Map(ops.map((o) => [o.name, o.id]));
  const wpn = new Map(wpns.map((w) => [w.name, w]));
  const list: BannerItem[] = [];
  const add = (r: Row, title: string, type: string, featured: string[], art?: string, permanentFlag = false) => {
    const start = utc(r.AsiaStartTime);
    const end = utc(r.AsiaEndTime);
    if (!start) return out.notes.push(`banner "${title}" left out: no start yet`);
    const permanent = permanentFlag || !end;
    const shownEnd = end ?? versionEnd;
    if (!shownEnd) return out.notes.push(`banner "${title}" left out: no end and no current version end`);
    const st = serverTime(r);
    list.push({ id: `${slug(title)}-${start.slice(0, 10)}`, type, title, featured, start, end: shownEnd, ...(st ? { serverTime: st } : {}), ...(art ? { art } : {}), ...(permanent ? { permanent } : {}) });
  };
  for (const r of opRows) {
    const title = r.Banner?.trim();
    if (!title) continue;
    const type = bannerType(r);
    const names = type === 'chartered' ? [r.RateUpOperator] : type === 'rerun' || type === 'special' ? (r.LimitedOperators ?? '').split(';') : [];
    const featured = names.map((n) => opId.get((n ?? '').trim())).filter((x): x is string => Boolean(x));
    const missing = names.map((n) => (n ?? '').trim()).filter((n) => n && !opId.has(n));
    if (missing.length) out.notes.push(`banner "${title}": ${missing.join(', ')} not in the operator list yet (no wiki entry), so not shown as featured`);
    add(r, title, type, featured);
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
export function events(rows: Row[], out: Notes): EventItem[] {
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
    const id = `${slug(title)}-${start.slice(0, 10)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const st = serverTime(r);
    list.push({ id, title, kind, start, end, reward: null, currency: CURRENCY, ...(st ? { serverTime: st } : {}) });
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
