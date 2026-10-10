/**
 * Fills HSR kit text from nanoka.cc's public data files (used with the site
 * owner's permission). Run: npm run data:hsr-kits
 *
 * Kit text is added group by group (GROUPS below), never all characters at once.
 * Each kit holds: Basic ATK, Skill, Ultimate, Talent, Technique (and any extra
 * skills the character has), memosprite skills, the three major Traces,
 * Eidolons 1–6, and the Enhanced kit when the game has one (it replaces the base
 * kit for players who have it; `unlock.potential` = 1, the base `replacedAt` 1).
 *
 * Numbers are filled in at each skill's highest level without Eidolons (the
 * skill tree's max level: Basic ATK 6, others 10); Trace and Eidolon numbers are
 * fixed. Markup becomes plain text; anything unrecognised stops the script.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const BASE = 'https://static.nanoka.cc/hsr';
const MANIFEST = 'https://static.nanoka.cc/manifest.json';

const GROUPS: Record<string, string[]> = {
  // Three well-known teams, used as worked examples in docs/logic/hsr-theory.md:
  // follow-up (Feixiao, Topaz, Robin, Aventurine), debuff (Acheron, Jiaoqiu, Pela, Silver Wolf),
  // Super Break (Firefly, Ruan Mei, Harmony Trailblazer ×2, Lingsha).
  A: ['1220', '1112', '1309', '1304', '1308', '1218', '1106', '1006', '1310', '1303', '8005', '8006', '1222'],
};

interface Skill {
  id: number;
  name: string;
  desc: string;
  type: string;
  type_name: string;
  level: Record<string, { level: number; param_list: number[] }>;
}
interface TreePoint {
  point_type: number;
  point_name: string | null;
  point_desc: string | null;
  param_list: number[];
  max_level: number;
  level_up_skill_id: number[];
}
interface Rank {
  name: string;
  desc: string;
  param_list: number[];
}
interface Kitset {
  skills: Record<string, Skill>;
  skill_trees: Record<string, Record<string, TreePoint>>;
  ranks: Record<string, Rank>;
}
interface Detail extends Kitset {
  name: string;
  memosprite: { name?: string; skills?: Record<string, Skill> };
  enhanced: Record<string, Kitset & { descs: string[] }>;
}

interface Piece {
  id: string;
  label: string;
  kind: 'skill' | 'trace' | 'eidolon';
  unlock?: { dupes?: number; potential?: number };
  replacedAt?: { potential: number };
  does: string[];
  gameText: string;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const num = (x: number) => String(Number(x.toPrecision(10)));
/** Names can carry markup too (<unbreak>All-Out</unbreak>). */
const name = (s: string) => s.replace(/<[^>]+>/g, '').trim();

/** Game text with its markup turned into plain words and #n[i] numbers filled in. Exported for the tests. */
export function plainText(raw: string, params: number[], who: string): string {
  let t = raw
    .replace(/\\n/g, '\n')
    .replace(/<\/?(color|unbreak|u|i|b)[^>]*>/g, '')
    .replace(/#(\d+)\[(i|f(\d))\](%?)/g, (_m, n: string, kind: string, digits: string | undefined, pct: string) => {
      const v = params[Number(n) - 1];
      if (v === undefined) throw new Error(`${who}: no number #${n} in "${raw.slice(0, 80)}…"`);
      const shown = pct ? v * 100 : v;
      return `${kind === 'i' ? num(Math.round(shown * 1e6) / 1e6) : shown.toFixed(Number(digits))}${pct}`;
    });
  t = t.replace(/[ \t]+\n/g, '\n').trim();
  const left = /<[^>]+>|#\d+\[|\{[A-Z]/.exec(t);
  if (left) throw new Error(`Unrecognised markup "${left[0]}" for ${who}. Teach plainText in scripts/import-nanoka-hsr-kits.ts.`);
  return t;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** The level a skill's numbers are shown at: its skill-tree max level, else 10, else its highest. */
function levelFor(skill: Skill, trees: Kitset['skill_trees']): number {
  for (const t of Object.values(trees)) {
    const p = t['1'];
    if (p?.level_up_skill_id.includes(skill.id)) return p.max_level;
  }
  const levels = Object.keys(skill.level).map(Number);
  return levels.includes(10) ? 10 : Math.max(...levels);
}

function piecesOf(set: Kitset, memo: Detail['memosprite'] | undefined, who: string, suffix: string): Piece[] {
  const out: Piece[] = [];
  const seen = new Set<string>();
  const add = (p: Piece) => {
    if (seen.has(p.id)) throw new Error(`${who}: two pieces with the id ${p.id}.`);
    seen.add(p.id);
    out.push(p);
  };
  for (const s of Object.values(set.skills)) {
    if (s.type === 'MazeNormal' || s.type_name === 'None' || s.name === 'Attack') continue; // the overworld attack: nothing in battle
    // Separate hits of an Ultimate (Feixiao's Terrasplit, Acheron's Rainblade…) carry no text: the Ultimate's own text describes them.
    if (!s.desc) {
      console.log(`  ${who}: "${s.type_name}: ${s.name}" has no text (part of another skill), skipped`);
      continue;
    }
    const lv = levelFor(s, set.skill_trees);
    const params = s.level[String(lv)]?.param_list ?? [];
    add({ id: `skill-${slug(s.type_name)}-${slug(name(s.name))}${suffix}`, label: `${s.type_name}: ${name(s.name)}${lv > 1 ? ` (Lv. ${lv})` : ''}`, kind: 'skill', does: [], gameText: plainText(s.desc, params, who) });
  }
  for (const s of Object.values(memo?.skills ?? {})) {
    const levels = Object.keys(s.level ?? {}).map(Number);
    const lv = levels.length ? levelFor(s, set.skill_trees) : 1;
    const params = s.level?.[String(lv)]?.param_list ?? [];
    add({ id: `memosprite-${slug(name(s.name))}${suffix}`, label: `${name(memo?.name ?? 'Memosprite')} · ${s.type_name}: ${name(s.name)}${lv > 1 ? ` (Lv. ${lv})` : ''}`, kind: 'skill', does: [], gameText: plainText(s.desc, params, who) });
  }
  // The three major Traces (named, with text); the small stat Traces have no text.
  for (const t of Object.values(set.skill_trees)) {
    const p = t['1'];
    if (!p || p.point_type !== 3 || !p.point_name || !p.point_desc) continue;
    add({ id: `trace-${slug(name(p.point_name))}${suffix}`, label: `Trace: ${name(p.point_name)}`, kind: 'trace', does: [], gameText: plainText(p.point_desc, p.param_list, who) });
  }
  for (let e = 1; e <= 6; e++) {
    const r = set.ranks[String(e)];
    if (!r) throw new Error(`${who}: Eidolon ${e} is missing.`);
    add({ id: `eidolon-${e}${suffix}`, label: `Eidolon ${e}: ${name(r.name)}`, kind: 'eidolon', unlock: { dupes: e }, does: [], gameText: plainText(r.desc, r.param_list, who) });
  }
  return out;
}

function kitOf(id: string, d: Detail, version: string) {
  const who = `${d.name} (${id})`;
  const base = piecesOf(d, d.memosprite, who, '');
  const enhanced = d.enhanced['1'];
  if (!enhanced) return { characterId: id, source: 'nanoka.cc', version, skills: base };
  if (Object.keys(d.enhanced).length > 1) throw new Error(`${who}: more than one Enhanced kit.`);
  const extra = piecesOf(enhanced, d.memosprite, who, '-enhanced').map((p) => ({
    ...p,
    label: `${p.label} (Enhanced)`,
    unlock: { ...p.unlock, potential: 1 },
  }));
  return { characterId: id, source: 'nanoka.cc', version, skills: [...base.map((p) => ({ ...p, replacedAt: { potential: 1 } })), ...extra] };
}

const manifest = await getJson<{ hsr: { latest: string; live: string } }>(MANIFEST);
const live = await getJson<Record<string, unknown>>(`${BASE}/${manifest.hsr.live}/character.json`);
const latest = await getJson<Record<string, unknown>>(`${BASE}/${manifest.hsr.latest}/character.json`);
const kits = [];
for (const id of Object.values(GROUPS).flat()) {
  const released = id in live;
  if (!released && !(id in latest)) throw new Error(`Group character ${id} is not in nanoka.cc's HSR lists.`);
  const version = released ? manifest.hsr.live : manifest.hsr.latest;
  const kit = kitOf(id, await getJson<Detail>(`${BASE}/${version}/en/character/${id}.json`), version);
  kits.push(released ? kit : { ...kit, beta: true });
}
kits.sort((a, b) => Number(a.characterId) - Number(b.characterId));
writeFileSync(resolve(ROOT, 'src/games/hsr/data/kits.json'), `${JSON.stringify(kits, null, 2)}\n`);
console.log(`hsr: kit text for ${kits.length} characters (groups ${Object.keys(GROUPS).join(', ')})`);
