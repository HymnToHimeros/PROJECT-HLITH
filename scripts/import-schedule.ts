/**
 * Fills versions, banners and events (with endgame cycles) for HSR and ZZZ.
 * Run: npm run data:schedule (then npm run data:nanoka, which uses the banners
 * to tell announced characters from leaks).
 *
 * Sources, in order of trust:
 * 1. HoYoverse itself: the version update notices on the official websites
 *    (hsr.hoyoverse.com, zenless.hoyoverse.com) and the in-game notice board.
 *    Version dates and HSR endgame cycles come only from here, and any time
 *    here wins over the wiki's.
 * 2. The community wikis (honkai-star-rail.fandom.com, zenless-zone-zero.fandom.com),
 *    which copy each official notice into a page that links back to it, and add
 *    what the notices only show as pictures: reward amounts, featured items,
 *    login days, announced banners of the next phase. ZZZ endgame cycles too.
 *
 * Nothing is guessed: an item without both a start and an end is left out and
 * printed; an unknown reward stays null. Existing entries are never deleted, so
 * ids that someone's progress points at keep working.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { BacklogItem, Banner, GameEvent, Version } from '../src/core/contract/entities.ts';
import { amountOf, at, nameKey, noticeText, serverMark, slug, spanIn, versionFromNotice, type VersionTimes } from './schedule/text.ts';
import { fetchWiki, infobox, mainBox, poolBox, poolFeatured, rewardTotal, sectionLinks, statedTotal, wikiPrefix, wikiServer, wikiTime, type WikiPage } from './schedule/wiki.ts';

const ROOT = resolve(import.meta.dirname, '..');
const DAY = 86_400_000;
const NOW = Date.now();
/** Ended items newer than this stay useful on Calendar and Events (and the budget's "already earned"). */
const KEEP_BACK = 60 * DAY;

interface Game {
  id: 'hsr' | 'zzz';
  site: { app: string; channel: number; host: string };
  notices: string;
  wiki: string;
  premium: { id: string; item: string };
  pullItems: { id: string; item: string }[];
  bannerTypes: Record<string, string>;
  /** Wiki pages in a version's Events list that are endgame overviews, handled separately. */
  endgameOverview: RegExp;
  bonus: RegExp;
  weapons: string;
  characters: string;
}

const GAMES: Game[] = [
  {
    id: 'hsr',
    site: { app: '113fe6d3b4514cdd', channel: 250, host: 'hsr.hoyoverse.com' },
    notices:
      'https://sg-hkrpg-api.hoyoverse.com/common/hkrpg_global/announcement/api/getAnnContent?game=hkrpg&game_biz=hkrpg_global&lang=en&bundle_id=hkrpg_global&platform=pc&region=prod_official_asia&level=70&uid=800000000&channel_id=1',
    wiki: 'honkai-star-rail.fandom.com',
    premium: { id: 'stellar-jade', item: 'Stellar Jade' },
    pullItems: [
      { id: 'special-pass', item: 'Star Rail Special Pass' },
      { id: 'pass', item: 'Star Rail Pass' },
    ],
    bannerTypes: { 'character event': 'character', 'light cone event': 'light-cone', 'character collaboration': 'collab-character', 'light cone collaboration': 'collab-light-cone' },
    endgameOverview: /^(Memory of Chaos|Pure Fiction|Apocalyptic Shadow|Forgotten Hall|Anomaly Arbitration)/,
    bonus: /^(Garden of Plenty|Planar Fissure|Realm of the Strange)/,
    weapons: 'lightcone.json',
    characters: 'character.json',
  },
  {
    id: 'zzz',
    site: { app: '3e9196a4b9274bd7', channel: 296, host: 'zenless.hoyoverse.com' },
    notices:
      'https://sg-announcement-static.hoyoverse.com/common/nap_global/announcement/api/getAnnContent?game=nap&game_biz=nap_global&lang=en&bundle_id=nap_global&platform=pc&region=prod_gf_jp&level=60&uid=1500000000&channel_id=1',
    wiki: 'zenless-zone-zero.fandom.com',
    premium: { id: 'polychrome', item: 'Polychrome' },
    pullItems: [
      { id: 'encrypted-master-tape', item: 'Encrypted Master Tape' },
      { id: 'master-tape', item: 'Master Tape' },
      { id: 'boopon', item: 'Boopon' },
    ],
    bannerTypes: { 'exclusive channel': 'exclusive', 'w-engine channel': 'w-engine', 'bangboo channel': 'bangboo' },
    endgameOverview: /^(Shiyu Defense|Deadly Assault)/,
    bonus: /Bounty:/,
    weapons: 'weapon.json',
    characters: 'character.json',
  },
];

const problems: string[] = [];
const warn = (game: string, msg: string) => {
  problems.push(`${game}: ${msg}`);
  console.warn(`  ${game}: ${msg}`);
};

async function json<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'user-agent': 'PROJECT-HLITH data import' } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

// ── 1. Versions from the official websites ─────────────────────────────

interface SiteItem {
  iInfoId: number;
  sTitle: string;
  sContent?: string;
}

async function siteVersions(g: Game): Promise<{ versions: Map<string, VersionTimes>; texts: Map<string, string> }> {
  const base = `https://sg-public-api-static.hoyoverse.com/content_v2_user/app/${g.site.app}`;
  const items: SiteItem[] = [];
  for (let page = 1; page <= 20; page++) {
    const r = await json<{ data: { iTotal: number; list: SiteItem[] } }>(
      `${base}/getContentList?iChanId=${g.site.channel}&iPageSize=50&iPage=${page}&sLangKey=en-us&isPreview=0`,
    );
    items.push(...r.data.list);
    if (items.length >= r.data.iTotal || r.data.list.length === 0) break;
  }
  const found = new Map<string, VersionTimes>();
  const texts = new Map<string, string>();
  for (const it of items) {
    const id = /Version (\d+\.\d+)\b/.exec(it.sTitle)?.[1];
    if (!id || !/Update( Details| Announcement)?\s*$|Version Update/.test(it.sTitle) || /Pre-Download|Maintenance|Trailer|Program/.test(it.sTitle)) continue;
    if (found.has(id)) continue;
    const full = await json<{ data: SiteItem }>(`${base}/getContent?iInfoId=${it.iInfoId}&sLangKey=en-us&isPreview=0`);
    const text = noticeText(full.data.sContent ?? '');
    const v = versionFromNotice(id, text);
    if (!v) {
      warn(g.id, `version ${id}: no update time in "${it.sTitle}"`);
      continue;
    }
    found.set(id, v);
    texts.set(id, text);
  }
  // A version without a stated end runs until the next one starts.
  const sorted = [...found.values()].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  sorted.forEach((v, i) => {
    const next = sorted[i + 1];
    if (!v.end && next) v.end = next.start;
  });
  return { versions: new Map(sorted.map((v) => [v.id, v])), texts };
}

// ── 2. The in-game notice board (current notices only) ─────────────────

async function inGameNotices(g: Game): Promise<string[]> {
  const r = await json<{ data: { list: { content: string; title: string }[]; pic_list: { content: string; title: string }[] } }>(g.notices);
  return [...r.data.list, ...r.data.pic_list].map((a) => `${noticeText(a.title)}\n${noticeText(a.content)}`);
}

/**
 * How long the notice board shows each notice (its own end time), by title. A permanent
 * banner ("available long-term") has no end of its own; the notice's end says how long
 * it is announced, which is what `Banner.end` holds when `permanent` is set.
 */
async function noticeEnds(g: Game): Promise<Map<string, string>> {
  type Item = { title: string; end_time: string };
  const r = await json<{ data: { timezone: number; list: { list: Item[] }[]; pic_list: { type_list: { list: Item[] }[] }[] } }>(g.notices.replace('getAnnContent', 'getAnnList'));
  const items = [...r.data.list.flatMap((x) => x.list), ...r.data.pic_list.flatMap((x) => x.type_list.flatMap((t) => t.list))];
  return new Map(items.map((a) => [noticeText(a.title), at(a.end_time.replace(/-/g, '/'), r.data.timezone)]));
}

// ── 3. Names → the game's ids (characters from our list, weapons from nanoka) ──

async function idIndex(g: Game, wikiPages: Map<string, WikiPage>): Promise<{ index: Map<string, string>; weaponArt: Map<string, string> }> {
  const index = new Map<string, string>();
  const chars = JSON.parse(readFileSync(resolve(ROOT, `src/games/${g.id}/data/characters.json`), 'utf8')) as { id: string; name: string }[];
  for (const c of chars) index.set(nameKey(c.name), c.id);
  // ZZZ banners use full names ("Roxy Ifrita Pryce"); the wiki's character pages give both.
  for (const page of wikiPages.values()) {
    const box = infobox(page.text.slice(Math.max(0, page.text.search(/\{\{(Agent|Character) Infobox/))));
    const short = box.brief_name?.replace(/&shy;|­/g, '');
    const id = short ? index.get(nameKey(short)) : undefined;
    if (id && box.name) index.set(nameKey(box.name), id);
  }
  const manifest = await json<Record<string, { latest: string }>>('https://static.nanoka.cc/manifest.json');
  const weapons = await json<Record<string, { en: string; icon?: string }>>(`https://static.nanoka.cc/${g.id}/${manifest[g.id]?.latest ?? ''}/${g.weapons}`);
  const weaponArt = new Map<string, string>();
  for (const [id, w] of Object.entries(weapons)) {
    if (!index.has(nameKey(w.en))) index.set(nameKey(w.en.replace(/<[^>]+>/g, '')), id);
    // nanoka's pictures: HSR light cone figures by id, ZZZ W-Engines by icon name.
    const art = g.id === 'hsr' ? `https://static.nanoka.cc/assets/hsr/lightconemaxfigures/${id}.webp` : w.icon ? `https://static.nanoka.cc/assets/zzz/${w.icon}.webp` : undefined;
    if (art) weaponArt.set(id, art);
  }
  // Unreleased ZZZ W-Engines carry a working name in the game files ("Nirvana's First Plume" before it
  // was announced as "Plume of Rebirth"). The wiki names the agent it belongs to, and the game files
  // name its picture after that agent (Weapon_S_<agent id>), which ties the two together.
  const byIcon = new Map(Object.entries(weapons).map(([id, w]) => [w.icon, id]));
  for (const page of wikiPages.values()) {
    if (index.has(nameKey(page.title))) continue;
    const agent = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]'s \[\[Exclusive W-Engine/.exec(page.text)?.[1];
    const agentId = agent ? index.get(nameKey(agent)) : undefined;
    const weaponId = agentId ? byIcon.get(`Weapon_S_${agentId}`) : undefined;
    if (weaponId) index.set(nameKey(page.title), weaponId);
  }
  return { index, weaponArt };
}

// ── 4. Banners and events from the wiki's version pages ────────────────

const dateOf = (title: string) => /\/(\d{4}-\d{2}-\d{2})$/.exec(title)?.[1];
const baseOf = (title: string) => title.replace(/\/\d{4}-\d{2}-\d{2}$/, '').replace(/\/\d{4}-$/, '');

function kindOf(g: Game, title: string, box: Record<string, string>, text: string): GameEvent['kind'] {
  const types = `${box.type ?? ''} ${box.type2 ?? ''} ${box.group ?? ''}`.toLowerCase();
  if (/login|check-in/.test(types)) return 'login';
  // ZZZ's wiki types every in-game event alike; its description says when it is a log-in event.
  const about = /\{\{Description\|([^}]*)\}\}/.exec(text)?.[1] ?? '';
  if (/\b(log in|check in)\b[^.]*\b\d+ days?\b|\b(log in|check in) (every day|daily)/i.test(about)) return 'login';
  if (/web/.test(types)) return 'web';
  if (g.bonus.test(title) || /double|bounty/.test(types)) return 'bonus';
  return 'event';
}

/** Premium currency in the page's reward cards; when there is none, the pull item it gives most of. */
function rewardOf(g: Game, text: string): { reward: number | null; currency: string } {
  const premium = rewardTotal(text, g.premium.item);
  if (premium === null || premium > 0) return { reward: premium, currency: g.premium.id };
  for (const p of g.pullItems) {
    const n = rewardTotal(text, p.item);
    if (n === null || n > 0) return { reward: n, currency: p.id };
  }
  return { reward: 0, currency: g.premium.id };
}

/**
 * The official time for an item, when a current notice names it with a full
 * period nearby. Banner and event names repeat across versions, so a period is
 * only taken when it is the same run: it starts within 3 days of the wiki's
 * start (or the wiki has no start at all).
 */
function officialSpan(title: string, notices: string[], versions: Map<string, VersionTimes>, near?: string) {
  for (const n of notices) {
    for (let i = n.indexOf(title); i >= 0; i = n.indexOf(title, i + 1)) {
      // Only the lines of this item: stop at the next item ("■", "•", "▌", "1.").
      const lines = n.slice(i, i + 900).split('\n');
      const own = [lines[0] ?? '', ...lines.slice(1, 8).filter((_, k, a) => !a.slice(0, k + 1).some((l) => /^([■•▌▶]|\d+\.\s)/.test(l.trim())))];
      for (const line of own) {
        try {
          const s = spanIn(line, versions);
          if (s && (!near || Math.abs(Date.parse(s.start) - Date.parse(near)) < 3 * DAY)) return s;
        } catch {
          // A period that names an unknown version: not usable as a check.
        }
      }
    }
  }
  return undefined;
}

async function fromWiki(g: Game, versions: Map<string, VersionTimes>, notices: string[], ends: Map<string, string>) {
  // Versions still relevant: running, ended recently, or announced (a wiki page exists).
  const wanted = [...versions.values()].filter((v) => !v.end || Date.parse(v.end) > NOW - KEEP_BACK).map((v) => v.id);
  const last = [...versions.keys()].at(-1) ?? '0.0';
  const [maj, min] = last.split('.').map(Number) as [number, number];
  const candidates = [...wanted, `${maj}.${min + 1}`, `${maj + 1}.0`];
  const versionPages = await fetchWiki(
    g.wiki,
    candidates.map((v) => `Version/${v}`),
  );

  const bannerTitles = new Set<string>();
  const eventTitles = new Set<string>();
  /** Characters a version page names on an upcoming banner: "[[Into the Flames of Life/2026-10-21|…]] (Phoenix)". */
  const announced: { name: string; day: string }[] = [];
  for (const page of versionPages.values()) {
    for (const m of page.text.matchAll(/^\*+\s*\[\[[^\]|]*\/(\d{4}-\d{2}-\d{2})\|[^\]]*\]\]\s*\((?:\[\[)?([^\])]+)(?:\]\])?\)/gm)) announced.push({ day: m[1] ?? '', name: (m[2] ?? '').trim() });
    // "Data Bounty/2026-" is a link the wiki leaves until the date is known: nothing to read yet.
    const ready = (t: string) => !/\/\d{4}-$/.test(t);
    for (const t of sectionLinks(page.text, /^(Warps|Signal Searches|Event Warps|Channels)$/i)) if (ready(t)) bannerTitles.add(t.replace(/^\(/, ''));
    for (const t of sectionLinks(page.text, /^Events$/i)) if (ready(t) && !g.endgameOverview.test(t)) eventTitles.add(t);
  }
  const pages = await fetchWiki(g.wiki, [...bannerTitles, ...eventTitles]);
  // Permanent warps from older collaborations stay in the game: follow the "alongside" links of
  // permanent banners to the other permanent ones (e.g. the 2025 Fate warps next to the 2026 ones).
  const older = new Set<string>();
  for (const t of bannerTitles) {
    const box = mainBox(pages.get(t)?.text ?? '');
    if (!/^none$/i.test(box.time_end ?? '')) continue;
    for (const [k, v] of Object.entries(box)) if (/^alongside\d*$/.test(k) && v && !bannerTitles.has(v)) older.add(v);
  }
  for (const [t, p] of await fetchWiki(g.wiki, [...older])) {
    if (!/^none$/i.test(mainBox(p.text).time_end ?? '')) continue;
    pages.set(t, p);
    bannerTitles.add(t);
  }

  // Event pages split into tabs ("subpage1 = Mechatron Exhibition") keep rewards on the tabs.
  const tabs: string[] = [];
  for (const t of eventTitles) {
    const p = pages.get(t);
    if (!p) continue;
    const tabBox = /\{\{Event Tabs/.test(p.text) ? infobox(p.text.slice(p.text.indexOf('{{Event Tabs'))) : {};
    for (const [k, v] of Object.entries(tabBox)) if (/^subpage\d+$/.test(k) && v) tabs.push(`${baseOf(t)}/${v}`);
    // Some events keep their full reward table on a "/Rewards" page.
    tabs.push(`${baseOf(t)}/Rewards`);
  }
  const tabPages = await fetchWiki(g.wiki, tabs);

  // Names of featured items → ids; the character pages give full names.
  const featuredNames = new Set<string>();
  for (const t of bannerTitles) {
    const p = pages.get(t);
    if (!p) continue;
    const f = poolFeatured(poolBox(p.text));
    for (const n of [...f.top, ...f.mid]) featuredNames.add(n);
  }
  const { index, weaponArt } = await idIndex(g, await fetchWiki(g.wiki, [...featuredNames]));

  const banners: Banner[] = [];
  for (const t of bannerTitles) {
    const p = pages.get(t);
    if (!p) {
      warn(g.id, `banner page "${t}" not found on the wiki`);
      continue;
    }
    const box = mainBox(p.text);
    const type = Object.entries(g.bannerTypes).find(([k]) => (box.type ?? '').toLowerCase().startsWith(k))?.[1];
    let start = wikiTime(box, 'start');
    let end = wikiTime(box, 'end');
    let startServer = wikiServer(box, 'start');
    let endServer = wikiServer(box, 'end');
    const title = baseOf(t);
    const official = officialSpan(title, notices, versions, start);
    if (official) {
      if (start && Math.abs(Date.parse(official.start) - Date.parse(start)) > 60_000) warn(g.id, `${title}: wiki start ${start}, official ${official.start} (official used)`);
      if (end && Math.abs(Date.parse(official.end) - Date.parse(end)) > 60_000) warn(g.id, `${title}: wiki end ${end}, official ${official.end} (official used)`);
      ({ start, end, startServer, endServer } = official);
    }
    // A collaboration warp runs "long-term" (the wiki writes time_end = none): permanent, announced
    // until the end of its official notice on the notice board.
    const permanent = /^none$/i.test(box.time_end ?? '');
    if (permanent && start && !end) end = [...ends].find(([n]) => /Collaboration Warp/i.test(n))?.[1];
    if (!type || !start || !end) {
      warn(g.id, `banner "${t}" left out: ${!type ? `unknown type "${box.type ?? ''}"` : 'no start or end yet'}`);
      continue;
    }
    const f = poolFeatured(poolBox(p.text));
    const featured: string[] = [];
    for (const n of [...f.top, ...f.mid]) {
      const id = index.get(nameKey(n));
      if (id) featured.push(id);
      else warn(g.id, `${title}: featured "${n}" is not in the lists`);
    }
    if (f.top.length === 0) warn(g.id, `${title}: the wiki page has no featured items yet`);
    // A weapon banner's own picture: its featured Light Cone / W-Engine (nanoka).
    const lead = featured[0];
    const art = lead ? weaponArt.get(lead) : undefined;
    banners.push({ id: `${slug(title)}-${dateOf(t) ?? start.slice(0, 10)}`, type, title, featured, start, end, ...serverMark(startServer, permanent ? false : endServer), ...(art ? { art } : {}), ...(permanent ? { permanent: true } : {}) });
  }

  // Keep only pictures that answer; a missing one falls back to the lead character's art on screen.
  await Promise.all(
    banners.map(async (b) => {
      if (!b.art) return;
      const res = await fetch(b.art, { method: 'HEAD' }).catch(() => undefined);
      if (!res?.ok) {
        warn(g.id, `${b.title}: no picture at ${b.art}`);
        delete b.art;
      }
    }),
  );

  const events: GameEvent[] = [];
  for (const t of eventTitles) {
    // A page the wiki hasn't written yet: the official notice alone can still give its period.
    const p = pages.get(t) ?? { title: t, text: '' };
    const box = mainBox(p.text);
    const title = baseOf(t).replace(/^"(.*)"$/, '$1');
    let start = wikiTime(box, 'start');
    let end = wikiTime(box, 'end');
    let startServer = wikiServer(box, 'start');
    let endServer = wikiServer(box, 'end');
    const day = dateOf(t);
    const near = start ?? (day ? new Date(`${day}T12:00:00+08:00`).toISOString() : undefined);
    // Only current notices are searched, so a name found there is this run even without a date.
    const official = officialSpan(title, notices, versions, near);
    if (official) {
      if (end && Math.abs(Date.parse(official.end) - Date.parse(end)) > 60_000) warn(g.id, `${title}: wiki end ${end}, official ${official.end} (official used)`);
      ({ start, end, startServer, endServer } = official);
    }
    if (!start || !end) {
      warn(g.id, `event "${title}" left out: no start or end yet (${pages.has(t) ? 'wiki page has none' : 'no wiki page yet'}, no official period)`);
      continue;
    }
    // Outfit sales ("a discount Event") cost currency and give none: a shop, not something to do.
    if (/is an? discount \[\[Event/i.test(p.text)) continue;
    const kind = kindOf(g, title, box, p.text);
    // The event page and its sub-pages. A page that states its own total wins (main page first,
    // then "/Rewards"), so rows and totals are never added together; otherwise every reward row counts.
    const subs = [`${baseOf(t)}/Rewards`, ...tabs.filter((x) => x.startsWith(`${baseOf(t)}/`) && !x.endsWith('/Rewards'))];
    const texts = [p.text, ...subs.map((x) => tabPages.get(x)?.text ?? '')].filter(Boolean);
    const withTotal = texts.slice(0, 2).find((x) => [g.premium.item, ...g.pullItems.map((i) => i.item)].some((item) => statedTotal(x, item) !== undefined));
    const all = withTotal ?? texts.join('\n');
    const override = REWARD_OVERRIDE[g.id]?.[title];
    // Double-drop events give no currency of their own; a page without any reward list is unknown, not zero.
    const { reward, currency } = override
      ? { reward: override.reward, currency: g.premium.id }
      : kind === 'bonus'
        ? { reward: 0, currency: g.premium.id }
        : /\{\{Card|\{\{Event Rewards/.test(all)
          ? rewardOf(g, all)
          : { reward: null, currency: g.premium.id };
    const ev: GameEvent = { id: `${slug(title)}-${dateOf(t) ?? start.slice(0, 10)}`, title, kind, start, end, reward, currency, ...serverMark(startServer, endServer) };
    if (kind === 'login') {
      const days = Math.max(0, ...[...p.text.matchAll(/^\|\s*(?:Day\s*)?(\d+)\s*\|\||caption[:=]\s*Day (\d+)\}/gim)].map((m) => Number(m[1] ?? m[2])));
      const stated = /(?:for|total of)\s+(\d+)\s+days/i.exec(p.text)?.[1] ?? /(\d+)\s+days\b/i.exec(/\{\{Description\|([^}]*)\}\}/.exec(p.text)?.[1] ?? '')?.[1];
      const n = days || Number(stated ?? 0);
      if (n > 0) ev.loginDays = n;
      else warn(g.id, `${title}: login event without a day count`);
    }
    events.push(ev);
  }
  return { banners, events, announced: announced.map((a) => ({ ...a, id: index.get(nameKey(a.name)) })) };
}

/**
 * A character nanoka marked as a leak is official once a version page (copied
 * from the official special program) names them on a banner: the leak mark goes
 * and the banner's first day becomes the release date (noon UTC+8, as in
 * import-nanoka.ts). Run after data:nanoka, which marks leaks again from the files.
 */
function announce(g: Game, list: { id?: string; name: string; day: string }[]) {
  const path = resolve(ROOT, `src/games/${g.id}/data/characters.json`);
  const chars = JSON.parse(readFileSync(path, 'utf8')) as { id: string; name: string; leak?: unknown; releasedAt?: string }[];
  let changed = 0;
  for (const c of chars) {
    if (!c.leak) continue;
    const first = list.filter((a) => a.id === c.id).sort((a, b) => a.day.localeCompare(b.day))[0];
    if (!first) continue;
    delete c.leak;
    c.releasedAt = `${first.day}T04:00:00.000Z`;
    changed++;
    console.log(`  ${c.name}: announced for ${first.day}, no longer a leak`);
  }
  if (changed) writeFileSync(path, `${JSON.stringify(chars, null, 2)}\n`);
}

/**
 * Premium currency for events whose reward list the wiki shows without amounts, from the
 * next best source that does. Each entry names its source; the wiki's own numbers win once it has them
 * (delete the entry then).
 */
const REWARD_OVERRIDE: Record<string, Record<string, { reward: number; source: string }>> = {
  zzz: {
    // 5 commissions plus the all-done reward; the official notice shows the rewards only as pictures.
    'Chronicles of the Hobbling Crow': { reward: 360, source: 'game8.co/games/Zenless-Zone-Zero/archives/618201' },
  },
};

// ── 5. Endgame cycles ──────────────────────────────────────────────────

/** Premium currency for a full clear of one cycle; the same numbers and sources as the games' income rows (contract.ts). */
const ENDGAME_REWARD: Record<string, number> = {
  'Memory of Chaos': 800,
  'Pure Fiction': 800,
  'Apocalyptic Shadow': 800,
  'Shiyu Defense: Critical Node': 780,
  'Deadly Assault': 300,
};

/** HSR: the version notices list every Treasures Lightward cycle with its period. */
function hsrEndgame(texts: Map<string, string>, versions: Map<string, VersionTimes>): GameEvent[] {
  const out = new Map<string, GameEvent>();
  for (const text of texts.values()) {
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      const m = /^(Memory of Chaos|Pure Fiction|Apocalyptic Shadow): (.+)$/.exec(line.trim());
      if (!m) return;
      const next = lines[i + 1] ?? '';
      let span;
      try {
        span = spanIn(next, versions);
      } catch {
        span = undefined;
      }
      if (!span) return;
      const title = `${m[1]}: ${m[2]}`;
      const id = `${slug(title)}-${span.start.slice(0, 10)}`;
      if (Date.parse(span.end) > NOW - KEEP_BACK) out.set(id, { id, title, kind: 'endgame', start: span.start, end: span.end, reward: ENDGAME_REWARD[m[1] ?? ''] ?? null, currency: 'stellar-jade', ...serverMark(span.startServer, span.endServer) });
    });
  }
  return [...out.values()];
}

/**
 * ZZZ: one wiki page per cycle ("Deadly Assault/2026-09-25"). The wiki writes a
 * cycle's page once it opens; a cycle that has already opened by the game's
 * fixed two-week rhythm (the version notice lists every phase of the version,
 * e.g. "Phase III") is added from the previous cycle's end, up to the version end.
 */
async function zzzEndgame(g: Game, versionEnd: number | undefined): Promise<GameEvent[]> {
  const out: GameEvent[] = [];
  for (const [prefix, label] of [
    ['Shiyu Defense/Critical Node/', 'Shiyu Defense: Critical Node'],
    ['Deadly Assault/', 'Deadly Assault'],
  ] as const) {
    const titles = (await wikiPrefix(g.wiki, `${prefix}20`)).filter((t) => {
      const d = dateOf(t);
      return d && Date.parse(d) > NOW - KEEP_BACK;
    });
    const pages = await fetchWiki(g.wiki, titles);
    for (const t of titles) {
      const box = mainBox(pages.get(t)?.text ?? '');
      const start = wikiTime(box, 'start');
      const end = wikiTime(box, 'end');
      if (!start || !end) {
        warn(g.id, `${t}: no start or end yet`);
        continue;
      }
      out.push({ id: `${slug(label)}-${dateOf(t)}`, title: label, kind: 'endgame', start, end, reward: ENDGAME_REWARD[label] ?? null, currency: g.premium.id, ...serverMark(wikiServer(box, 'start'), wikiServer(box, 'end')) });
    }
    const mine = out.filter((e) => e.title === label).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    let last = mine.at(-1);
    while (last && versionEnd && Date.parse(last.end) < Math.min(versionEnd, NOW) ) {
      // Same clock times as the cycle before, two weeks later.
      const start = new Date(Date.parse(last.start) + 14 * DAY).toISOString();
      const end = new Date(Date.parse(last.end) + 14 * DAY).toISOString();
      // Server-time days: the date part of the start at UTC+8.
      const day = new Date(Date.parse(start) + 8 * 3_600_000).toISOString().slice(0, 10);
      last = { id: `${slug(label)}-${day}`, title: label, kind: 'endgame', start, end, reward: ENDGAME_REWARD[label] ?? null, currency: g.premium.id, ...(last.serverTime ? { serverTime: last.serverTime } : {}) };
      warn(g.id, `${label} ${day}: no wiki page yet, added from the two-week cycle (${start} – ${end})`);
      out.push(last);
    }
  }
  return out;
}

// ── 6. Backlog: the main story, chapter by chapter ─────────────────────

/**
 * The main story as one backlog item with its chapters as steps, in story
 * order, from the wiki's chapter lists. New chapters are only ever added at the
 * end, so the step someone marked stays the same step. Rewards per chapter are
 * not listed anywhere complete, so the reward stays unknown (null).
 */
async function mainStory(g: Game): Promise<BacklogItem | undefined> {
  if (g.id === 'hsr') {
    const page = (await fetchWiki(g.wiki, ['Trailblaze Mission'])).get('Trailblaze Mission');
    if (!page) return undefined;
    const steps: string[] = [];
    let world = '';
    const seen = new Set<string>();
    for (const line of page.text.split('\n')) {
      const w = /^!\s*colspan="3"[^|]*\|\s*\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/.exec(line);
      if (w) {
        const next = (w[2] ?? w[1] ?? '').trim();
        // After the worlds come Finality and Equilibrium missions (a world can show up again there).
        if (/Finality|Equilibrium/i.test(next) || seen.has(next)) break;
        seen.add(next);
        world = next;
        continue;
      }
      const c = /^\|\s*'''\[\[([^\]|]+)(?:\|([^\]]+))?\]\]'''/.exec(line);
      if (c && world) steps.push(`${world}: ${(c[2] ?? c[1] ?? '').trim()}`);
    }
    if (steps.length === 0) return undefined;
    return {
      id: 'hsr.main-story',
      category: 'story',
      title: 'Trailblaze Missions (main story)',
      total: steps.length,
      reward: null,
      currency: g.premium.id,
      steps,
      note: 'Chapters from honkai-star-rail.fandom.com/wiki/Trailblaze_Mission. Rewards per chapter: no data yet.',
    };
  }
  const titles = ['Season 1', 'Season 2', 'Season 3', 'Season 4', 'Season 5'];
  const pages = await fetchWiki(g.wiki, titles);
  const steps: string[] = [];
  for (const t of titles) {
    const text = pages.get(t)?.text;
    if (!text) continue;
    for (const m of text.matchAll(/\|chapNum(\d+)\s*=\s*(.*)\n\|chapName\1\s*=\s*(.*)/g)) {
      const num = (m[2] ?? '').replace(/^Chapter\s+/, '').trim();
      const label = /^Season/.test(num) ? num : `${t} Chapter ${num}`;
      steps.push(`${label}: ${(m[3] ?? '').trim()}`);
    }
  }
  if (steps.length === 0) return undefined;
  return {
    id: 'zzz.main-story',
    category: 'story',
    title: "Phaethon's Story (main story)",
    total: steps.length,
    reward: null,
    currency: g.premium.id,
    steps,
    note: 'Chapters from the Season pages of zenless-zone-zero.fandom.com. Rewards per chapter: no data yet.',
  };
}

// ── 7. Merge and write ─────────────────────────────────────────────────

/** New entries replace old ones with the same id; old ids are never dropped. */
function merge<T extends { id: string; start?: string }>(file: string, fresh: T[]): T[] {
  const path = resolve(ROOT, file);
  const old = JSON.parse(readFileSync(path, 'utf8')) as T[];
  const byId = new Map(old.map((x) => [x.id, x]));
  for (const x of fresh) byId.set(x.id, x);
  const list = [...byId.values()].sort((a, b) => (Date.parse(a.start ?? '') || 0) - (Date.parse(b.start ?? '') || 0) || a.id.localeCompare(b.id));
  writeFileSync(path, `${JSON.stringify(list, null, 2)}\n`);
  return list;
}

for (const g of GAMES) {
  console.log(`${g.id}:`);
  const { versions, texts } = await siteVersions(g);
  // Only notices about what runs now: old version notices reuse the same names for older runs.
  const current = [...versions.values()].filter((v) => !v.end || Date.parse(v.end) > NOW).map((v) => texts.get(v.id) ?? '');
  const notices = [...(await inGameNotices(g)), ...current];
  const ends = await noticeEnds(g);
  const { banners, events, announced } = await fromWiki(g, versions, notices, ends);
  announce(g, announced);
  const live = [...versions.values()].find((v) => Date.parse(v.start) <= NOW && v.end && NOW < Date.parse(v.end));
  const endgame = g.id === 'hsr' ? hsrEndgame(texts, versions) : await zzzEndgame(g, live?.end ? Date.parse(live.end) : undefined);

  // Version notices state premium rewards in plain text for some events ("Stellar Jade ×500").
  for (const e of events) {
    if ((e.reward !== 0 && e.reward !== null) || e.kind === 'bonus') continue;
    for (const text of notices) {
      const i = text.indexOf(e.title);
      if (i < 0) continue;
      const n = amountOf(text.slice(i, i + 400).split(/\n[■•]/)[0] ?? '', g.premium.item);
      if (n > 0) {
        e.reward = n;
        e.currency = g.premium.id;
        break;
      }
    }
  }

  const versionList: Version[] = [...versions.values()].filter((v): v is VersionTimes & { end: string } => Boolean(v.end)).map(({ id, start, end }) => ({ id, start, end }));
  const v = merge(`src/games/${g.id}/data/versions.json`, versionList);
  const b = merge(`src/games/${g.id}/data/banners.json`, banners);
  const e = merge(`src/games/${g.id}/data/events.json`, [...events, ...endgame]);
  const story = await mainStory(g);
  if (story) merge(`src/games/${g.id}/data/backlog.json`, [story]);
  else warn(g.id, 'main story chapters not found on the wiki');
  console.log(`  ${v.length} versions, ${b.length} banners, ${e.length} events (${endgame.length} endgame cycles), main story ${story?.total ?? 0} chapters`);
}
if (problems.length) console.log(`\n${problems.length} notes above (left out or checked against the official notice).`);
