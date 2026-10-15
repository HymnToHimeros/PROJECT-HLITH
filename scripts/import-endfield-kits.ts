/**
 * Arknights: Endfield kit text (`npm run data:endfield-kits`), E6a: every listed operator's
 * Basic Attack, Battle Skill, Combo Skill and Ultimate (with their numbers at level 12),
 * talents (their highest Elite text) and Potentials 1–5, read from the operator's page on
 * endfield.wiki.gg (CC BY-SA 4.0, cited on every kit with the page revision).
 *
 *   node scripts/import-endfield-kits.ts          writes src/games/endfield/data/kits.json
 *   node scripts/import-endfield-kits.ts --dry    prints what it would write
 *
 * The wiki keeps each kit in fixed templates ({{Combat skill}}, {{Operator talent}} and the
 * pot1–pot5 fields of {{Operator data}}). Markup becomes plain words; anything not recognised
 * stops the script, so nothing is guessed. Kits are text only here: reading them (tags and
 * proof) is the Kit check's job.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = resolve(ROOT, 'src/games/endfield/data/kits.json');
const WIKI = 'https://endfield.wiki.gg';
const dry = process.argv.includes('--dry');
/** The level whose numbers are written into each skill: the highest (9 + 3 Specializations). */
const LEVEL = 12;

interface KitSkill {
  id: string;
  label: string;
  kind: 'skill' | 'core' | 'potential';
  unlock?: { potential: number };
  does: string[];
  gameText: string;
}
interface Kit {
  characterId: string;
  source: string;
  version: string;
  skills: KitSkill[];
}

async function json<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'user-agent': 'PROJECT-HLITH data import (https://github.com/HymnToHimeros/PROJECT-HLITH)' } });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return (await res.json()) as T;
}

/** The page's current wikitext and revision id. */
async function page(title: string): Promise<{ text: string; revid: number }> {
  const q = new URLSearchParams({ action: 'parse', page: title, prop: 'wikitext|revid', format: 'json', formatversion: '2', redirects: '1' });
  const d = await json<{ parse?: { wikitext: string; revid: number }; error?: { info: string } }>(`${WIKI}/api.php?${q}`);
  if (!d.parse) throw new Error(`wiki page "${title}": ${d.error?.info ?? 'not found'}`);
  return { text: d.parse.wikitext, revid: d.parse.revid };
}

/** Operator id → its wiki page (the Operators Cargo table's Operator field). */
async function pagesById(): Promise<Map<string, string>> {
  const q = new URLSearchParams({ action: 'cargoquery', format: 'json', limit: '500', tables: 'Operators', fields: 'Operator,Id' });
  const d = await json<{ cargoquery?: { title: { Operator?: string; Id?: string } }[] }>(`${WIKI}/api.php?${q}`);
  return new Map((d.cargoquery ?? []).flatMap(({ title: r }) => (r.Id && r.Operator ? [[r.Id, r.Operator.trim()]] : [])));
}

/**
 * The tab each position of the page is in, for pages that show a skill set per tab
 * (`<tabber>Label=…|-|Label=…</tabber>`, e.g. Arcane's Array Arcana: INT / WILL). Undefined = no tab.
 */
function tabAt(text: string): (at: number) => string | undefined {
  const tabs: { from: number; label: string }[] = [];
  const block = /<tabber>([\s\S]*?)<\/tabber>/g;
  for (let m = block.exec(text); m; m = block.exec(text)) {
    const start = m.index + '<tabber>'.length;
    let from = start;
    for (const part of (m[1] ?? '').split('|-|')) {
      // The label starts at its first non-blank character, so the two parts of the pattern never compete.
      const label = /^\s*([^=\s{}|][^=\n{}|]*)=/.exec(part)?.[1]?.trim();
      if (label) tabs.push({ from, label });
      from += part.length + 3;
    }
    tabs.push({ from: m.index + m[0].length, label: '' });
  }
  return (at) => {
    let cur: string | undefined;
    for (const t of tabs) if (t.from <= at) cur = t.label || undefined;
    return cur;
  };
}

/** Every `{{name …}}` call in the text, with its fields (nested templates kept whole) and where it starts. */
export function templates(text: string, name: string): (Record<string, string> & { _at?: string })[] {
  const out: (Record<string, string> & { _at?: string })[] = [];
  const open = new RegExp(`\\{\\{\\s*${name.replace(/ /g, '[ _]')}\\s*(\\||\\}\\})`, 'gi');
  for (let m = open.exec(text); m; m = open.exec(text)) {
    let depth = 0;
    let i = m.index;
    for (; i < text.length - 1; i++) {
      if (text.startsWith('{{', i)) {
        depth++;
        i++;
      } else if (text.startsWith('}}', i)) {
        depth--;
        i++;
        if (depth === 0) break;
      }
    }
    const body = text.slice(m.index + 2, i - 1);
    out.push({ ...fields(body), _at: String(m.index) });
    open.lastIndex = i;
  }
  return out;
}

/** Splits a template body on its top-level `|` into named fields. */
function fields(body: string): Record<string, string> {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2);
    if (two === '{{' || two === '[[') {
      depth++;
      cur += two;
      i++;
    } else if (two === '}}' || two === ']]') {
      depth--;
      cur += two;
      i++;
    } else if (body[i] === '|' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else cur += body[i];
  }
  parts.push(cur);
  const out: Record<string, string> = {};
  for (const p of parts.slice(1)) {
    const eq = p.indexOf('=');
    if (eq > 0) out[p.slice(0, eq).trim()] = p.slice(eq + 1).trim();
  }
  return out;
}

/** Wiki markup → plain words. Throws on anything it doesn't know, so nothing is guessed. */
export function plain(raw: string, who: string): string {
  let t = raw;
  // Templates, innermost first: {{Color|text|n}}, {{G|target|label}}, {{SB|n}}.
  for (let guard = 0; /\{\{/.test(t); guard++) {
    if (guard > 50) throw new Error(`${who}: markup too deep in "${raw.slice(0, 80)}…"`);
    t = t.replace(/\{\{([^{}]*)\}\}/g, (_m, inner: string) => {
      const [name, ...args] = inner.split('|').map((s) => s.trim());
      switch ((name ?? '').toLowerCase()) {
        case 'color':
          return args[0] ?? '';
        case 'g':
          return args[1] ?? args[0] ?? '';
        case 'sb':
          return '';
        default:
          throw new Error(`${who}: unknown template {{${name}}} in "${raw.slice(0, 80)}…"`);
      }
    });
  }
  t = t
    .replace(/\[\[File:[^\]]*\]\]/gi, '')
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;/g, ' ');
  // Formatting tags, removed until none is left (one pass can leave a tag made of the pieces around a removed one).
  for (let prev = ''; prev !== t; ) {
    prev = t;
    t = t.replace(/<\/?(?:b|i|u|small|span)\b[^<>]*>/gi, '');
  }
  if (/[<>]|\{\{|\}\}|\[\[/.test(t)) throw new Error(`${who}: leftover markup in "${t.slice(0, 120)}…"`);
  return t
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

const SKILL_TYPE: Record<string, { id: string; label: string }> = {
  '1': { id: 'basic-attack', label: 'Basic Attack' },
  '2': { id: 'battle-skill', label: 'Battle Skill' },
  '3': { id: 'combo-skill', label: 'Combo Skill' },
  '4': { id: 'ultimate', label: 'Ultimate' },
};
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** One operator page → its kit pieces. */
export function kitFrom(text: string, who: string): KitSkill[] {
  const skills: KitSkill[] = [];
  const tab = tabAt(text);
  for (const s of templates(text, 'Combat skill')) {
    const type = SKILL_TYPE[/\{\{\s*SB\s*\|\s*(\d)/i.exec(s.type ?? '')?.[1] ?? ''];
    const inTab = tab(Number(s._at));
    if (!type) throw new Error(`${who}: combat skill "${s.name}" has no known type (${s.type})`);
    const numbers = Object.keys(s)
      .filter((k) => /^stat\d+$/.test(k))
      .sort((a, b) => Number(a.slice(4)) - Number(b.slice(4)))
      .map((k) => (s[k] ?? '').split(',').map((x) => x.trim()))
      .filter((row) => row.length > 1)
      .map((row) => `${row[0]}: ${row[Math.min(LEVEL, row.length - 1)]}`);
    const desc = plain(s.desc ?? '', `${who} ${type.label}`);
    skills.push({
      id: inTab ? `${type.id}-${slug(inTab)}` : type.id,
      label: `${type.label}: ${plain(s.name ?? '', who)}${inTab ? ` (${inTab})` : ''}`,
      kind: 'skill',
      does: [],
      gameText: numbers.length ? `${desc}\nAt level ${LEVEL}: ${numbers.join('; ')}.` : desc,
    });
  }
  for (const t of templates(text, 'Operator talent')) {
    // Gear unlocks (Outfitting) aren't part of the fight kit.
    if (/gear/i.test(t.icon ?? '')) continue;
    const name = plain(t.name ?? '', who);
    const last = [1, 2, 3, 4, 5, 6]
      .map((n) => ({ cond: t[`cond${n}`]?.trim(), desc: t[`desc${n}`]?.trim() }))
      .filter((x) => x.desc)
      .at(-1);
    if (!last?.desc) continue;
    skills.push({
      id: `talent-${slug(name)}`,
      label: `Talent: ${name}${last.cond ? ` (${last.cond})` : ''}`,
      kind: 'core',
      does: [],
      gameText: plain(last.desc, `${who} talent ${name}`),
    });
  }
  const data = templates(text, 'Operator data')[0] ?? {};
  for (let n = 1; n <= 5; n++) {
    const desc = data[`pot${n}`];
    if (!desc) continue;
    const name = plain(data[`pot${n}t`] ?? '', who);
    skills.push({
      id: `potential-${n}`,
      label: `Potential ${n}${name ? `: ${name}` : ''}`,
      kind: 'potential',
      unlock: { potential: n },
      does: [],
      gameText: plain(desc, `${who} potential ${n}`),
    });
  }
  return skills;
}

if (import.meta.main ?? process.argv[1]?.endsWith('import-endfield-kits.ts')) {
  const characters = JSON.parse(readFileSync(resolve(ROOT, 'src/games/endfield/data/characters.json'), 'utf8')) as { id: string; name: string }[];
  const pages = await pagesById();
  const cache = new Map<string, { text: string; revid: number }>();
  const kits: Kit[] = [];
  const notes: string[] = [];
  for (const c of characters) {
    const title = pages.get(c.id);
    if (!title) {
      notes.push(`${c.name} (${c.id}): no wiki page in the Operators table, left out`);
      continue;
    }
    if (!cache.has(title)) cache.set(title, await page(title));
    const p = cache.get(title) as { text: string; revid: number };
    const skills = kitFrom(p.text, c.name);
    if (!skills.some((s) => s.kind === 'skill')) {
      notes.push(`${c.name}: no combat skills on the page yet, left out`);
      continue;
    }
    kits.push({ characterId: c.id, source: `endfield.wiki.gg/wiki/${title.replace(/ /g, '_')} (CC BY-SA 4.0)`, version: `wiki revision ${p.revid}`, skills });
  }
  const text = `${JSON.stringify(kits, null, 2)}\n`;
  if (dry) console.log(text);
  else writeFileSync(OUT, text);
  console.log(`endfield: kit text for ${kits.length} of ${characters.length} operators`);
  for (const n of notes) console.log(`  ${n}`);
}
