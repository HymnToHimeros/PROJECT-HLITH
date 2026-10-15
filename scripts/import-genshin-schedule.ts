/**
 * Genshin Impact versions, wishes, events and endgame periods (`npm run data:genshin-schedule`),
 * into src/games/genshin/data. Rules and sources: scripts/genshin/schedule.ts. Run after
 * `npm run data:nanoka` (wishes name characters and weapons from those lists).
 *
 * Official first: version starts from the news list's update notices, the current version's end
 * from the in-game notice board, current Event Wish periods from their in-game notices. The wiki
 * fills the rest. Existing entries are never deleted (ids that progress points at keep working).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { abyssPeriod, cleanName, eventFrom, followedBy, officialWishTimes, theaterSeason, versionFromGenshinNotice, versionOfTitle, wishBanner, type BannerItem, type EventItem, type Notes } from './genshin/schedule.ts';
import { at, noticeText, type VersionTimes } from './schedule/text.ts';
import { fetchWiki, mainBox, wikiPrefix, type WikiPage } from './schedule/wiki.ts';

const ROOT = resolve(import.meta.dirname, '..');
const DATA = resolve(ROOT, 'src/games/genshin/data');
const WIKI = 'genshin-impact.fandom.com';
const SITE = 'https://sg-public-api-static.hoyoverse.com/content_v2_user/app/a1b1f9d3315447cc';
const ANN = 'https://sg-hk4e-api.hoyoverse.com/common/hk4e_global/announcement/api';
const ANN_Q = 'game=hk4e&game_biz=hk4e_global&lang=en&bundle_id=hk4e_global&platform=pc&region=os_usa&level=60&uid=100000000';
const DAY = 86_400_000;
const NOW = Date.now();
const out: Notes = { notes: [] };

async function json<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'user-agent': 'PROJECT-HLITH data import' } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

interface SiteItem {
  iInfoId: number;
  sTitle: string;
  sContent?: string;
  dtStartTime?: string;
}

/** Posts on one official news channel (397 = notices: update details and maintenance previews; 395 = all news). */
async function siteList(channel: number, pages: number): Promise<SiteItem[]> {
  const items: SiteItem[] = [];
  for (let page = 1; page <= pages; page++) {
    const r = await json<{ data: { iTotal: number; list: SiteItem[] } }>(`${SITE}/getContentList?iChanId=${channel}&iPageSize=50&iPage=${page}&sLangKey=en-us&isPreview=0`);
    items.push(...r.data.list);
    if (items.length >= r.data.iTotal || r.data.list.length === 0) break;
  }
  return items;
}

// ── 1. Versions: starts from the official update notices ─────────────────
const notices = await siteList(397, 4);
const versions = new Map<string, VersionTimes>();
for (const it of notices) {
  const id = versionOfTitle(it.sTitle);
  if (!id || versions.has(id) || !/Update (Details|Maintenance Preview)/i.test(it.sTitle)) continue;
  const full = await json<{ data: SiteItem }>(`${SITE}/getContent?iInfoId=${it.iInfoId}&sLangKey=en-us&isPreview=0`);
  const v = versionFromGenshinNotice(id, noticeText(full.data.sContent ?? ''));
  if (v) versions.set(id, v);
  else out.notes.push(`version ${id}: no update time in "${it.sTitle}"`);
}
const sorted = [...versions.values()].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
// A version ends when the next one starts; when a version in between has no readable notice, no end (left out).
sorted.forEach((v, i) => {
  const next = sorted[i + 1];
  if (next && followedBy(v.id, next.id)) v.end = next.start;
  else if (next) out.notes.push(`version ${v.id}: left out (the next version's notice has no update time)`);
});

// The in-game notice board: its "Version x.y Update Details" notice is shown until the next update.
const annList = await json<{ data: { list: { list: { ann_id: number; title: string; subtitle: string; start_time: string; end_time: string }[] }[] } }>(`${ANN}/getAnnList?${ANN_Q}`);
const anns = annList.data.list.flatMap((t) => t.list);
const latest = sorted.at(-1);
if (latest && !latest.end) {
  const notice = anns.find((a) => new RegExp(`Version ${latest.id.replace('.', '\\.')}\\b.*Update Details`, 'i').test(`${a.subtitle} ${a.title}`));
  if (notice?.end_time) latest.end = at(notice.end_time, 8);
  else out.notes.push(`version ${latest.id}: no end yet (the in-game notice board has no update notice for it)`);
}

// When each version's special program and pre-download notice went up (for the check rhythm).
const news = await siteList(395, 4);
const rhythmPath = resolve(ROOT, 'scripts/schedule/rhythm.json');
const rhythm = JSON.parse(readFileSync(rhythmPath, 'utf8')) as Record<string, Record<string, Record<string, number>>>;
const learned = (rhythm.genshin ??= {});
for (const it of news) {
  const kind = /Special Program/i.test(it.sTitle) ? 'program' : /Pre-Download/i.test(it.sTitle) ? 'preDownload' : undefined;
  const id = versionOfTitle(it.sTitle);
  const v = id ? versions.get(id) : undefined;
  if (!kind || !v || !it.dtStartTime) continue;
  const hours = Math.round(((Date.parse(at(it.dtStartTime.replace(/-/g, '/'), 8)) - Date.parse(v.start)) / 3_600_000) * 10) / 10;
  if (hours > 0 || hours < -24 * 30) continue;
  (learned[kind] ??= {})[v.id] ??= hours;
}

const live = sorted.find((v) => Date.parse(v.start) <= NOW && v.end && NOW < Date.parse(v.end)) ?? sorted.at(-1);

// ── 2. Wishes: the current and previous version pages, their banners and those alongside ──
const names = new Map<string, string>();
for (const file of ['characters', 'weapons']) {
  const path = resolve(DATA, `${file}.json`);
  if (!existsSync(path)) continue;
  for (const x of JSON.parse(readFileSync(path, 'utf8')) as { id: string; name: string }[]) names.set(x.name.toLowerCase(), x.id);
}
const idOf = (n: string) => names.get(n.toLowerCase());

const recent = sorted.slice(-2).map((v) => v.id);
const versionPage = (id: string) => (id.startsWith('6.') ? `Version/Luna ${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][Number(id.split('.')[1])]}` : `Version/${id}`);
const vPages = await fetchWiki(WIKI, recent.map(versionPage));
const linksUnder = (text: string, heading: RegExp) => {
  const at0 = text.search(heading);
  if (at0 < 0) return [];
  const rest = text.slice(at0).split('\n').slice(1);
  const block: string[] = [];
  for (const line of rest) {
    if (/^;|^=/.test(line)) break;
    block.push(line);
  }
  return [...block.join('\n').matchAll(/\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]/g)].map((m) => (m[1] ?? '').trim());
};
const wishTitles = new Set<string>(['Wanderlust Invocation', "Beginners' Wish"]);
for (const p of vPages.values()) for (const t of linksUnder(p.text, /^;\s*Event Wishes/m)) if (t.includes('/')) wishTitles.add(t);
let wishPages = await fetchWiki(WIKI, [...wishTitles]);
// Weapon and Chronicled wishes are named in each character wish's `alongside` fields.
const alongside = new Set<string>();
for (const p of wishPages.values()) {
  const box = mainBox(p.text);
  for (const k of ['alongside', 'alongside2', 'alongside3', 'alongside4']) if (box[k]) alongside.add(box[k] as string);
}
const more = [...alongside].filter((t) => !wishTitles.has(t));
wishPages = new Map([...wishPages, ...(await fetchWiki(WIKI, more))]);

const officialWishes = officialWishTimes(
  await Promise.all(
    anns
      .filter((a) => /Event Wish/i.test(a.subtitle))
      .map(async (a) => {
        const c = await json<{ data: { list: { ann_id: number; content: string }[] } }>(`${ANN}/getAnnContent?${ANN_Q}`).catch(() => undefined);
        return { title: a.subtitle, html: c?.data.list.find((x) => x.ann_id === a.ann_id)?.content ?? '' };
      }),
  ),
  versions,
);

const banners: BannerItem[] = [];
const seenPage = new Set<string>();
for (const p of wishPages.values()) {
  if (seenPage.has(p.title)) continue;
  seenPage.add(p.title);
  const name = cleanName(mainBox(p.text).name || p.title.replace(/\/.*$/, '')).toLowerCase();
  const b = wishBanner(p, idOf, out, officialWishes.get(name));
  if (!b) continue;
  // A permanent wish has no end of its own: shown as announced until the current version's end.
  if (b.permanent && !b.end) {
    if (!live?.end) continue;
    b.end = live.end;
  }
  banners.push(b);
}

// ── 3. Events: current and upcoming (the wiki's Event List) plus the version pages' new events ──
const listed = await json<{ expandtemplates?: { wikitext: string } }>(
  `https://${WIKI}/api.php?action=expandtemplates&format=json&prop=wikitext&text=${encodeURIComponent('{{Event List|hidepast=1|h=3}}')}`,
);
const eventTitles = new Set<string>();
for (const m of (listed.expandtemplates?.wikitext ?? '').matchAll(/\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]/g)) {
  const t = (m[1] ?? '').trim();
  if (!/^(File|Category|Template):/i.test(t)) eventTitles.add(t);
}
for (const p of vPages.values()) for (const t of linksUnder(p.text, /^;\s*New Events/m)) eventTitles.add(t);
const eventPages = await fetchWiki(WIKI, [...eventTitles]);
const events: EventItem[] = [];
for (const p of eventPages.values()) {
  const box = mainBox(p.text);
  if (box.time_start === undefined) continue; // not an event page (an item, a character…)
  const e = eventFrom(p, out);
  if (e && Date.parse(e.end) > NOW - 60 * DAY) events.push(e);
}

// ── 4. Endgame: Imaginarium Theater seasons and Spiral Abyss periods (the last three of each) ──
const theaters = (await wikiPrefix(WIKI, 'Imaginarium Theater/Seasons/')).sort().slice(-3);
for (const p of (await fetchWiki(WIKI, theaters)).values()) {
  const e = theaterSeason(p, out);
  if (e) events.push(e);
}
const abyssMain = (await fetchWiki(WIKI, ['Spiral Abyss'])).get('Spiral Abyss');
const abyssReward = Number(/Moment of Syzygy[\s\S]{0,600}?Primogem\s*\*\s*([\d,]+)/i.exec(abyssMain?.text ?? '')?.[1]?.replace(/,/g, '') ?? NaN);
const abysses = (await wikiPrefix(WIKI, 'Spiral Abyss/Floors/')).filter((t) => /\/\d{4}-\d{2}-\d{2}$/.test(t)).sort().slice(-3);
for (const p of (await fetchWiki(WIKI, abysses)).values()) {
  const e = abyssPeriod(p as WikiPage, Number.isFinite(abyssReward) ? abyssReward : null, out);
  if (e) events.push(e);
}

// ── 5. Merge and write (never drop an id) ─────────────────────────────────
function merge<T extends { id: string; start?: string }>(file: string, fresh: T[]): T[] {
  const path = resolve(DATA, file);
  const old = existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T[]) : [];
  const byId = new Map(old.map((x) => [x.id, x]));
  for (const x of fresh) byId.set(x.id, x);
  const list = [...byId.values()].sort((a, b) => (Date.parse(a.start ?? '') || 0) - (Date.parse(b.start ?? '') || 0) || a.id.localeCompare(b.id));
  writeFileSync(path, `${JSON.stringify(list, null, 2)}\n`);
  return list;
}
const vList = merge(
  'versions.json',
  sorted.filter((v): v is VersionTimes & { end: string } => Boolean(v.end)).map(({ id, start, end }) => ({ id, start, end })),
);
const bList = merge('banners.json', banners);
const eList = merge('events.json', events);
writeFileSync(rhythmPath, `${JSON.stringify(rhythm, null, 2)}\n`);
console.log(`genshin: ${vList.length} versions (live ${live?.id ?? '?'}), ${bList.length} banners, ${eList.length} events (${eList.filter((e) => e.kind === 'endgame').length} endgame)`);
for (const n of out.notes) console.log(`  ${n}`);
