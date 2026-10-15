/**
 * Arknights: Endfield lists (`npm run data:endfield`): operators, weapons, banners (operator
 * and Arsenal Issues), events (Contingency Contract as the endgame) and versions, from
 * endfield.wiki.gg's Cargo tables (CC BY-SA, credited on every entry) checked against the
 * official news list (web-news.gryphline.com). Rules: scripts/endfield/map.ts.
 *
 *   node scripts/import-endfield.ts            writes src/games/endfield/data/*.json
 *   node scripts/import-endfield.ts --dry      prints counts and notes only
 *
 * Honest data: a value no source states stays out, and the notes at the end say what was left out.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { banners, events, operators, rhythmFrom, versions, weapons, type NewsItem, type Notes, type Row } from './endfield/map.ts';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = resolve(ROOT, 'src/games/endfield/data');
const WIKI_API = 'https://endfield.wiki.gg/api.php';
const NEWS = 'https://web-news.gryphline.com/api/bulletin';
const dry = process.argv.includes('--dry');
/** Set to true once the Endfield contract has a third character rarity tier (4★ = 'low'). */
const LOW_TIER = process.argv.includes('--low-tier');

async function json<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'user-agent': 'PROJECT-HLITH data import (https://github.com/HymnToHimeros/PROJECT-HLITH)' } });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return (await res.json()) as T;
}

/** One Cargo table, every row (500 per page). */
async function cargo(table: string, fields: string, order: string): Promise<Row[]> {
  const rows: Row[] = [];
  for (let offset = 0; ; offset += 500) {
    const q = new URLSearchParams({ action: 'cargoquery', format: 'json', limit: '500', offset: String(offset), tables: table, fields, order_by: order });
    const d = await json<{ cargoquery?: { title: Row }[]; error?: { info: string } }>(`${WIKI_API}?${q}`);
    if (d.error) throw new Error(`wiki Cargo ${table}: ${d.error.info}`);
    const page = (d.cargoquery ?? []).map((x) => x.title);
    rows.push(...page);
    if (page.length < 500) return rows;
  }
}

/** Direct image links for wiki file names (50 per request). */
async function imageLinks(files: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const names = [...new Set(files.filter(Boolean))];
  for (let i = 0; i < names.length; i += 50) {
    const batch = names.slice(i, i + 50);
    const q = new URLSearchParams({ action: 'query', format: 'json', prop: 'imageinfo', iiprop: 'url', titles: batch.map((n) => `File:${n}`).join('|') });
    const d = await json<{ query?: { normalized?: { from: string; to: string }[]; pages: Record<string, { title: string; imageinfo?: { url: string }[] }> } }>(`${WIKI_API}?${q}`);
    const back = new Map((d.query?.normalized ?? []).map((n) => [n.to, n.from]));
    for (const p of Object.values(d.query?.pages ?? {})) {
      const url = p.imageinfo?.[0]?.url;
      if (!url) continue;
      const asked = (back.get(p.title) ?? p.title).replace(/^File:/, '');
      out.set(asked, url.replace(/\?.*$/, ''));
    }
  }
  return out;
}

/** Every post on the official news list (all tabs), newest pages first. */
async function newsList(): Promise<NewsItem[]> {
  const items: NewsItem[] = [];
  for (let page = 1; page <= 30; page++) {
    const q = new URLSearchParams({ lang: 'en-us', code: 'arknights_endfield_official', page: String(page), pageSize: '20' });
    const d = await json<{ data: { list: NewsItem[]; total: number } }>(`${NEWS}?${q}`);
    items.push(...d.data.list.map((x) => ({ title: x.title, displayTime: x.displayTime })));
    if (items.length >= d.data.total || d.data.list.length === 0) break;
  }
  return items;
}

const out: Notes = { notes: [] };
const [opRows, wpnRows, banRows, issueRows, evtRows, verRows, news] = await Promise.all([
  cargo('Operators', 'Operator,Id,Icon,Splash,Rarity,Class,Element,Headhunting', 'Id'),
  cargo('Weapons', 'Weapon,Id,Icon,Type,Rarity', 'Id'),
  cargo('Banners', 'Banner,RateUpOperator,LimitedOperators,QuotaOperator,AsiaStartTime,AsiaEndTime,AmeuStartTime,AmeuEndTime', 'AsiaStartTime'),
  cargo('Issues', 'Issue,RateUpWeapon,IsPermanent,AsiaStartTime,AsiaEndTime,AmeuStartTime,AmeuEndTime', 'AsiaStartTime'),
  cargo('Events', '_pageName=Page,Event,Type,AsiaStartTime,AsiaEndTime,AmeuStartTime,AmeuEndTime', 'AsiaStartTime'),
  cargo('Versions', 'Version,VersionNumber,StartTime,EndTime', 'StartTime'),
  newsList(),
]);
const images = await imageLinks([...opRows.flatMap((r) => [r.Icon ?? '', r.Splash ?? '']), ...wpnRows.map((r) => r.Icon ?? '')]);

const vers = versions(verRows, news, out);
// The check rhythm learns when Endfield's notices come out (scripts/schedule/rhythm.ts). Only adds, never rewrites.
const named = verRows.filter((r) => r.VersionNumber && r.StartTime).map((r) => ({ id: r.VersionNumber as string, name: (r.Version ?? '').trim(), start: `${(r.StartTime as string).replace(' ', 'T')}Z`, end: '' }));
const learned = rhythmFrom(news, named);
const now = Date.now();
const current = vers.find((v) => Date.parse(v.start) <= now && now < Date.parse(v.end)) ?? vers.at(-1);
const ops = operators(opRows, banRows, images, LOW_TIER, out, vers[0]?.start);
const wpns = weapons(wpnRows, images, out);
const bans = banners(banRows, issueRows, ops, wpns, current?.end, out);
const evts = events(evtRows, out);

const lists = { versions: vers.map(({ id, start, end }) => ({ id, start, end })), characters: ops, weapons: wpns, banners: bans, events: evts };
console.log(
  `endfield: ${vers.length} versions (current ${current?.id ?? '?'}), ${ops.length} operators, ${wpns.length} weapons, ${bans.length} banners, ${evts.length} events (${evts.filter((e) => e.kind === 'endgame').length} Contingency Contract); ${news.length} official posts read`,
);
for (const n of out.notes) console.log(`  ${n}`);
if (dry) process.exit(0);
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
const rhythmPath = resolve(ROOT, 'scripts/schedule/rhythm.json');
const rhythm = JSON.parse(readFileSync(rhythmPath, 'utf8')) as Record<string, Record<string, Record<string, number>>>;
const mine = (rhythm.endfield ??= {});
for (const [kind, seen] of Object.entries(learned)) for (const [id, h] of Object.entries(seen)) (mine[kind] ??= {})[id] ??= h;
writeFileSync(rhythmPath, `${JSON.stringify(rhythm, null, 2)}\n`);
for (const [name, list] of Object.entries(lists)) writeFileSync(resolve(OUT, `${name}.json`), `${JSON.stringify(list, null, 2)}\n`);
console.log(`Written to ${OUT}.`);
