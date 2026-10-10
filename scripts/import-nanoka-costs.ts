/**
 * Fills what each character needs to level up (Farm, the character page's
 * "Materials to max") from nanoka.cc's public data files (used with the site
 * owner's permission). Run: npm run data:costs
 *
 * Mechanical game data, not kit reading, so every character is done at once:
 * - ascension / promotion costs per level cap,
 * - every skill level, Core Skill (ZZZ) and Trace (HSR) cost,
 * - ZZZ Agent EXP per level (nanoka's level table) in Senior Investigator Logs.
 * HSR character EXP per level is not in nanoka.cc's files (nor Yatta's); it is
 * left out and the Farm says so, never guessed.
 *
 * Writes src/games/<game>/data/costs.json and materials.json (every item used).
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const BASE = 'https://static.nanoka.cc';
type Items = Record<string, number>;

interface Costs {
  source: string;
  version: string;
  /** EXP to go from level i+1 to i+2 (index 0 = 1 → 2), and the EXP item counted in. null = not known. */
  exp: { perLevel: number[]; item: string; itemExp: number; source: string } | null;
  characters: Record<string, { promotions: { atLevel: number; items: Items }[]; skills: { id: string; label: string; max: number; steps: Record<string, Items> }[] }>;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

const clean = (items: Record<string, number>): Items => Object.fromEntries(Object.entries(items).filter(([, n]) => n > 0));

// ── ZZZ ──────────────────────────────────────────────────────────────
interface ZzzDetail {
  level: Record<string, { level_max: number; materials: Items }>;
  level_exp: number[];
  skill: Record<string, { material?: Record<string, Items> }>;
  passive: { materials?: Record<string, Items> };
}
const ZZZ_SKILLS: [string, string][] = [
  ['basic', 'Basic Attack'],
  ['dodge', 'Dodge'],
  ['assist', 'Assist'],
  ['special', 'Special Attack'],
  ['chain', 'Chain Attack'],
];
/** Agent EXP items, from their in-game descriptions (100 / 600 / 3,000 EXP; Icy Veins and ONE Esports quote the same). Checked: nanoka's level table totals 900,000 EXP for 1 → 60 = 300 Senior Logs, as Icy Veins says. */
const ZZZ_EXP_ITEM = { item: '300003', itemExp: 3000, source: 'in-game item text (Senior Investigator Log: 3,000 EXP), as quoted by Icy Veins and ONE Esports' };

async function zzz(): Promise<{ costs: Costs; used: Set<string>; names: Map<string, { name: string; kind: string }> }> {
  const manifest = await getJson<{ zzz: { live: string } }>(`${BASE}/manifest.json`);
  const v = manifest.zzz.live;
  const list = await getJson<Record<string, unknown>>(`${BASE}/zzz/${v}/character.json`);
  const items = await getJson<Record<string, { name: string; class: number }>>(`${BASE}/zzz/${v}/en/item.json`);
  const costs: Costs = { source: 'nanoka.cc', version: v, exp: null, characters: {} };
  const used = new Set<string>();
  let expTable: number[] | null = null;
  for (const id of Object.keys(list)) {
    const d = await getJson<ZzzDetail>(`${BASE}/zzz/${v}/en/character/${id}.json`);
    const promotions = Object.values(d.level)
      .map((l) => ({ atLevel: l.level_max, items: clean(l.materials) }))
      .filter((p) => Object.keys(p.items).length > 0);
    const skills = ZZZ_SKILLS.map(([key, label]) => {
      const table = d.skill[key]?.material ?? {};
      // Key k = the cost of going from level k to k + 1.
      const steps = Object.fromEntries(Object.entries(table).flatMap(([k, m]) => (Object.keys(clean(m)).length ? [[String(Number(k) + 1), clean(m)]] : [])));
      return { id: key, label, max: Math.max(1, ...Object.keys(steps).map(Number)), steps };
    });
    const core = d.passive.materials ?? {};
    skills.push({
      id: 'core',
      label: 'Core Skill',
      max: Object.keys(core).length + 1,
      steps: Object.fromEntries(Object.entries(core).map(([k, m]) => [String(Number(k) + 1), clean(m)])),
    });
    costs.characters[id] = { promotions, skills };
    for (const p of promotions) for (const i of Object.keys(p.items)) used.add(i);
    for (const s of skills) for (const m of Object.values(s.steps)) for (const i of Object.keys(m)) used.add(i);
    const table = d.level_exp.filter((x) => x > 0);
    if (!expTable) expTable = table;
    else if (JSON.stringify(expTable) !== JSON.stringify(table)) throw new Error(`zzz ${id}: a different EXP table; the importer assumes one for everyone.`);
  }
  if (expTable) {
    costs.exp = { perLevel: expTable, ...ZZZ_EXP_ITEM };
    used.add(ZZZ_EXP_ITEM.item);
  }
  const KIND: Record<number, string> = { 1: 'currency', 10: 'upgrade', 12: 'exp' };
  const names = new Map([...used].map((i) => {
    const it = items[i];
    if (!it) throw new Error(`zzz: item ${i} is not in nanoka.cc's item list.`);
    return [i, { name: it.name, kind: KIND[it.class] ?? 'material' }];
  }));
  return { costs, used, names };
}

// ── HSR ──────────────────────────────────────────────────────────────
interface HsrDetail {
  stats: Record<string, { cost: { item_id: number; item_num: number }[] }>;
  skill_trees: Record<string, Record<string, { point_type: number; point_name: string | null; max_level: number; material_list: { item_id: number; item_num: number }[]; status_add_list?: { name: string }[] }>>;
  skills: Record<string, { name: string; type_name: string; id: number }>;
}
const HSR_CAPS = [20, 30, 40, 50, 60, 70];

async function hsr(): Promise<{ costs: Costs; names: Map<string, { name: string; kind: string }> }> {
  const manifest = await getJson<{ hsr: { live: string } }>(`${BASE}/manifest.json`);
  const v = manifest.hsr.live;
  const list = await getJson<Record<string, unknown>>(`${BASE}/hsr/${v}/character.json`);
  const items = await getJson<Record<string, { item_name: string; item_sub_type: string }>>(`${BASE}/hsr/${v}/en/item.json`);
  const costs: Costs = { source: 'nanoka.cc', version: v, exp: null, characters: {} };
  const used = new Set<string>();
  const toItems = (l: { item_id: number; item_num: number }[]) => clean(Object.fromEntries(l.map((x) => [String(x.item_id), x.item_num])));
  for (const id of Object.keys(list)) {
    const d = await getJson<HsrDetail>(`${BASE}/hsr/${v}/en/character/${id}.json`);
    const promotions = Object.entries(d.stats)
      .map(([k, s]) => ({ atLevel: HSR_CAPS[Number(k)] ?? 0, items: toItems(s.cost) }))
      .filter((p) => p.atLevel && Object.keys(p.items).length > 0);
    const skills = Object.entries(d.skill_trees).map(([point, levels]) => {
      const first = levels['1'];
      const label = first?.point_name ?? first?.status_add_list?.map((s) => s.name).join(', ') ?? point;
      const steps = Object.fromEntries(Object.entries(levels).flatMap(([lv, p]) => (Object.keys(toItems(p.material_list)).length ? [[lv, toItems(p.material_list)]] : [])));
      // A level-1 entry with a cost means "unlocking it costs this" (Traces): counted from level 0.
      return { id: point, label: label.replace(/<[^>]+>/g, ''), max: Math.max(0, ...Object.keys(levels).map(Number)), steps };
    });
    costs.characters[id] = { promotions, skills: skills.filter((s) => Object.keys(s.steps).length > 0) };
    for (const p of promotions) for (const i of Object.keys(p.items)) used.add(i);
    for (const s of skills) for (const m of Object.values(s.steps)) for (const i of Object.keys(m)) used.add(i);
  }
  const names = new Map([...used].map((i) => {
    const it = items[i];
    if (!it) throw new Error(`hsr: item ${i} is not in nanoka.cc's item list.`);
    return [i, { name: it.item_name, kind: it.item_sub_type === 'Virtual' ? 'currency' : 'upgrade' }];
  }));
  return { costs, names };
}

const write = (game: string, file: string, data: unknown) => writeFileSync(resolve(ROOT, `src/games/${game}/data/${file}`), `${JSON.stringify(data)}\n`);
const materialsOf = (names: Map<string, { name: string; kind: string }>) =>
  [...names].sort(([a], [b]) => Number(a) - Number(b)).map(([id, m]) => ({ id, name: m.name, kind: m.kind }));

const z = await zzz();
write('zzz', 'costs.json', z.costs);
write('zzz', 'materials.json', materialsOf(z.names));
console.log(`zzz: costs for ${Object.keys(z.costs.characters).length} agents, ${z.names.size} materials`);
const h = await hsr();
write('hsr', 'costs.json', h.costs);
write('hsr', 'materials.json', materialsOf(h.names));
console.log(`hsr: costs for ${Object.keys(h.costs.characters).length} characters, ${h.names.size} materials (character EXP: no data yet)`);
