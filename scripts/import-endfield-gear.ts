/**
 * Endfield gear and weapon skills, from endfield.wiki.gg (CC BY-SA 4.0), each with its page revision.
 * `npm run data:endfield-gear` (`-- --dry` prints counts instead of writing). Writes, in src/games/endfield/data/:
 *
 * - gear-sets.json: every gear set (GearSets table) and its set effect in plain text.
 * - gear-pieces.json: every gear piece (Gears + GearStats tables): its set, slot (Armor, Gloves, Kit), rarity,
 *   level and its three fixed stats with their values at artifice levels 0–3.
 * - weapon-skills.json: every weapon's three skills (WeaponSkills table) with their text at rank 1 and at the
 *   highest rank, read from the weapon page's Skills table.
 *
 * Nothing is guessed: a piece without stats, or a stat name outside STATS, stops the import.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { stripTags } from '../src/core/text/markup.ts';
import { json, WIKI } from './import-endfield-kits.ts';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = (f: string) => resolve(ROOT, 'src/games/endfield/data', f);

/** Every stat a gear piece can carry, as the wiki names it. A new one stops the import until it's added here. */
export const STATS = [
  'Strength',
  'Agility',
  'Intellect',
  'Will',
  'Main Attribute',
  'Secondary Attribute',
  'Attack',
  'HP',
  'Critical Rate',
  'Arts Intensity',
  'Physical DMG Bonus',
  'Heat & Nature DMG',
  'Cryo & Electric DMG',
  'Arts DMG',
  'All Skill DMG',
  'Basic Attack DMG Bonus',
  'Battle Skill DMG Bonus',
  'Combo Skill DMG Bonus',
  'Ultimate DMG Bonus',
  'DMG Bonus vs. Staggered',
  'Ultimate Gain Efficiency',
  'Treatment Bonus',
  'Final DMG Reduction',
] as const;

export interface GearSet {
  name: string;
  /** Gear level the set is made at. */
  level: number;
  /** Its set effects in the game's words, e.g. { label: '3-piece', text: "Wearer's Arts Intensity +30. …" }. */
  effects: { label: string; text: string }[];
  source: string;
  version: string;
}

export interface GearPiece {
  name: string;
  id: string;
  /** The set it belongs to; missing = no set. */
  set?: string;
  slot: 'Armor' | 'Gloves' | 'Kit';
  rarity: number;
  level: number;
  /** Its fixed stats, each with its value at artifice level 0, 1, 2, 3 as far as the piece goes (a % stat as a fraction, e.g. 0.115). */
  stats: { stat: (typeof STATS)[number]; values: number[] }[];
  source: string;
  version: string;
}

export interface WeaponSkills {
  weapon: string;
  /** Its three skills: two stat boosts and its own skill, each at rank 1 and at the highest rank. */
  skills: { name: string; rank1: string; max: string }[];
  source: string;
  version: string;
}

const ENTITIES: Record<string, string> = { '#39': "'", quot: '"', amp: '&', lt: '<', gt: '>' };

/**
 * The wiki's markup → plain text: glossary spans keep their words, pictures and colours go. Tags are stripped
 * until none is left (stripTags), then entities are decoded in one pass, so "&amp;lt;" stays "&lt;" text.
 */
export function plain(raw: string): string {
  return stripTags(raw.replace(/\[\[File:[^\]]*\]\]/g, ''))
    .replace(/&(#39|quot|amp|lt|gt);/g, (_, e: string) => ENTITIES[e] ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "3-piece set effect: …" → { label: '3-piece', text }; "No Set Effects" → none. */
export function setEffects(raw: string): GearSet['effects'] {
  const text = plain(raw);
  const m = /^(\d+)-piece set effect:\s*(.*)$/i.exec(text);
  if (m) return [{ label: `${m[1]}-piece`, text: m[2] ?? '' }];
  return /^no set effects?$/i.test(text) || !text ? [] : [{ label: 'Set', text }];
}

/** A weapon page's rendered Skills table → per skill, its text at rank 1 and at the last rank. */
export function weaponSkillTable(htmlText: string, names: string[]): WeaponSkills['skills'] {
  // The heading "Weapon Skills" sits in its own small table; the ranks are in the next one (class mrfz-wtable).
  const at = htmlText.indexOf('mrfz-wtable', htmlText.indexOf('Weapon Skills'));
  const table = at < 0 ? '' : htmlText.slice(at, htmlText.indexOf('</table>', at));
  const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((r) => [...(r[1] ?? '').matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => plain(c[1] ?? '')));
  const ranks = rows.filter((r) => r.length >= names.length).map((r) => r.slice(-names.length));
  if (!ranks.length) throw new Error(`no skill ranks in the table for ${names.join(', ')}`);
  return names.map((name, i) => ({ name, rank1: ranks[0]?.[i] ?? '', max: ranks[ranks.length - 1]?.[i] ?? '' }));
}

const page = (title: string) => `endfield.wiki.gg/wiki/${title.replace(/ /g, '_')} (CC BY-SA 4.0)`;

/** Cargo rows of one table, all of them (500 at a time). */
async function cargo<T>(table: string, fields: string): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const q = new URLSearchParams({ action: 'cargoquery', format: 'json', limit: '500', offset: String(offset), tables: table, fields });
    const d = await json<{ cargoquery?: { title: T }[] }>(`${WIKI}/api.php?${q}`);
    const rows = (d.cargoquery ?? []).map((r) => r.title);
    out.push(...rows);
    if (rows.length < 500) return out;
  }
}

/** Each page's current revision id, 40 titles a call. */
async function revisions(titles: string[]): Promise<Map<string, number>> {
  const revs = new Map<string, number>();
  for (let i = 0; i < titles.length; i += 40) {
    const q = new URLSearchParams({ action: 'query', prop: 'revisions', rvprop: 'ids', format: 'json', formatversion: '2', titles: titles.slice(i, i + 40).join('|') });
    const d = await json<{ query: { pages: { title: string; revisions?: { revid: number }[] }[]; normalized?: { from: string; to: string }[] } }>(`${WIKI}/api.php?${q}`);
    const back = new Map((d.query.normalized ?? []).map((n) => [n.to, n.from]));
    for (const p of d.query.pages) if (p.revisions?.[0]) revs.set(back.get(p.title) ?? p.title, p.revisions[0].revid);
  }
  return revs;
}

if (import.meta.main ?? process.argv[1]?.endsWith('import-endfield-gear.ts')) {
  const dry = process.argv.includes('--dry');
  const problems: string[] = [];

  const setRows = await cargo<{ page: string; name: string; level: string; effect: string }>('GearSets', '_pageName=page,GearSet=name,Level=level,Effect=effect');
  const setRevs = await revisions(setRows.map((r) => r.page));
  const sets: GearSet[] = setRows
    .map((r) => ({ name: plain(r.name), level: Number(r.level), effects: setEffects(r.effect), source: page(r.page), version: `wiki revision ${setRevs.get(r.page) ?? 'unknown'}` }))
    .sort((a, b) => a.name.localeCompare(b.name));

  type GearRow = { page: string; name: string; id: string; type: string; rarity: string; level: string };
  type StatRow = Record<string, string>;
  const gearRows = await cargo<GearRow>('Gears', '_pageName=page,Gear=name,Id=id,Type=type,Rarity=rarity,Level=level');
  const statRows = await cargo<StatRow>(
    'GearStats',
    'Gear,SetName,PStat,PValue0,PValue1,PValue2,PValue3,SStat,SValue0,SValue1,SValue2,SValue3,TStat,TValue0,TValue1,TValue2,TValue3',
  );
  const statsOf = new Map(statRows.map((r) => [plain(r.Gear ?? ''), r]));
  const gearRevs = await revisions(gearRows.map((r) => r.page));
  const known = new Set<string>(STATS);
  const pieces: GearPiece[] = [];
  for (const g of gearRows) {
    const name = plain(g.name);
    const s = statsOf.get(name);
    if (!s) {
      problems.push(`${name}: no row in GearStats`);
      continue;
    }
    if (!['Armor', 'Gloves', 'Kit'].includes(g.type)) problems.push(`${name}: slot "${g.type}"`);
    const stats = (['P', 'S', 'T'] as const).flatMap((k) => {
      const stat = plain(s[`${k}Stat`] ?? '');
      if (!stat) return [];
      if (!known.has(stat)) problems.push(`${name}: stat "${stat}" isn't in STATS`);
      // Levels the piece can't be artificed to are 0 in the table: left off, never shown as a value.
      const values = [0, 1, 2, 3].map((i) => Number(s[`${k}Value${i}`] ?? 'NaN'));
      while (values.length > 1 && values[values.length - 1] === 0) values.pop();
      if (values.some((v) => !Number.isFinite(v))) problems.push(`${name}: a value of "${stat}" isn't a number`);
      return [{ stat: stat as GearPiece['stats'][number]['stat'], values }];
    });
    const set = plain(s.SetName ?? '');
    pieces.push({
      name,
      id: g.id,
      ...(set ? { set } : {}),
      slot: g.type as GearPiece['slot'],
      rarity: Number(g.rarity),
      level: Number(g.level),
      stats,
      source: page(g.page),
      version: `wiki revision ${gearRevs.get(g.page) ?? 'unknown'}`,
    });
  }
  pieces.sort((a, b) => a.name.localeCompare(b.name));
  const setNames = new Set(sets.map((x) => x.name));
  for (const p of pieces) if (p.set && !setNames.has(p.set)) problems.push(`${p.name}: set "${p.set}" isn't in GearSets`);

  const skillRows = await cargo<{ page: string; weapon: string; s1: string; s2: string; s3: string }>('WeaponSkills', '_pageName=page,Weapon=weapon,Skill1=s1,Skill2=s2,Skill3=s3');
  const weaponRevs = await revisions(skillRows.map((r) => r.page));
  const weaponSkills: WeaponSkills[] = [];
  for (const r of skillRows) {
    const names = [r.s1, r.s2, r.s3].map(plain).filter(Boolean);
    const q = new URLSearchParams({ action: 'parse', page: r.page, prop: 'text', format: 'json', formatversion: '2' });
    const d = await json<{ parse?: { text: string } }>(`${WIKI}/api.php?${q}`);
    try {
      weaponSkills.push({ weapon: plain(r.weapon), skills: weaponSkillTable(d.parse?.text ?? '', names), source: page(r.page), version: `wiki revision ${weaponRevs.get(r.page) ?? 'unknown'}` });
    } catch (e) {
      problems.push(`${r.weapon}: ${(e as Error).message}`);
    }
  }
  weaponSkills.sort((a, b) => a.weapon.localeCompare(b.weapon));

  if (problems.length) throw new Error(`The gear import stopped:\n${problems.join('\n')}`);
  console.log(`${sets.length} gear sets, ${pieces.length} gear pieces, ${weaponSkills.length} weapons with skills.`);
  const out = (x: unknown) => `${JSON.stringify(x, null, 1)}\n`;
  if (!dry) {
    writeFileSync(OUT('gear-sets.json'), out(sets));
    writeFileSync(OUT('gear-pieces.json'), out(pieces));
    writeFileSync(OUT('weapon-skills.json'), out(weaponSkills));
  }
}
