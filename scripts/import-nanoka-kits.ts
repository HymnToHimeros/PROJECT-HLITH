/**
 * Fills ZZZ kit text and profiles from nanoka.cc's public data files (used with
 * the site owner's permission). Run: npm run data:kits
 *
 * Kit text is added group by group (GROUPS below), never all characters at once:
 * each group is read and checked by hand before the next (docs/logic/zzz-method.md,
 * Part A). Profiles (specialty, attribute, faction, assist type) are written for
 * every character, because other characters' conditions look at them.
 *
 * The text is the game's own, with only its markup turned into plain words:
 * colour tags are dropped, button icons become "[Basic Attack button]" and the
 * like, controller/keyboard variants keep the fallback word, and level formulas
 * become "(34 + 3 × Special Attack level)", exactly as the game computes them.
 * Anything unrecognised stops the script instead of being guessed.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const BASE = 'https://static.nanoka.cc/zzz';
const MANIFEST = 'https://static.nanoka.cc/manifest.json';
/** The data version read. Characters not in the live version are marked beta (their text can change before release). */
const VERSION = '3.3.4+19304006';

/** Kit text is imported for these groups only, in this order. Add the next group here once the last one is read. */
const GROUPS: Record<string, string[]> = {
  // The squad from the method's worked example (Starlight Billy > Dialyn > Lucia) and Pan Yinhu.
  A: ['1531', '1481', '1451', '1421'],
};

// Specialty and attribute codes, as in scripts/import-nanoka.ts.
const ZZZ_TYPE: Record<string, string> = { 1: 'attack', 2: 'stun', 3: 'anomaly', 4: 'support', 5: 'defense', 6: 'rupture', 7: 'armorer' };
const ZZZ_ELEMENT: Record<string, string> = { 200: 'physical', 201: 'fire', 202: 'ice', 203: 'electric', 204: 'windbite', 205: 'ether', 300: 'lumiflux' };
/** Assist type, from the character's own tags. */
const ASSIST: Record<string, string> = { AidTypeParry: 'defensive', AidTypeEvade: 'evasive' };
/** Button icons in skill text. */
const ICON: Record<string, string> = {
  Icon_Normal: 'Basic Attack button',
  Icon_Special: 'Special Attack button',
  Icon_SpecialReady: 'EX Special Attack button',
  Icon_SpecialReady_Rp: 'EX Special Attack button',
  Icon_Evade: 'Dodge button',
  Icon_Switch: 'Switch button',
  Icon_UltimateReady: 'Ultimate button',
};
/** AvatarSkillLevel(n) in level formulas: which skill's level the number follows. */
const SKILL_LEVEL: Record<string, string> = { 1: 'Special Attack', 3: 'Chain Attack' };
/** Skill groups in the order the game lists them. */
const SKILL_GROUPS = ['basic', 'dodge', 'special', 'chain', 'assist'] as const;

interface Piece {
  id: string;
  label: string;
  kind: 'skill' | 'core' | 'additional' | 'mindscape';
  unlock?: { dupes: number };
  does: string[];
  gameText: string;
}

const need = <T>(table: Record<string, T>, code: unknown, what: string, who: string): T => {
  const v = table[String(code)];
  if (v === undefined) throw new Error(`Unknown ${what} "${String(code)}" for ${who}. Add it to the table in scripts/import-nanoka-kits.ts.`);
  return v;
};

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Game text with its markup turned into plain words. Exported for the tests. */
export function plainText(raw: string, who: string): string {
  let t = raw
    .replace(/<color=[^>]*>|<\/color>/g, '')
    .replace(/<IconMap:([A-Za-z_]+)>/g, (_m, icon: string) => `[${need(ICON, icon, 'button icon', who)}]`)
    .replace(/\{LAYOUT_[A-Z]+#[^}]*\}(?=\{LAYOUT_)/g, '')
    .replace(/\{LAYOUT_FALLBACK#([^}]*)\}/g, '$1')
    .replace(/\{CAL:([0-9.]+)\+AvatarSkillLevel\((\d+)\)\*([0-9.]+),(\d+),\d+\}/g, (_m, a: string, n: string, b: string, mult: string) => {
      const scale = (x: string) => String(Number((Number(x) * Number(mult)).toPrecision(10)));
      return `(${scale(a)} + ${scale(b)} × ${need(SKILL_LEVEL, n, 'skill level in a formula', who)} level)`;
    });
  t = t.replace(/[ \t]+\n/g, '\n').trim();
  const left = /<[^>]+>|\{[^}]*\}/.exec(t);
  if (left) throw new Error(`Unrecognised markup "${left[0]}" for ${who}. Teach plainText in scripts/import-nanoka-kits.ts.`);
  return t;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

interface Detail {
  name: string;
  weapon_type: Record<string, string>;
  element_type: Record<string, string>;
  camp: Record<string, string>;
  stats: { tags: string[] };
  skill: Record<string, { description: { name: string; desc?: string; potential?: number[] }[] }>;
  passive: { level: Record<string, { level: number; name: string[]; desc: string[]; potential: number[] }> };
  talent: Record<string, { level: number; name: string; desc: string }>;
  potential: unknown[];
}

const detail = (id: string) => getJson<Detail>(`${BASE}/${VERSION}/en/character/${id}.json`);

function profileOf(id: string, d: Detail) {
  const who = `${d.name} (${id})`;
  const assist = d.stats.tags.filter((t) => t.startsWith('AidType'));
  if (assist.length !== 1) throw new Error(`${who}: expected one assist type tag, found ${assist.join(', ') || 'none'}.`);
  const [type] = Object.keys(d.weapon_type);
  const [element] = Object.keys(d.element_type);
  const faction = Object.values(d.camp)[0];
  if (!faction) throw new Error(`${who}: no faction.`);
  return {
    characterId: id,
    specialty: need(ZZZ_TYPE, type, 'specialty', who),
    attribute: need(ZZZ_ELEMENT, element, 'attribute', who),
    faction,
    assistType: need(ASSIST, assist[0], 'assist type', who),
  };
}

function kitOf(id: string, d: Detail, beta: boolean) {
  const who = `${d.name} (${id})`;
  if (d.potential.length) throw new Error(`${who} has Agent Potential, which this importer does not read yet. Teach it before adding this character to a group.`);
  const pieces: Piece[] = [];
  const seen = new Set<string>();
  const add = (p: Piece) => {
    if (seen.has(p.id)) throw new Error(`${who}: two pieces with the id ${p.id}.`);
    seen.add(p.id);
    pieces.push(p);
  };

  for (const group of SKILL_GROUPS) {
    const entries = d.skill[group]?.description ?? [];
    for (const e of entries) {
      if (e.desc === undefined) continue; // number tables, not text
      if (e.potential?.length) throw new Error(`${who}: skill "${e.name}" depends on Agent Potential.`);
      const id = `skill-${slug(e.name)}`;
      if (seen.has(id)) continue; // the game lists some skills twice (once per tab)
      add({ id, label: e.name, kind: 'skill', does: [], gameText: plainText(e.desc, who) });
    }
  }

  // Core Passive and Additional Ability: the text at the highest Core Skill level (7).
  const levels = Object.values(d.passive.level);
  const top = levels.reduce((a, b) => (b.level > a.level ? b : a));
  if (top.name.length !== 2 || top.desc.length !== 2) throw new Error(`${who}: expected a Core Passive and an Additional Ability.`);
  const [coreName = '', addName = ''] = top.name;
  const [coreText = '', addText = ''] = top.desc;
  if (!coreName.startsWith('Core Passive') || !addName.startsWith('Additional Ability')) throw new Error(`${who}: unexpected passive names.`);
  add({ id: 'core-passive', label: `${coreName} (Core Skill level ${top.level})`, kind: 'core', does: [], gameText: plainText(coreText, who) });
  add({ id: 'additional-ability', label: addName, kind: 'additional', does: [], gameText: plainText(addText, who) });

  for (let m = 1; m <= 6; m++) {
    const t = d.talent[String(m)];
    if (!t) throw new Error(`${who}: Mindscape ${m} is missing.`);
    add({ id: `mindscape-${m}`, label: `Mindscape ${m}: ${t.name}`, kind: 'mindscape', unlock: { dupes: m }, does: [], gameText: plainText(t.desc, who) });
  }

  return { characterId: id, source: 'nanoka.cc', version: VERSION, ...(beta ? { beta: true } : {}), skills: pieces };
}

const manifest = await getJson<{ zzz: { latest: string; live: string } }>(MANIFEST);
if (manifest.zzz.latest !== VERSION) console.warn(`Note: nanoka.cc now has ZZZ ${manifest.zzz.latest}; this script reads ${VERSION}. Update VERSION after checking the new text.`);
const live = await getJson<Record<string, unknown>>(`${BASE}/${manifest.zzz.live}/character.json`);
const all = await getJson<Record<string, unknown>>(`${BASE}/${VERSION}/character.json`);

const ids = Object.keys(all).sort((a, b) => Number(a) - Number(b));
const wanted = new Set(Object.values(GROUPS).flat());
const profiles = [];
const kits = [];
for (const id of ids) {
  const d = await detail(id);
  profiles.push(profileOf(id, d));
  if (wanted.has(id)) kits.push(kitOf(id, d, !(id in live)));
}
for (const id of wanted) if (!(id in all)) throw new Error(`Group character ${id} is not in nanoka.cc's ${VERSION} list.`);

const out = (file: string, data: unknown) => writeFileSync(resolve(ROOT, 'src/games/zzz/data', file), `${JSON.stringify(data, null, 2)}\n`);
out('profiles.json', profiles);
out('kits.json', kits);
console.log(`zzz: ${profiles.length} profiles, kit text for ${kits.length} characters (groups ${Object.keys(GROUPS).join(', ')})`);
