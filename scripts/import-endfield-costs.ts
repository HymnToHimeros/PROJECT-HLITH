/**
 * Endfield level-up costs (E7): what every operator needs to max, from endfield.wiki.gg (CC BY-SA 4.0),
 * cited per operator with the page revision. `npm run data:endfield-costs` (`-- --dry` prints instead of writing).
 *
 * - Levels 1→90: EXP and T-Creds per level, and the EXP items, from the Operator page (same for every operator).
 * - Promotions I–IV: the wiki's AbilityMatrixUpgrades table, checked against each page's own `e1`…`e4`.
 * - Combat skills 2→12, attribute increases, talents, base skills and gear outfitting: each operator's page.
 * - Weapons: tuning stages 1–4 from each weapon's page (`Weapon data` t1…t4), checked against the Weapon page's
 *   Tuning table; weapon EXP and T-Creds from the Weapon page, which gives them only as totals at levels 20,
 *   40, 60, 80 and 90 (no per-level table), so a range between those levels is reported as partial.
 * - Items: the Items table (id, name, type, picture). Sanity per run and amounts per run aren't on the wiki,
 *   so they stay empty ("No data yet").
 * Nothing is guessed: an item name the Items table doesn't know stops the import, and so does any disagreement
 * between wiki sources that has no ruling in RULINGS (MANAGER / the owner decide, per case). Ruled ones are
 * listed in `conflicts` with their ruling.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { json, page, pagesById, templates, WIKI } from './import-endfield-kits.ts';

const ROOT = resolve(import.meta.dirname, '..');
const OUT_COSTS = resolve(ROOT, 'src/games/endfield/data/costs.json');
const OUT_MATERIALS = resolve(ROOT, 'src/games/endfield/data/materials.json');
const dry = process.argv.includes('--dry');

/**
 * Rulings on disagreements between wiki sources, given by MANAGER / the owner (never by the import).
 * Key: the conflict's id as the import names it. `use`: which source wins.
 */
export const RULINGS: Record<string, { use: 'operator-pages' | 'operator-page' | 'table' | 'page'; by: string; on: string; note?: string }> = {
  // The Operator page states 1,800 twice (its Gearing list, and the Cost Summary that only adds up with 1,800);
  // the 1,600 on the operator pages is one shared template value, so it counts as one source.
  'outfitting-t-creds': { use: 'operator-page', by: 'MANAGER', on: '2026-10-15', note: 'unverified in game; the owner may correct it. Sources: endfield.wiki.gg/wiki/Operator (Gearing, Cost Summary) and each operator page (Operator talent cost)' },
};

/** A value for a Cargo `where` clause in single quotes: backslashes first, then quotes. */
export const cargoString = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

export type Items = Record<string, number>;
export interface Track {
  id: string;
  label: string;
  max: number;
  /** Level (or rank) → what reaching it costs, by item name. */
  steps: Record<string, Items>;
}
export interface OperatorCosts {
  source: string;
  version: string;
  promotions: { atLevel: number; items: Items }[];
  tracks: Track[];
}

/** "Protoprism x5, T-Creds x1000" → { Protoprism: 5, T-Creds: 1000 }; "-" or empty → null. */
export function costList(raw: string): Items | null {
  const s = raw.trim();
  if (!s || s === '-') return null;
  const out: Items = {};
  for (const part of s.split(',')) {
    const m = /^\s*(.+?)\s+x\s*([\d,]+)\s*$/.exec(part);
    if (!m?.[1] || !m[2]) throw new Error(`cost "${part}" isn't "Name xN"`);
    out[m[1]] = (out[m[1]] ?? 0) + Number(m[2].replace(/,/g, ''));
  }
  return out;
}

/** "a; b; -; -;" → the four slots (Elite 1–4), null where the slot is "-". */
export const slots = (raw: string): (Items | null)[] =>
  raw
    .split(';')
    .slice(0, 4)
    .map((x) => costList(x));

/** A track from slots: each filled slot is the next rank (1, 2, …). */
function ranked(id: string, label: string, raw: string | undefined): Track | null {
  const filled = slots(raw ?? '').filter((x): x is Items => x !== null);
  if (!filled.length) return null;
  return { id, label, max: filled.length, steps: Object.fromEntries(filled.map((items, i) => [String(i + 1), items])) };
}

/** "Name,6" → [Name, 6]. */
function pair(raw: string): [string, number] {
  const m = /^\s*(.+?)\s*,\s*([\d,]+)\s*$/.exec(raw);
  if (!m?.[1] || !m[2]) throw new Error(`skill cost "${raw}" isn't "Name,N"`);
  return [m[1], Number(m[2].replace(/,/g, ''))];
}

/** The four combat skills, levels 2–12, from the page's `Skill upgrade cell`s (2–9 shared, 10–12 per skill). */
export function skillTracks(text: string, who: string): Track[] {
  const cells = templates(text, 'Skill upgrade cell');
  if (!cells.length) throw new Error(`${who}: no Skill upgrade cell on the page`);
  const ids = ['basic-attack', 'battle-skill', 'combo-skill', 'ultimate'];
  const labels = ['Basic Attack', 'Battle Skill', 'Combo Skill', 'Ultimate'];
  const tracks: Track[] = ids.map((id, i) => ({ id, label: labels[i] ?? id, max: 12, steps: {} }));
  for (const c of cells) {
    const level = c.level;
    if (!level) throw new Error(`${who}: a Skill upgrade cell has no level`);
    if (c.skill1) {
      tracks.forEach((t, k) => {
        const items: Items = {};
        for (let j = 1; c[`m${k + 1}${j}`]; j++) {
          const [n, v] = pair(c[`m${k + 1}${j}`] ?? '');
          items[n] = (items[n] ?? 0) + v;
        }
        t.steps[level] = items;
      });
    } else {
      const items: Items = {};
      for (let j = 1; c[`m${j}`]; j++) {
        const [n, v] = pair(c[`m${j}`] ?? '');
        items[n] = (items[n] ?? 0) + v;
      }
      for (const t of tracks) t.steps[level] = { ...items };
    }
  }
  const levels = Object.keys(tracks[0]?.steps ?? {}).map(Number);
  if (levels.length !== 11 || Math.min(...levels) !== 2 || Math.max(...levels) !== 12) throw new Error(`${who}: skill levels ${levels.join(', ')}, expected 2–12`);
  return tracks;
}

/** Attribute increase, talents, base skills and gear outfitting from the page's `Operator talent cost` templates. */
export function nodeTracks(text: string): Track[] {
  const out: Track[] = [];
  for (const t of templates(text, 'Operator talent cost')) {
    const add = (x: Track | null) => x && out.push(x);
    if (t.type === 'Talent') {
      add(ranked('attribute', 'Attribute Increase', t.acost));
      add(ranked('talent-1', 'Talent 1', t.tcost1));
      add(ranked('talent-2', 'Talent 2', t.tcost2));
      add(ranked('outfitting', 'Gear Outfitting', t.gcost));
    } else if (t.type === 'Base Skill') {
      add(ranked('base-skill-1', 'Base Skill 1', t.bscost1));
      add(ranked('base-skill-2', 'Base Skill 2', t.bscost2));
    }
  }
  return out;
}

/** The page's own promotion costs (`e1`…`e4` of `Operator data`), to check the table against. */
export function pagePromotions(text: string): (Items | null)[] {
  const d = templates(text, 'Operator data')[0] ?? {};
  return [1, 2, 3, 4].map((n) => costList(d[`e${n}`] ?? ''));
}

/** The Operator page's level table: EXP and T-Creds to reach each level from the one before. */
export function levelTable(text: string): { exp: number[]; creds: number[] } {
  const exp: number[] = [0, 0];
  const creds: number[] = [0, 0];
  const row = /^\|\s*(\d+)\s*\|\|\s*([\d,]+)\s*\|\|\s*[\d,]+\s*\|\|\s*([\d,]+)\s*\|\|\s*[\d,]+\s*$/gm;
  for (let m = row.exec(text); m; m = row.exec(text)) {
    const level = Number(m[1]);
    if (level !== exp.length) throw new Error(`level table: expected level ${exp.length}, found ${level}`);
    exp.push(Number((m[2] ?? '').replace(/,/g, '')));
    creds.push(Number((m[3] ?? '').replace(/,/g, '')));
  }
  if (exp.length !== 91) throw new Error(`level table ends at level ${exp.length - 1}, expected 90`);
  return { exp, creds };
}

/** "{{I|Advanced Combat Record|gridview=false}} provide 10,000 Operator EXP" → the EXP each item gives. */
export function expItems(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  const re = /\{\{I\|([^|}]+)\|[^}]*\}\}\s*provide\s*([\d,]+)\s*Operator EXP/g;
  for (let m = re.exec(text); m; m = re.exec(text)) if (m[1] && m[2]) out[m[1]] = Number(m[2].replace(/,/g, ''));
  return out;
}

/** "Promotion II: … and Operator Level 40 …" → the level each promotion needs. */
export function promotionLevels(text: string): number[] {
  const out: number[] = [];
  const re = /Promotion (I{1,3}|IV):[^\n]*?Operator Level (\d+)/g;
  for (let m = re.exec(text); m; m = re.exec(text)) out.push(Number(m[2]));
  if (out.length !== 4) throw new Error(`Operator page: ${out.length} promotion levels, expected 4`);
  return out;
}

/** The Operator page's "Cost Summary": single-item totals to max one operator (talents excluded), for the tests. */
export function costSummary(text: string): Items {
  const at = text.indexOf('===Cost Summary===');
  if (at < 0) throw new Error('Operator page: no Cost Summary');
  const block = text.slice(at, text.indexOf('==', at + 20) > 0 ? text.indexOf('\n==', at + 20) : undefined);
  const out: Items = {};
  for (const line of block.split('\n').filter((l) => l.startsWith('*'))) {
    // "A or B": the first reading is the one with only the top item.
    const first = line.split(/\bor\b/)[0] ?? '';
    for (const m of first.matchAll(/\{\{I\|([^|}]+)\|([\d,]+)\|[^}]*\}\}/g)) if (m[1] && m[2]) out[m[1]] = Number(m[2].replace(/,/g, ''));
  }
  return out;
}

const DROP_RATE: Record<string, string> = { '1': 'fixed drop', '2': 'common', '3': 'uncommon', '4': 'rare', '5': 'very rare', '6': 'random' };

/** Wiki links and item templates → their words; anything else left over stops the import. */
function words(raw: string, who: string): string {
  const s = raw
    .replace(/\{\{I\|([^|}]+)(\|[^}]*)?\}\}/g, '$1')
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (/\{\{|\}\}|\[\[|<\/?[a-z]/i.test(s)) throw new Error(`${who}: markup left in "${s}"`);
  return s;
}

/**
 * An item page's "Acquisition" section → one line per place: the top-level bullets, and each Protocol Space
 * drop row as "<stage> (<Sanity> Sanity, <drop rate>)". Sub-bullets (exchange prices) are left out; repeats once.
 */
export function acquisition(text: string, who: string): string[] {
  const at = text.indexOf('==Acquisition==');
  if (at < 0) return [];
  const end = text.indexOf('\n==', at + 15);
  const section = text.slice(at + 15, end < 0 ? undefined : end);
  const out: string[] = [];
  for (const line of section.split('\n')) {
    const drop = /^\{\{Drop cell\|([^|}]+)\|(\d+)\|?(\d*)/.exec(line.trim());
    if (drop?.[1]) {
      const rate = drop[3] ? DROP_RATE[drop[3]] : undefined;
      out.push(`${words(drop[1], who)} (${drop[2]} Sanity${rate ? `, ${rate}` : ''})`);
      continue;
    }
    const bullet = /^\*(?!\*)\s*(.+)$/.exec(line);
    if (!bullet?.[1]) continue;
    const s = words(bullet[1], who);
    // "Protocol Spaces:" only introduces the drop table below it.
    if (s && !/:\s*$/.test(s)) out.push(s.replace(/\.$/, ''));
  }
  return [...new Set(out)];
}

/** "{{I|Cast Die|5}} {{I|T-Creds|2200}}" → { Cast Die: 5, T-Creds: 2200 }. */
export function itemTemplates(raw: string): Items {
  const out: Items = {};
  for (const m of raw.matchAll(/\{\{I\|([^|}]+)\|([\d,]+)(?:\|[^}]*)?\}\}/g)) if (m[1] && m[2]) out[m[1]] = (out[m[1]] ?? 0) + Number(m[2].replace(/,/g, ''));
  return out;
}

/** A weapon page's tuning costs, stages 1–4 (`Weapon data` t1…t4). */
export function weaponTunings(text: string, who: string): Items[] {
  const d = templates(text, 'Weapon data')[0];
  if (!d) throw new Error(`${who}: no Weapon data on the page`);
  return [1, 2, 3, 4].map((k) => {
    const items = itemTemplates(d[`t${k}`] ?? '');
    if (!Object.keys(items).length) throw new Error(`${who}: no tuning cost t${k}`);
    return items;
  });
}

/**
 * The Weapon page: its Tuning table (the level cap after each stage, and each stage's cost; stage 4 lists only its
 * shared items, then "16x Rare Progression Material, 8x Minerals" that differ per weapon), the cumulative EXP and
 * T-Creds at levels 20/40/60/80/90, and what each EXP item gives.
 */
export function weaponPage(text: string): { caps: number[]; stages: Items[]; specific: number[]; milestones: { level: number; exp: number; creds: number }[]; expPer: Record<string, number> } {
  const at = text.indexOf('===Tuning===');
  if (at < 0) throw new Error('Weapon page: no Tuning section');
  const table = text.slice(at, text.indexOf('|}', at));
  const rows = [...table.matchAll(/\|\s*Stage (\d)\s*\n\|\s*(\d+)\s*\n\|\s*([^\n]*)/g)];
  if (rows.length !== 5) throw new Error(`Weapon page: ${rows.length} tuning rows, expected 5`);
  const caps = rows.map((r) => Number(r[2]));
  const stages = rows.slice(1).map((r) => itemTemplates(r[3] ?? ''));
  const specific = [...(rows[4]?.[3] ?? '').matchAll(/(\d+)x\s+[A-Za-z]/g)].map((m) => Number(m[1]));
  const milestones = [...text.matchAll(/\* Level (\d+): ([\d,]+) EXP and ([\d,]+) T-Creds/g)].map((m) => ({ level: Number(m[1]), exp: Number((m[2] ?? '').replace(/,/g, '')), creds: Number((m[3] ?? '').replace(/,/g, '')) }));
  if (milestones.length !== 5) throw new Error(`Weapon page: ${milestones.length} level totals, expected 5`);
  const expPer: Record<string, number> = {};
  for (const m of text.matchAll(/\{\{I\|([^|}]+)\|[^}]*\}\}\s*provide\s*([\d,]+)\s*Weapon EXP/g)) if (m[1] && m[2]) expPer[m[1]] = Number(m[2].replace(/,/g, ''));
  return { caps, stages, specific, milestones, expPer };
}

/** Does a weapon's stage 4 match the shared part and the count of weapon-specific items (16 and 8)? */
export function sameStage4(own: Items, shared: Items, specific: number[]): boolean {
  const rest = Object.entries(own).filter(([n]) => !(n in shared));
  return Object.entries(shared).every(([n, v]) => own[n] === v) && JSON.stringify(rest.map(([, v]) => v).sort((a, b) => b - a)) === JSON.stringify([...specific].sort((a, b) => b - a));
}

interface ItemRow {
  Item?: string;
  Id?: string;
  Image?: string;
  Type?: string;
}

async function itemsNamed(names: string[]): Promise<Map<string, ItemRow>> {
  const out = new Map<string, ItemRow>();
  for (let i = 0; i < names.length; i += 40) {
    const list = names
      .slice(i, i + 40)
      .map(cargoString)
      .join(',');
    const q = new URLSearchParams({ action: 'cargoquery', format: 'json', limit: '500', tables: 'Items', fields: 'Item,Id,Image,Type', where: `Item IN (${list})` });
    const d = await json<{ cargoquery?: { title: ItemRow }[] }>(`${WIKI}/api.php?${q}`);
    for (const { title } of d.cargoquery ?? []) if (title.Item) out.set(title.Item, title);
  }
  return out;
}

/** Weapon id → its wiki page (the Weapons Cargo table). */
async function weaponPagesById(): Promise<Map<string, string>> {
  const q = new URLSearchParams({ action: 'cargoquery', format: 'json', limit: '500', tables: 'Weapons', fields: 'Weapon,Id' });
  const d = await json<{ cargoquery?: { title: { Weapon?: string; Id?: string } }[] }>(`${WIKI}/api.php?${q}`);
  return new Map((d.cargoquery ?? []).flatMap(({ title: r }) => (r.Id && r.Weapon ? [[r.Id, r.Weapon.trim()]] : [])));
}

async function promotionTable(): Promise<Map<string, Items[]>> {
  const out = new Map<string, Items[]>();
  for (let offset = 0; ; offset += 500) {
    const q = new URLSearchParams({ action: 'cargoquery', format: 'json', limit: '500', offset: String(offset), tables: 'AbilityMatrixUpgrades', fields: 'Operator,NodeName,Item1,Count1,Item2,Count2,Item3,Count3,Item4,Count4,Item5,Count5' });
    const d = await json<{ cargoquery?: { title: Record<string, string> }[] }>(`${WIKI}/api.php?${q}`);
    const rows = d.cargoquery ?? [];
    for (const { title: r } of rows) {
      const n = ['Promotion I', 'Promotion II', 'Promotion III', 'Promotion IV'].indexOf(r.NodeName ?? '');
      if (n < 0 || !r.Operator) continue;
      const items: Items = {};
      for (let k = 1; k <= 5; k++) if (r[`Item${k}`]) items[r[`Item${k}`] ?? ''] = Number((r[`Count${k}`] ?? '0').replace(/,/g, ''));
      const list = out.get(r.Operator.trim()) ?? [];
      list[n] = items;
      out.set(r.Operator.trim(), list);
    }
    if (rows.length < 500) return out;
  }
}

const same = (a: Items | null | undefined, b: Items | null | undefined) => JSON.stringify(Object.entries(a ?? {}).sort()) === JSON.stringify(Object.entries(b ?? {}).sort());
const show = (x: Items | null | undefined) => (x ? Object.entries(x).map(([k, v]) => `${k} x${v}`).join(', ') : '-');

if (import.meta.main ?? process.argv[1]?.endsWith('import-endfield-costs.ts')) {
  const characters = JSON.parse(readFileSync(resolve(ROOT, 'src/games/endfield/data/characters.json'), 'utf8')) as { id: string; name: string }[];
  const pages = await pagesById();
  const general = await page('Operator');
  const table = await promotionTable();
  const levels = levelTable(general.text);
  const expPer = expItems(general.text);
  const atLevels = promotionLevels(general.text);
  const conflicts: string[] = [];
  const unruled: string[] = [];
  const notes: string[] = [];
  /** A disagreement: ruled → listed with its ruling; not ruled → collected, and the import stops at the end. */
  const conflict = (id: string, text: string) => {
    const r = RULINGS[id];
    if (r) conflicts.push(`${text} Ruling (${r.by}, ${r.on}): use the ${r.use.replace('-', ' ')}${r.note ? ` (${r.note})` : ''}.`);
    else unruled.push(`[${id}] ${text}`);
    return r?.use;
  };
  const operators: Record<string, OperatorCosts> = {};
  const cache = new Map<string, { text: string; revid: number }>();
  for (const c of characters) {
    const title = pages.get(c.id);
    if (!title) {
      notes.push(`${c.name} (${c.id}): no wiki page in the Operators table, left out`);
      continue;
    }
    if (!cache.has(title)) cache.set(title, await page(title));
    const p = cache.get(title) as { text: string; revid: number };
    if (!templates(p.text, 'Skill upgrade cell').length) {
      notes.push(`${c.name}: no skill costs on the page yet, left out`);
      continue;
    }
    const fromPage = pagePromotions(p.text);
    const fromTable = table.get(title) ?? [];
    const promotions = atLevels.map((atLevel, i) => {
      const t = fromTable[i];
      const own = fromPage[i];
      if (!t && !own) throw new Error(`${c.name}: no cost for Promotion ${i + 1}`);
      if (t && own && !same(t, own)) {
        const use = conflict(`promotion:${c.id}:${i + 1}`, `${c.name}, Promotion ${i + 1}: the AbilityMatrixUpgrades table says ${show(t)}; the page says ${show(own)}.`);
        return { atLevel, items: (use === 'page' ? own : t) as Items };
      }
      return { atLevel, items: (t ?? own) as Items };
    });
    operators[c.id] = {
      source: `endfield.wiki.gg/wiki/${title.replace(/ /g, '_')} (CC BY-SA 4.0)`,
      version: `wiki revision ${p.revid}`,
      promotions,
      tracks: [...skillTracks(p.text, c.name), ...nodeTracks(p.text)],
    };
  }

  // The Operator page's own list of outfitting costs, compared with each operator's page.
  const outfitting = [...general.text.matchAll(/Outfitting (I{1,3}) \([A-Za-z]+\): \{\{I\|T-Creds\|([\d,]+)/g)].map((m) => Number((m[2] ?? '').replace(/,/g, '')));
  if (outfitting.length !== 3) throw new Error(`Operator page: ${outfitting.length} Gear Outfitting costs, expected 3`);
  const outOf = (o: OperatorCosts) => o.tracks.find((t) => t.id === 'outfitting');
  const differ = Object.values(operators).filter((o) => [1, 2, 3].some((r) => outOf(o)?.steps[String(r)]?.['T-Creds'] !== outfitting[r - 1]));
  if (differ.length) {
    const own = [...new Set(differ.map((o) => [1, 2, 3].map((r) => outOf(o)?.steps[String(r)]?.['T-Creds']).join(' / ')))];
    const use = conflict('outfitting-t-creds', `Gear Outfitting I–III: ${differ.length} operator pages say T-Creds ${own.join(' or ')}; the Operator page says ${outfitting.join(' / ')}.`);
    if (use === 'operator-page')
      for (const o of differ) {
        const t = outOf(o);
        if (t) [1, 2, 3].forEach((r) => (t.steps[String(r)] = { ...t.steps[String(r)], 'T-Creds': outfitting[r - 1] ?? 0 }));
      }
  }
  // Weapons: each weapon page's tuning, checked against the Weapon page's Tuning table.
  const weaponGeneral = await page('Weapon');
  const wp = weaponPage(weaponGeneral.text);
  const weaponList = JSON.parse(readFileSync(resolve(ROOT, 'src/games/endfield/data/weapons.json'), 'utf8')) as { id: string; name: string }[];
  const weaponPages = await weaponPagesById();
  const weapons: Record<string, { source: string; version: string; tunings: { atLevel: number; items: Items }[] }> = {};
  for (const w of weaponList) {
    const title = weaponPages.get(w.id);
    if (!title) {
      notes.push(`${w.name} (${w.id}): no wiki page in the Weapons table, left out`);
      continue;
    }
    const p = await page(title);
    const own = weaponTunings(p.text, w.name);
    const tunings = own.map((items, i) => {
      const shared = wp.stages[i] ?? {};
      const ok = i < 3 ? same(items, shared) : sameStage4(items, shared, wp.specific);
      if (!ok) {
        const use = conflict(`weapon-tuning:${w.id}:${i + 1}`, `${w.name}, Tuning Stage ${i + 1}: the weapon page says ${show(items)}; the Weapon page's Tuning table says ${show(shared)}${i === 3 ? ` plus ${wp.specific.join(' and ')} weapon-specific items` : ''}.`);
        if (use === 'operator-page') throw new Error(`weapon-tuning:${w.id}:${i + 1}: rule it "page" (the weapon page) or "table"`);
        return { atLevel: wp.caps[i] ?? 0, items: use === 'table' && i < 3 ? shared : items };
      }
      return { atLevel: wp.caps[i] ?? 0, items };
    });
    weapons[w.id] = { source: `endfield.wiki.gg/wiki/${title.replace(/ /g, '_')} (CC BY-SA 4.0)`, version: `wiki revision ${p.revid}`, tunings };
  }
  if (unruled.length) throw new Error(`wiki sources disagree, and nobody has ruled yet (add a ruling to RULINGS):\n  ${unruled.join('\n  ')}`);

  // Every item named, from the Items table; an unknown name stops the import.
  const names = new Set<string>(Object.keys(expPer));
  names.add('T-Creds');
  const weaponExp = Object.entries(wp.expPer).sort((a, b) => b[1] - a[1])[0];
  if (!weaponExp) throw new Error('Weapon page: Weapon EXP items not found');
  names.add(weaponExp[0]);
  for (const w of Object.values(weapons)) for (const t of w.tunings) for (const n of Object.keys(t.items)) names.add(n);
  for (const o of Object.values(operators)) {
    for (const p of o.promotions) for (const n of Object.keys(p.items)) names.add(n);
    for (const t of o.tracks) for (const s of Object.values(t.steps)) for (const n of Object.keys(s)) names.add(n);
  }
  const rows = await itemsNamed([...names]);
  const missing = [...names].filter((n) => !rows.get(n)?.Id);
  if (missing.length) throw new Error(`items not in the wiki's Items table: ${missing.join(', ')}`);
  const idOf = (n: string) => rows.get(n)?.Id as string;
  const byId = (items: Items): Items => Object.fromEntries(Object.entries(items).map(([n, v]) => [idOf(n), v]));
  for (const o of Object.values(operators)) {
    for (const p of o.promotions) p.items = byId(p.items);
    for (const t of o.tracks) for (const k of Object.keys(t.steps)) t.steps[k] = byId(t.steps[k] ?? {});
  }
  for (const w of Object.values(weapons)) for (const t of w.tunings) t.items = byId(t.items);

  // EXP: Combat Records up to level 60, Cognitive Carriers above (the Operator page), counted in the 10,000-EXP ones.
  const top = (family: string) => Object.entries(expPer).filter(([n]) => n.includes(family)).sort((a, b) => b[1] - a[1])[0];
  const records = top('Combat Record');
  const carriers = top('Cognitive Carrier');
  if (!records || !carriers) throw new Error('Operator page: EXP items not found');
  const summary = costSummary(general.text);
  const costs = {
    source: `endfield.wiki.gg/wiki/Operator (CC BY-SA 4.0), wiki revision ${general.revid}; each operator's page; the wiki's AbilityMatrixUpgrades and Items tables`,
    levels: {
      max: 90,
      exp: levels.exp,
      creds: levels.creds,
      credsItem: idOf('T-Creds'),
      expItems: [
        { upTo: 60, item: idOf(records[0]), exp: records[1] },
        { upTo: 90, item: idOf(carriers[0]), exp: carriers[1] },
      ],
    },
    operators,
    weapons: {
      source: `endfield.wiki.gg/wiki/Weapon (CC BY-SA 4.0), wiki revision ${weaponGeneral.revid}; each weapon's page`,
      max: wp.caps[wp.caps.length - 1],
      milestones: wp.milestones,
      expItem: idOf(weaponExp[0]),
      expPer: weaponExp[1],
      credsItem: idOf('T-Creds'),
      list: weapons,
    },
    summary: Object.fromEntries(Object.entries(summary).map(([n, v]) => [idOf(n) ?? n, v])),
    conflicts,
  };
  // Where each item comes from: its own wiki page's Acquisition section.
  const sourcesOf = new Map<string, string[]>();
  for (const n of names) sourcesOf.set(n, acquisition((await page(n)).text, n));
  const materials = [...names]
    .map((n) => rows.get(n) as ItemRow)
    .sort((a, b) => (a.Item ?? '').localeCompare(b.Item ?? ''))
    .map((r) => {
      const sources = sourcesOf.get(r.Item ?? '') ?? [];
      return { id: r.Id, name: r.Item, kind: (r.Type ?? '').replace(/\[\[|\]\]/g, ''), ...(r.Image ? { icon: `${WIKI}/images/${encodeURIComponent(r.Image.replace(/ /g, '_'))}` } : {}), ...(sources.length ? { sources } : {}) };
    });
  if (dry) console.log(JSON.stringify({ costs, materials }, null, 2));
  else {
    writeFileSync(OUT_COSTS, `${JSON.stringify(costs, null, 2)}\n`);
    writeFileSync(OUT_MATERIALS, `${JSON.stringify(materials, null, 2)}\n`);
  }
  console.log(`endfield: costs for ${Object.keys(operators).length} of ${characters.length} operators, ${materials.length} items`);
  for (const n of notes) console.log(`  ${n}`);
  for (const n of conflicts) console.log(`  CONFLICT ${n}`);
}
