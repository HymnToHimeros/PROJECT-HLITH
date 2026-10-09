/**
 * Fills the built-in character lists from nanoka.cc's public data files
 * (used with the site owner's permission). Run: npm run data:nanoka
 *
 * Only facts the files contain are written: id, name, rarity, element, role,
 * release date (HSR). Codes are mapped through the tables below; an unknown
 * code stops the script instead of being guessed. Ids are the game's own, so
 * they never change and nobody's progress is orphaned.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SOURCES = {
  hsr: 'https://static.nanoka.cc/hsr/4.6.51/character.json',
  zzz: 'https://static.nanoka.cc/zzz/3.3.4+19304006/character.json',
};

// HSR: path codes → src/games/hsr roles, damage types → elements.
const HSR_PATH: Record<string, string> = {
  Warrior: 'destruction',
  Rogue: 'hunt',
  Mage: 'erudition',
  Shaman: 'harmony',
  Warlock: 'nihility',
  Knight: 'preservation',
  Priest: 'abundance',
  Memory: 'remembrance',
  Elation: 'elation',
};
const HSR_ELEMENT: Record<string, string> = {
  Physical: 'physical',
  Fire: 'fire',
  Ice: 'ice',
  Thunder: 'lightning',
  Wind: 'wind',
  Quantum: 'quantum',
  Imaginary: 'imaginary',
};
const HSR_PATH_LABEL: Record<string, string> = {
  destruction: 'Destruction',
  preservation: 'Preservation',
  harmony: 'Harmony',
  remembrance: 'Remembrance',
  elation: 'Elation',
};

// ZZZ: specialty and attribute codes. 204/300 confirmed by the agents' level-up
// chips in nanoka's detail files (Windbite / Lumiflux Chips).
const ZZZ_TYPE: Record<number, string> = { 1: 'attack', 2: 'stun', 3: 'anomaly', 4: 'support', 5: 'defense', 6: 'rupture', 7: 'armorer' };
const ZZZ_ELEMENT: Record<number, string> = { 200: 'physical', 201: 'fire', 202: 'ice', 203: 'electric', 204: 'windbite', 205: 'ether', 300: 'lumiflux' };

interface Out {
  id: string;
  name: string;
  rarity: 'top' | 'mid';
  element: string;
  role: string;
  releasedAt?: string;
  source: string;
}

const need = <T>(table: Record<string | number, T>, code: string | number, what: string, who: string): T => {
  const v = table[code];
  if (v === undefined) throw new Error(`Unknown ${what} code "${String(code)}" for ${who}. Add it to the table in scripts/import-nanoka.ts.`);
  return v;
};

async function getJson(url: string): Promise<Record<string, Record<string, unknown>>> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return (await res.json()) as Record<string, Record<string, unknown>>;
}

async function hsr(): Promise<Out[]> {
  const data = await getJson(SOURCES.hsr);
  return Object.entries(data).map(([id, c]) => {
    const role = need(HSR_PATH, String(c.baseType), 'path', id);
    let name = String(c.en);
    // The Trailblazer's name is the player's choice; odd ids are Caelus, even Stelle.
    if (name === '{NICKNAME}') name = `Trailblazer · ${HSR_PATH_LABEL[role] ?? role} (${Number(id) % 2 ? 'Caelus' : 'Stelle'})`;
    const out: Out = {
      id,
      name,
      rarity: String(c.rank).endsWith('5') ? 'top' : 'mid',
      element: need(HSR_ELEMENT, String(c.damageType), 'element', id),
      role,
      source: 'nanoka.cc',
    };
    if (typeof c.release === 'number') out.releasedAt = new Date(c.release * 1000).toISOString();
    return out;
  });
}

async function zzz(): Promise<Out[]> {
  const data = await getJson(SOURCES.zzz);
  return Object.entries(data).map(([id, c]) => ({
    id,
    name: String(c.en),
    rarity: c.rank === 4 ? ('top' as const) : ('mid' as const),
    element: need(ZZZ_ELEMENT, Number(c.element), 'attribute', id),
    role: need(ZZZ_TYPE, Number(c.type), 'specialty', id),
    source: 'nanoka.cc',
  }));
}

for (const [game, load] of [
  ['hsr', hsr],
  ['zzz', zzz],
] as const) {
  const list = (await load()).sort((a, b) => Number(a.id) - Number(b.id));
  writeFileSync(resolve(ROOT, `src/games/${game}/data/characters.json`), `${JSON.stringify(list, null, 2)}\n`);
  console.log(`${game}: ${list.length} characters`);
}
