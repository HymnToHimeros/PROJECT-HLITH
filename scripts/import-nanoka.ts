/**
 * Fills the built-in character lists from nanoka.cc's public data files
 * (used with the site owner's permission). Run: npm run data:nanoka
 *
 * Written per character: id, name, rarity, element, role, art and portrait
 * (nanoka's image files, checked to exist), release date, and a leak mark.
 * - Data comes from nanoka's newest build of each game (manifest "latest").
 *   When that build is newer than the live game ("live"), the characters in its
 *   "new" list are not released yet: they get `leak: { source }` and show as
 *   unverified, only when the user asks for leaks.
 * - Release dates: nanoka's own (HSR) where it has one; otherwise the date on
 *   the community wiki's character page (the day its first banner opened), at
 *   noon UTC+8 so the calendar day is the same on every server.
 * Codes are mapped through the tables below; an unknown code stops the script
 * instead of being guessed. Ids are the game's own, so they never change and
 * nobody's progress is orphaned.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fetchWiki, infobox } from './schedule/wiki.ts';

const ROOT = resolve(import.meta.dirname, '..');
const STATIC = 'https://static.nanoka.cc';
const WIKI = { hsr: 'honkai-star-rail.fandom.com', zzz: 'zenless-zone-zero.fandom.com' } as const;

interface Manifest {
  latest: string;
  live: string;
  new?: { character?: number[] };
}

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
  art?: string;
  portrait?: string;
  /** Tried when `portrait` doesn't exist; never written to the list. */
  portraitFallback?: string;
  source: string;
  leak?: { source: string };
}

const need = <T>(table: Record<string | number, T>, code: string | number, what: string, who: string): T => {
  const v = table[code];
  if (v === undefined) throw new Error(`Unknown ${what} code "${String(code)}" for ${who}. Add it to the table in scripts/import-nanoka.ts.`);
  return v;
};

async function getJson<T = Record<string, Record<string, unknown>>>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** Names can carry game markup like <unbreak>999</unbreak>; keep the text only. */
const plain = (v: unknown) => String(v).replace(/<[^>]+>/g, '');

function hsr(data: Record<string, Record<string, unknown>>): Out[] {
  return Object.entries(data).map(([id, c]) => {
    const role = need(HSR_PATH, String(c.baseType), 'path', id);
    let name = plain(c.en);
    // The Trailblazer's name is the player's choice; odd ids are Caelus, even Stelle.
    if (name === '{NICKNAME}') name = `Trailblazer · ${HSR_PATH_LABEL[role] ?? role} (${Number(id) % 2 ? 'Caelus' : 'Stelle'})`;
    const out: Out = {
      id,
      name,
      rarity: String(c.rank).endsWith('5') ? 'top' : 'mid',
      element: need(HSR_ELEMENT, String(c.damageType), 'element', id),
      role,
      art: `${STATIC}/assets/hsr/avatardrawcard/${id}.webp`,
      portrait: `${STATIC}/assets/hsr/avataricon/avatar/${id}.webp`,
      // Newer characters have no avatar/ picture yet; the shop icon is the same square portrait.
      portraitFallback: `${STATIC}/assets/hsr/avatarshopicon/${id}.webp`,
      source: 'nanoka.cc',
    };
    if (typeof c.release === 'number') out.releasedAt = new Date(c.release * 1000).toISOString();
    return out;
  });
}

function zzz(data: Record<string, Record<string, unknown>>): Out[] {
  return Object.entries(data).map(([id, c]) => {
    const icon = typeof c.icon === 'string' ? c.icon : undefined;
    return {
      id,
      name: plain(c.en),
      rarity: c.rank === 4 ? ('top' as const) : ('mid' as const),
      element: need(ZZZ_ELEMENT, Number(c.element), 'attribute', id),
      role: need(ZZZ_TYPE, Number(c.type), 'specialty', id),
      ...(icon ? { art: `${STATIC}/assets/zzz/${icon}.webp`, portrait: `${STATIC}/assets/zzz/${icon.replace(/^IconRole/, 'IconRoleCrop')}.webp` } : {}),
      source: 'nanoka.cc',
    };
  });
}

/** Keep only image links that answer; a missing picture shows the hatched placeholder instead of a broken image. */
async function checkArt(list: Out[]): Promise<void> {
  const urls = list.flatMap((c) => [c.art, c.portrait, c.portraitFallback]).filter((u): u is string => Boolean(u));
  const ok = new Set<string>();
  for (let i = 0; i < urls.length; i += 16) {
    await Promise.all(
      urls.slice(i, i + 16).map(async (u) => {
        const res = await fetch(u, { method: 'HEAD' }).catch(() => undefined);
        if (res?.ok) ok.add(u);
      }),
    );
  }
  for (const c of list) {
    if (c.art && !ok.has(c.art)) {
      console.warn(`  no art for ${c.name} (${c.id})`);
      delete c.art;
    }
    if (c.portrait && !ok.has(c.portrait)) {
      if (c.portraitFallback && ok.has(c.portraitFallback)) c.portrait = c.portraitFallback;
      else {
        console.warn(`  no portrait for ${c.name} (${c.id})`);
        delete c.portrait;
      }
    }
    delete c.portraitFallback;
  }
}

/** Release dates from the wiki's character pages, for characters nanoka gives none. */
async function wikiDates(game: 'hsr' | 'zzz', list: Out[]): Promise<void> {
  const missing = list.filter((c) => !c.releasedAt && !c.leak && !c.name.startsWith('Trailblazer'));
  const pages = await fetchWiki(
    WIKI[game],
    missing.map((c) => c.name),
  );
  for (const c of missing) {
    const page = pages.get(c.name);
    const box = page ? infobox(page.text.slice(page.text.search(/\{\{(Agent|Character) Infobox/))) : {};
    const date = /^\d{4}-\d{2}-\d{2}/.exec(box.releasedate ?? box.release_date ?? '')?.[0];
    // The page must be this character's own page: its short or full name is ours.
    const clean = (n?: string) => n?.replace(/&shy;|\u00ad/g, '').toLowerCase();
    const same = [box.brief_name, box.name, page?.title].some((n) => clean(n) === c.name.toLowerCase());
    if (date && same) c.releasedAt = `${date}T04:00:00.000Z`;
    else console.warn(`  no release date for ${c.name} (${c.id})`);
  }
}

/**
 * Pictures nanoka doesn't have yet (announced, unreleased agents): the wiki's
 * copies of the official reveal art, "Agent <full name> Portrait.png" and "Icon.png".
 */
async function wikiArt(game: 'hsr' | 'zzz', list: Out[]): Promise<void> {
  if (game !== 'zzz') return;
  const missing = list.filter((c) => !c.art || !c.portrait);
  if (missing.length === 0) return;
  const pages = await fetchWiki(
    WIKI[game],
    missing.map((c) => c.name),
  );
  for (const c of missing) {
    const full = pages.get(c.name)?.title;
    if (!full) continue;
    const files = { art: `File:Agent ${full} Portrait.png`, portrait: `File:Agent ${full} Icon.png` };
    const url = `https://${WIKI[game]}/api.php?action=query&prop=imageinfo&iiprop=url&format=json&formatversion=2&titles=${encodeURIComponent(Object.values(files).join('|'))}`;
    const data = await getJson<{ query?: { pages?: { title: string; imageinfo?: { url: string }[] }[] } }>(url);
    const found = new Map((data.query?.pages ?? []).map((p) => [p.title, p.imageinfo?.[0]?.url]));
    const art = found.get(files.art);
    const portrait = found.get(files.portrait);
    if (!c.art && art) c.art = art;
    if (!c.portrait && portrait) c.portrait = portrait;
    if (art || portrait) console.log(`  ${c.name}: pictures from the wiki (official reveal art)`);
  }
}

const manifest = await getJson<Record<string, Manifest>>(`${STATIC}/manifest.json`);
for (const [game, read] of [
  ['hsr', hsr],
  ['zzz', zzz],
] as const) {
  const m = manifest[game];
  if (!m) throw new Error(`nanoka manifest has no ${game}`);
  const list = read(await getJson(`${STATIC}/${game}/${m.latest}/character.json`)).sort((a, b) => Number(a.id) - Number(b.id));
  // A build newer than the live game: its new characters are unreleased (leaks).
  if (m.latest !== m.live && !m.latest.startsWith(`${m.live}+`)) {
    const fresh = new Set((m.new?.character ?? []).map(String));
    for (const c of list) {
      if (!fresh.has(c.id)) continue;
      c.leak = { source: `nanoka.cc, game files of build ${m.latest} (live is ${m.live})` };
      delete c.releasedAt;
    }
  }
  await wikiDates(game, list);
  await checkArt(list);
  await wikiArt(game, list);
  writeFileSync(resolve(ROOT, `src/games/${game}/data/characters.json`), `${JSON.stringify(list, null, 2)}\n`);
  console.log(`${game}: ${list.length} characters (${list.filter((c) => c.leak).length} leaked, ${list.filter((c) => c.releasedAt).length} with a release date)`);
}
