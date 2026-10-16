/**
 * Endfield recommended builds. `npm run data:endfield-builds` (`-- --dry` prints instead of writing).
 *
 * - Weapons: the ones the game itself recommends for each operator, as endfield.wiki.gg (CC BY-SA 4.0) copies
 *   them onto the operator's page (Operator infobox `matskill` and `matstats`, shown as "Recommended Weapons ·
 *   Matching Skills / Matching Stats"; the wiki: "what the game recommends based on the operator's skills /
 *   stats"), cited with the page revision. The game doesn't rank them: Matching Skills first, then Matching
 *   Stats, each once.
 * - Gear sets and skill order: community guides, read by hand into src/games/endfield/data/community-builds.json
 *   (every entry with its page and that page's date; nothing is fetched from those sites here). A pick is kept
 *   only where at least two sources agree: a gear set named by two or more sources and by more sources than
 *   any other set; a skill order that every source's order fits (the finest tiers they all share) with at
 *   least two tiers. Anything else stays empty and the app shows "No data yet".
 * - Gear sets (names and effects) come from npm run data:endfield-gear (gear-sets.json); run that first.
 * - Each operator's main and secondary attribute (Operator infobox `main`, `sub`) → operator-attributes.json.
 * - Main stats: Endfield gear has no main stat to pick, so the step isn't shown (`hasMainStats: false`).
 * A weapon or gear set name the lists don't know stops the import. An operator not out yet is marked `beta`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { BuildItem, RecommendedBuild } from '../src/core/contract/entities.ts';
import type { GearSet } from './import-endfield-gear.ts';
import { page, pagesById, templates } from './import-endfield-kits.ts';

const ROOT = resolve(import.meta.dirname, '..');
const SKILLS = ['Basic Attack', 'Battle Skill', 'Combo Skill', 'Ultimate'] as const;

interface Entry {
  source: string;
  url: string;
  date: string;
}
export interface CommunityBuilds {
  sources: Record<string, { name: string; url: string }>;
  operators: Record<string, { sets?: (Entry & { set: string })[]; skills?: (Entry & { tiers: string[][] })[] }>;
}

/** A list field of the infobox ("A, B, C") → names; empty or missing → []. */
export function names(field: string | undefined): string[] {
  return (field ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** The game's recommended weapons on one operator page: Matching Skills, then Matching Stats, each name once. */
export function recommendedWeapons(text: string): { skills: string[]; stats: string[]; all: string[] } {
  const box = templates(text, 'Operator infobox')[0] ?? {};
  const skills = names(box.matskill);
  const stats = names(box.matstats);
  return { skills, stats, all: [...new Set([...skills, ...stats])] };
}

const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const credit = (entries: Entry[], sources: CommunityBuilds['sources']) =>
  `Community guides: ${entries.map((e) => `${sources[e.source]?.name ?? e.source} (${day(e.date)})`).join(', ')}`;

/** The gear set two or more sources name, and more sources than name any other; else none. */
export function agreedSet(entries: (Entry & { set: string })[]): { set: string; by: Entry[] } | null {
  const by = new Map<string, (Entry & { set: string })[]>();
  for (const e of entries) by.set(e.set, [...(by.get(e.set) ?? []), e]);
  const ranked = [...by].sort((a, b) => b[1].length - a[1].length);
  const [top, next] = ranked;
  if (!top || top[1].length < 2 || (next && next[1].length === top[1].length)) return null;
  return { set: top[0], by: top[1] };
}

/**
 * The finest skill order every source's order fits: tiers cut only where all sources cut, so a source's tie
 * stays a tie and an order two sources disagree on merges into one tier. Fewer than two sources, or nothing
 * left but one tier of everything → none.
 */
export function agreedSkills(entries: (Entry & { tiers: string[][] })[]): string[][] | null {
  if (entries.length < 2) return null;
  const cuts = (tiers: string[][]) => tiers.map((_, i) => tiers.slice(0, i + 1).flat().sort().join('|'));
  const all = entries.map((e) => cuts(e.tiers));
  const common = (all[0] ?? []).filter((c) => all.every((list) => list.includes(c)));
  const tiers: string[][] = [];
  let before = new Set<string>();
  for (const c of common) {
    const now = new Set(c.split('|'));
    tiers.push(SKILLS.filter((s) => now.has(s) && !before.has(s)));
    before = now;
  }
  return tiers.length >= 2 ? tiers : null;
}

export function buildFor(
  characterId: string,
  title: string,
  revid: number,
  text: string,
  weapons: Map<string, { icon?: string }>,
  beta: boolean,
  community?: { data: CommunityBuilds; sets: Map<string, GearSet> },
): { build: RecommendedBuild | null; unknown: string[] } {
  const { all } = recommendedWeapons(text);
  const unknown = all.filter((n) => !weapons.has(n)).map((n) => `weapon "${n}"`);
  const own = community?.data.operators[characterId];
  for (const e of own?.sets ?? []) if (community && !community.sets.has(e.set)) unknown.push(`gear set "${e.set}" (${e.source})`);
  for (const e of own?.skills ?? []) for (const s of e.tiers.flat()) if (!(SKILLS as readonly string[]).includes(s)) unknown.push(`skill "${s}" (${e.source})`);
  if (!all.length) return { build: null, unknown };
  const set = agreedSet(own?.sets ?? []);
  const skills = agreedSkills(own?.skills ?? []);
  const items: Record<string, BuildItem> = Object.fromEntries(all.map((n) => [n, { ...(weapons.get(n)?.icon ? { icon: weapons.get(n)?.icon } : {}), effects: [] }]));
  if (set) items[set.set] = { effects: community?.sets.get(set.set)?.effects ?? [] };
  const stepSources = {
    ...(set && community ? { sets: credit(set.by, community.data.sources) } : {}),
    ...(skills && community ? { skills: credit(own?.skills ?? [], community.data.sources) } : {}),
  };
  return {
    build: {
      characterId,
      source: `the game's recommendation, not ranked: Matching Skills first, then Matching Stats (endfield.wiki.gg/wiki/${title.replace(/ /g, '_')}, CC BY-SA 4.0, revision ${revid})`,
      ranked: false,
      hasMainStats: false,
      ...(Object.keys(stepSources).length ? { stepSources } : {}),
      sets: set ? [{ pieces: 3, options: [set.set] }] : [],
      mainStats: {},
      subStats: [],
      weapons: all,
      skillsFirst: skills ?? [],
      ...(beta ? { beta: true } : {}),
      version: `wiki revision ${revid}`,
      items,
    },
    unknown,
  };
}

if (import.meta.main ?? process.argv[1]?.endsWith('import-endfield-builds.ts')) {
  const dry = process.argv.includes('--dry');
  const read = (p: string) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));
  const characters = read('src/games/endfield/data/characters.json') as { id: string; name: string; releasedAt?: string }[];
  const weaponList = read('src/games/endfield/data/weapons.json') as { name: string; icon?: string }[];
  const data = read('src/games/endfield/data/community-builds.json') as CommunityBuilds;
  const weapons = new Map(weaponList.map((w) => [w.name, w]));
  const sets = read('src/games/endfield/data/gear-sets.json') as GearSet[];
  const setMap = new Map(sets.map((s) => [s.name, s]));
  const pages = await pagesById();
  const cache = new Map<string, { text: string; revid: number }>();
  const builds: RecommendedBuild[] = [];
  const attributes: Record<string, { main: string; secondary?: string | undefined; source: string; version: string }> = {};
  const notes: string[] = [];
  const unknown: string[] = [];
  for (const id of Object.keys(data.operators)) if (!characters.some((c) => c.id === id)) unknown.push(`community-builds.json: operator "${id}"`);
  for (const c of characters) {
    // An operator the Operators table doesn't list yet (not released) is read from the page of its name.
    const title = pages.get(c.id) ?? c.name;
    if (!cache.has(title)) {
      try {
        cache.set(title, await page(title));
      } catch (e) {
        notes.push(`${c.name} (${c.id}): ${(e as Error).message}, left out`);
        continue;
      }
    }
    const p = cache.get(title) as { text: string; revid: number };
    const beta = c.releasedAt !== undefined && Date.parse(c.releasedAt) > Date.now();
    const box = templates(p.text, 'Operator infobox')[0] ?? {};
    if (box.main?.trim()) attributes[c.id] = { main: box.main.trim(), secondary: box.sub?.trim() || undefined, source: `endfield.wiki.gg/wiki/${title.replace(/ /g, '_')} (CC BY-SA 4.0)`, version: `wiki revision ${p.revid}` };
    else notes.push(`${c.name}: no main attribute on the page`);
    const r = buildFor(c.id, title, p.revid, p.text, weapons, beta, { data, sets: setMap });
    unknown.push(...r.unknown.map((n) => `${c.name}: ${n}`));
    if (r.build) builds.push(r.build);
    else notes.push(`${c.name}: no recommended weapons on the page, left out`);
  }
  if (unknown.length) throw new Error(`Names the lists don't know (check the page, or run npm run data:endfield first):\n${unknown.join('\n')}`);
  builds.sort((a, b) => a.characterId.localeCompare(b.characterId));
  for (const n of notes) console.log(`note: ${n}`);
  const count = (f: (b: RecommendedBuild) => boolean) => builds.filter(f).length;
  console.log(`${builds.length} of ${characters.length} operators: weapons ${count((b) => b.weapons.length > 0)}, gear set ${count((b) => b.sets.length > 0)}, skill order ${count((b) => b.skillsFirst.length > 0)}; attributes for ${Object.keys(attributes).length}.`);
  const out = (x: unknown) => `${JSON.stringify(x, null, 1)}\n`;
  if (dry) console.log(out(builds));
  else {
    writeFileSync(resolve(ROOT, 'src/games/endfield/data/builds.json'), out(builds));
    writeFileSync(resolve(ROOT, 'src/games/endfield/data/operator-attributes.json'), out(Object.fromEntries(Object.entries(attributes).sort())));
  }
}
