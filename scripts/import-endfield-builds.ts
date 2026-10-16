/**
 * Endfield recommended builds: the weapons the game itself recommends for each operator, as endfield.wiki.gg
 * (CC BY-SA 4.0) copies them onto the operator's page (Operator infobox `matskill` and `matstats`, shown as
 * "Recommended Weapons · Matching Skills / Matching Stats"; the wiki: "what the game recommends based on the
 * operator's skills / stats"). Cited per operator with the page revision. `npm run data:endfield-builds`
 * (`-- --dry` prints instead of writing).
 *
 * - Weapons only: the game doesn't rank them, so Matching Skills come first, then Matching Stats, each once.
 * - Gear sets, main stats, sub stats and skill order: no source (neither the game nor the wiki recommends
 *   them), so they stay empty and the app shows "No data yet".
 * - A weapon name not in src/games/endfield/data/weapons.json stops the import. An operator not out yet is
 *   marked `beta` (the wiki reads unreleased operators from the game files; it may change).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { BuildItem, RecommendedBuild } from '../src/core/contract/entities.ts';
import { page, pagesById, templates } from './import-endfield-kits.ts';

const ROOT = resolve(import.meta.dirname, '..');

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

export function buildFor(
  characterId: string,
  title: string,
  revid: number,
  text: string,
  weapons: Map<string, { icon?: string }>,
  beta: boolean,
): { build: RecommendedBuild | null; unknown: string[] } {
  const { all } = recommendedWeapons(text);
  const unknown = all.filter((n) => !weapons.has(n));
  if (!all.length) return { build: null, unknown };
  const items: Record<string, BuildItem> = Object.fromEntries(all.map((n) => [n, { ...(weapons.get(n)?.icon ? { icon: weapons.get(n)?.icon } : {}), effects: [] }]));
  return {
    build: {
      characterId,
      source: `the game's recommended weapons, not ranked: Matching Skills first, then Matching Stats (endfield.wiki.gg/wiki/${title.replace(/ /g, '_')}, CC BY-SA 4.0, revision ${revid})`,
      sets: [],
      mainStats: {},
      subStats: [],
      weapons: all,
      skillsFirst: [],
      ...(beta ? { beta: true } : {}),
      version: `wiki revision ${revid}`,
      items,
    },
    unknown,
  };
}

if (import.meta.main ?? process.argv[1]?.endsWith('import-endfield-builds.ts')) {
  const dry = process.argv.includes('--dry');
  const characters = JSON.parse(readFileSync(resolve(ROOT, 'src/games/endfield/data/characters.json'), 'utf8')) as { id: string; name: string; releasedAt?: string }[];
  const weaponList = JSON.parse(readFileSync(resolve(ROOT, 'src/games/endfield/data/weapons.json'), 'utf8')) as { name: string; icon?: string }[];
  const weapons = new Map(weaponList.map((w) => [w.name, w]));
  const pages = await pagesById();
  const cache = new Map<string, { text: string; revid: number }>();
  const builds: RecommendedBuild[] = [];
  const notes: string[] = [];
  const unknown: string[] = [];
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
    const r = buildFor(c.id, title, p.revid, p.text, weapons, beta);
    unknown.push(...r.unknown.map((n) => `${c.name}: "${n}"`));
    if (r.build) builds.push(r.build);
    else notes.push(`${c.name}: no recommended weapons on the page, left out`);
  }
  if (unknown.length) throw new Error(`Weapon names not in weapons.json (run npm run data:endfield first, or check the page):\n${unknown.join('\n')}`);
  builds.sort((a, b) => a.characterId.localeCompare(b.characterId));
  for (const n of notes) console.log(`note: ${n}`);
  console.log(`${builds.length} of ${characters.length} operators have recommended weapons.`);
  const out = `${JSON.stringify(builds, null, 1)}\n`;
  if (dry) console.log(out);
  else writeFileSync(resolve(ROOT, 'src/games/endfield/data/builds.json'), out);
}
