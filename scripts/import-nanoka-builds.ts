/**
 * The game's own recommended builds (and HSR's recommended teams), from
 * nanoka.cc's public data files (used with the site owner's permission).
 * Run: npm run data:builds
 *
 * Source: the recommendation the game itself shows for each character
 * (ZZZ "fairy_recommend" and skill priority; HSR relic, Light Cone and team
 * recommendations). Every character at once: game data, not kit reading.
 * Codes are mapped through the tables below; an unknown code stops the script.
 *
 * Writes src/games/<game>/data/builds.json and weapons.json (every Light Cone /
 * W-Engine in the newest game files, with its picture and, when the game data
 * says so, who it's made for), and src/games/hsr/data/teams.json.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const BASE = 'https://static.nanoka.cc';

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return (await res.json()) as T;
}
const need = <T>(table: Record<string, T>, code: unknown, what: string, who: string): T => {
  const v = table[String(code)];
  if (v === undefined) throw new Error(`Unknown ${what} "${String(code)}" for ${who}. Add it to the table in scripts/import-nanoka-builds.ts.`);
  return v;
};
const plain = (s: string) => s.replace(/<[^>]+>/g, '').replace(/\\n/g, '\n').replace(/\u00a0/g, ' ').trim();

/** nanoka.cc serves each game picture as <file name>.webp. */
const ASSETS = 'https://static.nanoka.cc/assets';
const baseName = (path: string) => (path.split('/').at(-1) ?? '').replace(/\.png$/, '');
const iconChecked = new Map<string, boolean>();
/** Only pictures that really load are kept: a missing picture shows the name alone, never a broken image. */
async function loads(url: string): Promise<string | undefined> {
  if (!iconChecked.has(url)) iconChecked.set(url, (await fetch(url, { method: 'HEAD' })).ok);
  return iconChecked.get(url) ? url : undefined;
}
/** HSR numbers in effect text: "#1[i]%" = the first parameter as a whole percent, "#2[f1]" = one decimal. */
const fill = (text: string, params: number[]) =>
  text.replace(/#(\d+)\[(i|f(\d))\](%?)/g, (_, n: string, kind: string, dec: string | undefined, pct: string) => {
    const v = (params[Number(n) - 1] ?? NaN) * (pct ? 100 : 1);
    if (Number.isNaN(v)) throw new Error(`No parameter ${n} for "${text}"`);
    return `${kind === 'i' ? String(Math.round(v)) : v.toFixed(Number(dec))}${pct}`;
  });

interface Build {
  characterId: string;
  /** Who recommends it. */
  source: string;
  sets: { pieces: 4 | 2; options: string[] }[];
  /** Main stats by slot, e.g. { 'Slot 4': ['CRIT Rate'] }. */
  mainStats: Record<string, string[]>;
  subStats: string[];
  weapons: string[];
  /** Skills to level first, in order. Empty = the game doesn't say. */
  skillsFirst: string[][];
  /** Picture and game text of each set and weapon, by name. */
  items: Record<string, { icon?: string; rarity?: number; effects: { label: string; text: string }[] }>;
  /** T54: read from the beta files (the character isn't out yet): the recommendation may change. */
  beta?: boolean;
  /** The game data build it was read from (beta builds only). */
  version?: string;
}

/** T54: who recommends a beta build, in the words the build score shows ("against …"). */
const betaSource = (v: string) => `the game's own recommendation in beta build ${v} (nanoka.cc), beta, may change`;
type Item = Build['items'][string];

// ── ZZZ ──────────────────────────────────────────────────────────────
/** Stat codes not named in any recommendation: the game's own pattern is x2 = %, x3 = flat (12101 Base ATK, 12102 ATK %, 12103 ATK). */
const ZZZ_FLAT: Record<string, string> = { 11103: 'HP', 12103: 'ATK', 13103: 'DEF' };
/** Skill type codes in the game's skill priority. */
const ZZZ_SKILL: Record<string, string> = { 0: 'Basic Attack', 1: 'Special Attack', 2: 'Dodge', 3: 'Chain Attack', 5: 'Core Skill', 6: 'Assist' };

interface ZzzDetail {
  name: string;
  fairy_recommend?: {
    slot4?: number;
    slot2?: number;
    slot_sub?: number;
    part_sub_list?: number[];
    part4?: { prop: number; name: string; format: string };
    part5?: { prop: number; name: string; format: string };
    part6?: { prop: number; name: string; format: string };
  };
  skill_priority?: { first_priority: number[]; second_priority: number[]; third_priority: number[] }[];
}

const zzzStat: Record<string, string> = { ...ZZZ_FLAT };

/** `only`: the characters to read (default: every one in that build); `beta`: they aren't out yet (T54). */
async function zzz(v: string, only?: Set<string>, beta = false): Promise<Build[]> {
  const list = await getJson<Record<string, unknown>>(`${BASE}/zzz/${v}/character.json`);
  const sets = await getJson<Record<string, { icon: string; en: { name: string; desc2: string; desc4: string } }>>(`${BASE}/zzz/${v}/equipment.json`);
  const weapons = await getJson<Record<string, { icon: string; en: string; rank?: number }>>(`${BASE}/zzz/${v}/weapon.json`);
  const setItem = async (id: number): Promise<Item | undefined> => {
    const s = sets[String(id)];
    if (!s) return undefined;
    const icon = await loads(`${ASSETS}/zzz/${baseName(s.icon)}.webp`);
    return { ...(icon ? { icon } : {}), effects: [{ label: '2-piece', text: plain(s.en.desc2) }, { label: '4-piece', text: plain(s.en.desc4) }] };
  };
  const weaponItem = async (id: string): Promise<Item> => {
    const d = await getJson<{ rarity: number; icon: string; talents: Record<string, { name: string; desc: string }> }>(`${BASE}/zzz/${v}/en/weapon/${id}.json`);
    const t = d.talents['1'];
    const icon = await loads(`${ASSETS}/zzz/${baseName(d.icon)}.webp`);
    return { ...(icon ? { icon } : {}), rarity: d.rarity, effects: t ? [{ label: `${plain(t.name)} (Phase 1)`, text: plain(t.desc) }] : [] };
  };
  const details = new Map<string, ZzzDetail>();
  for (const id of Object.keys(list)) if (!only || only.has(id)) details.set(id, await getJson<ZzzDetail>(`${BASE}/zzz/${v}/en/character/${id}.json`));
  // Stat names as the game's own recommendations print them; "%" when the game formats it as a percentage. Kept across
  // reads, so the beta pass (two agents) knows the codes the live pass saw (T54).
  const stat = zzzStat;
  for (const d of details.values())
    for (const p of [d.fairy_recommend?.part4, d.fairy_recommend?.part5, d.fairy_recommend?.part6])
      // HP, ATK and DEF come flat and as a percentage; the game prints both as the bare name, so "%" marks the percentage one.
      if (p) stat[String(p.prop)] = `${plain(p.name)}${p.format.includes('%') && ['HP', 'ATK', 'DEF'].includes(plain(p.name)) ? ' %' : ''}`;
  const out: Build[] = [];
  for (const [id, d] of details) {
    const who = `${d.name} (${id})`;
    const fr = d.fairy_recommend;
    if (!fr?.slot4) continue;
    const setName = (s: number | undefined) => (s ? plain(need(sets, s, 'Drive Disc set', who).en.name) : undefined);
    // The agent's own W-Engine: the game files name it after them ("Weapon_S_<id>").
    const ownId = Object.keys(weapons).find((w) => weapons[w]?.icon === `Weapon_S_${id}`);
    const own = ownId ? weapons[ownId] : undefined;
    const pr = d.skill_priority?.[0];
    const items: Build['items'] = {};
    for (const sid of [fr.slot4, fr.slot2, fr.slot_sub]) {
      const it = sid ? await setItem(sid) : undefined;
      const nm = sid ? setName(sid) : undefined;
      if (it && nm) items[nm] = it;
    }
    if (own && ownId) items[plain(own.en)] = await weaponItem(ownId);
    out.push({
      characterId: id,
      source: beta ? betaSource(v) : "the game's own recommendation (nanoka.cc)",
      ...(beta ? { beta: true, version: v } : {}),
      sets: [
        { pieces: 4, options: [setName(fr.slot4)].filter((x): x is string => !!x) },
        { pieces: 2, options: [setName(fr.slot2), setName(fr.slot_sub)].filter((x): x is string => !!x) },
      ],
      mainStats: Object.fromEntries(
        (['part4', 'part5', 'part6'] as const).flatMap((k, i) => (fr[k] ? [[`Disc ${i + 4}`, [need(stat, fr[k]?.prop, 'stat', who)]]] : [])),
      ),
      subStats: (fr.part_sub_list ?? []).map((p) => need(stat, p, 'stat', who)),
      weapons: own ? [plain(own.en)] : [],
      skillsFirst: pr ? [pr.first_priority, pr.second_priority, pr.third_priority].map((tier) => tier.map((s) => need(ZZZ_SKILL, s, 'skill type', who))) : [],
      items,
    });
  }
  return out;
}

// ── HSR ──────────────────────────────────────────────────────────────
const HSR_STAT: Record<string, string> = {
  AttackAddedRatio: 'ATK %',
  AttackDelta: 'ATK',
  DefenceAddedRatio: 'DEF %',
  HPAddedRatio: 'HP %',
  CriticalChanceBase: 'CRIT Rate',
  CriticalDamageBase: 'CRIT DMG',
  BreakDamageAddedRatioBase: 'Break Effect',
  HealRatioBase: 'Outgoing Healing Boost',
  SPRatioBase: 'Energy Regeneration Rate',
  SpeedDelta: 'SPD',
  StatusProbabilityBase: 'Effect Hit Rate',
  StatusResistanceBase: 'Effect RES',
  PhysicalAddedRatio: 'Physical DMG Boost',
  FireAddedRatio: 'Fire DMG Boost',
  IceAddedRatio: 'Ice DMG Boost',
  ThunderAddedRatio: 'Lightning DMG Boost',
  WindAddedRatio: 'Wind DMG Boost',
  QuantumAddedRatio: 'Quantum DMG Boost',
  ImaginaryAddedRatio: 'Imaginary DMG Boost',
};

interface HsrDetail {
  name: string;
  relics?: {
    set4_id_list: number[];
    set2_id_list: number[];
    property_list3?: string[];
    property_list4?: string[];
    property_list5?: string[];
    property_list6?: string[];
    sub_affix_property_list?: string[];
  };
  lightcones?: number[];
  teams?: { team_id: number; position?: number; member_list: number[]; backup_list1?: number[]; backup_list2?: number[]; backup_list3?: number[] }[];
}

/** `only`: the characters to read (default: every one in that build); `beta`: they aren't out yet, no teams (T54). */
async function hsr(v: string, only?: Set<string>, beta = false): Promise<{ builds: Build[]; teams: unknown[] }> {
  const list = await getJson<Record<string, { en: string }>>(`${BASE}/hsr/${v}/character.json`);
  const relicSets = await getJson<Record<string, { en: string; icon: string; set: Record<string, { en: string; ParamList: number[] }> }>>(`${BASE}/hsr/${v}/relicset.json`);
  const cones = await getJson<Record<string, { en: string }>>(`${BASE}/hsr/${v}/lightcone.json`);
  const relicItem = async (id: number): Promise<Item | undefined> => {
    const r = relicSets[String(id)];
    if (!r) return undefined;
    const icon = await loads(`${ASSETS}/hsr/itemfigures/${baseName(r.icon)}.webp`);
    return { ...(icon ? { icon } : {}), effects: Object.entries(r.set).map(([n, e]) => ({ label: `${n}-piece`, text: plain(fill(e.en, e.ParamList)) })) };
  };
  const coneCache = new Map<number, Item>();
  const coneItem = async (id: number): Promise<Item> => {
    const hit = coneCache.get(id);
    if (hit) return hit;
    const d = await getJson<{ rarity: string; refinements: { name: string; desc: string; level: Record<string, { param_list: number[] }> } }>(`${BASE}/hsr/${v}/en/lightcone/${id}.json`);
    const icon = await loads(`${ASSETS}/hsr/lightconemediumicon/${id}.webp`);
    const rarity = Number(/(\d)$/.exec(d.rarity)?.[1]);
    const item: Item = {
      ...(icon ? { icon } : {}),
      ...(rarity ? { rarity } : {}),
      effects: [{ label: `${plain(d.refinements.name)} (Superimposition 1)`, text: plain(fill(d.refinements.desc, d.refinements.level['1']?.param_list ?? [])) }],
    };
    coneCache.set(id, item);
    return item;
  };
  const builds: Build[] = [];
  const teams: unknown[] = [];
  for (const id of Object.keys(list)) {
    if (only && !only.has(id)) continue;
    const d = await getJson<HsrDetail>(`${BASE}/hsr/${v}/en/character/${id}.json`);
    const who = `${plain(d.name)} (${id})`;
    const r = d.relics;
    if (r?.set4_id_list.length) {
      // Body, Feet, Planar Sphere, Link Rope: property_list3–6.
      const slots: [string, string[] | undefined][] = [
        ['Body', r.property_list3],
        ['Feet', r.property_list4],
        ['Planar Sphere', r.property_list5],
        ['Link Rope', r.property_list6],
      ];
      const items: Build['items'] = {};
      for (const sid of [...r.set4_id_list, ...r.set2_id_list]) {
        const it = await relicItem(sid);
        if (it) items[plain(need(relicSets, sid, 'relic set', who).en)] = it;
      }
      for (const c of d.lightcones ?? []) items[plain(need(cones, c, 'Light Cone', who).en)] = await coneItem(c);
      builds.push({
        characterId: id,
        source: beta ? betaSource(v) : "the game's own recommendation (nanoka.cc)",
        ...(beta ? { beta: true, version: v } : {}),
        sets: [
          { pieces: 4, options: r.set4_id_list.map((s) => plain(need(relicSets, s, 'relic set', who).en)) },
          { pieces: 2, options: r.set2_id_list.map((s) => plain(need(relicSets, s, 'planar set', who).en)) },
        ],
        mainStats: Object.fromEntries(slots.filter(([, l]) => l?.length).map(([slot, l]) => [slot, (l ?? []).map((p) => need(HSR_STAT, p, 'stat', who))])),
        subStats: (r.sub_affix_property_list ?? []).map((p) => need(HSR_STAT, p, 'stat', who)),
        weapons: (d.lightcones ?? []).map((c) => plain(need(cones, c, 'Light Cone', who).en)),
        skillsFirst: [],
        items,
      });
    }
    // Every team the game recommends on this character's page, in the game's own order: the three members, with the
    // page's character placed where the game puts them (`position`). Each place lists the game's pick, then its backups.
    // Who the team is built around is decided from the kits (src/games/hsr/kitcheck/team.ts), not here.
    for (const t of beta ? [] : (d.teams ?? [])) {
      const places = [0, 1, 2].map((i) => [t.member_list[i], ...((i === 0 ? t.backup_list1 : i === 1 ? t.backup_list2 : t.backup_list3) ?? [])].filter((x): x is number => typeof x === 'number'));
      places.splice(Math.min(t.position ?? 0, places.length), 0, [Number(id)]);
      const slots = places.map((p) => ({ characters: [...new Set(p.map(String))].filter((c) => c in list) })).filter((s) => s.characters.length);
      if (slots.length < 2) continue;
      teams.push({ id: `game-${id}-${t.team_id}`, name: `${plain(d.name)} team${t.team_id > 1 ? ` ${t.team_id}` : ''}`, slots, source: "the game's own recommended team (nanoka.cc)" });
    }
  }
  return { builds, teams };
}

interface WeaponOut {
  id: string;
  name: string;
  rarity: 'top' | 'mid' | 'low';
  icon?: string;
  madeFor?: string;
  /** The path (HSR) or specialty (ZZZ) whose wearers get its effect, as `role` in characters.json. */
  role?: string;
  /** The weapon's effect at its first refinement, in the game's words (the kit check reads it). */
  effect?: { name: string; text: string };
  source: string;
}
/** HSR Light Cone `baseType` → path, as `role` in characters.json. */
const HSR_PATH: Record<string, string> = { Warrior: 'destruction', Rogue: 'hunt', Mage: 'erudition', Shaman: 'harmony', Warlock: 'nihility', Knight: 'preservation', Priest: 'abundance', Memory: 'remembrance', Elation: 'elation' };
/** ZZZ W-Engine `type` → specialty, as `role` in characters.json. */
const ZZZ_SPECIALTY: Record<number, string> = { 1: 'attack', 2: 'stun', 3: 'anomaly', 4: 'support', 5: 'defense', 6: 'rupture', 7: 'armorer' };
const RARITY: Record<number, WeaponOut['rarity']> = { 5: 'top', 4: 'mid', 3: 'low' };

/** ZZZ: every W-Engine in the newest files; an S-rank named after an agent ("Weapon_S_<id>") is made for them. */
async function zzzWeapons(): Promise<WeaponOut[]> {
  const v = (await getJson<{ zzz: { latest: string } }>(`${BASE}/manifest.json`)).zzz.latest;
  const list = await getJson<Record<string, { icon: string; rank: number; type: number; en: string }>>(`${BASE}/zzz/${v}/weapon.json`);
  const agents = new Set(Object.keys(await getJson<Record<string, unknown>>(`${BASE}/zzz/${v}/character.json`)));
  const out: WeaponOut[] = [];
  for (const [id, w] of Object.entries(list)) {
    // ZZZ ranks: 4 = S, 3 = A, 2 = B; the same three steps as 5, 4, 3 stars.
    const rarity = RARITY[w.rank + 1];
    if (!rarity) throw new Error(`zzz weapon ${id}: unknown rank ${w.rank}`);
    const icon = await loads(`${ASSETS}/zzz/${w.icon}.webp`);
    const agent = /^Weapon_S_(\d+)$/.exec(w.icon)?.[1];
    const madeFor = agent && agents.has(agent) ? agent : undefined;
    // Every W-Engine's effect (T18: whatever is equipped counts, not only signatures).
    let effect: WeaponOut['effect'];
    const d = await getJson<{ talents: Record<string, { name: string; desc: string }> }>(`${BASE}/zzz/${v}/en/weapon/${id}.json`);
    const t = d.talents['1'];
    if (t) effect = { name: plain(t.name), text: plain(t.desc) };
    const role = ZZZ_SPECIALTY[w.type];
    if (!role) throw new Error(`zzz weapon ${id}: unknown type ${w.type}`);
    out.push({ id, name: plain(w.en), rarity, ...(icon ? { icon } : {}), ...(madeFor ? { madeFor } : {}), role, ...(effect ? { effect } : {}), source: 'nanoka.cc' });
  }
  return out;
}

/**
 * HSR: every Light Cone in the newest files. A 5★ Light Cone is "made for" a
 * character when it is the first one the game recommends for them and for no
 * one else (the game's own signature pick); otherwise it is left blank.
 */
async function hsrWeapons(): Promise<WeaponOut[]> {
  const v = (await getJson<{ hsr: { latest: string } }>(`${BASE}/manifest.json`)).hsr.latest;
  const list = await getJson<Record<string, { rank: string; baseType: string; en: string }>>(`${BASE}/hsr/${v}/lightcone.json`);
  const chars = await getJson<Record<string, unknown>>(`${BASE}/hsr/${v}/character.json`);
  const firstFor = new Map<string, string[]>();
  for (const id of Object.keys(chars)) {
    const d = await getJson<HsrDetail>(`${BASE}/hsr/${v}/en/character/${id}.json`);
    const first = d.lightcones?.[0];
    if (first !== undefined) firstFor.set(String(first), [...(firstFor.get(String(first)) ?? []), id]);
  }
  const out: WeaponOut[] = [];
  for (const [id, c] of Object.entries(list)) {
    const stars = Number(/(\d)$/.exec(c.rank)?.[1]);
    const rarity = RARITY[stars];
    if (!rarity) throw new Error(`hsr Light Cone ${id}: unknown rarity ${c.rank}`);
    const icon = await loads(`${ASSETS}/hsr/lightconemediumicon/${id}.webp`);
    const who = firstFor.get(id);
    const madeFor = stars === 5 && who?.length === 1 && who[0] ? who[0] : undefined;
    // Every Light Cone's effect (T18: whatever is equipped counts, not only signatures).
    let effect: WeaponOut['effect'];
    const d = await getJson<{ refinements?: { name: string; desc: string; level: Record<string, { param_list: number[] }> } }>(`${BASE}/hsr/${v}/en/lightcone/${id}.json`);
    if (d.refinements?.desc) effect = { name: plain(d.refinements.name), text: plain(fill(d.refinements.desc, d.refinements.level['1']?.param_list ?? [])) };
    else console.log(`  hsr Light Cone ${id} (${plain(c.en)}): no effect text in the files yet, left out`);
    const role = HSR_PATH[c.baseType];
    if (!role) throw new Error(`hsr Light Cone ${id}: unknown path ${c.baseType}`);
    out.push({ id, name: plain(c.en), rarity, ...(icon ? { icon } : {}), ...(madeFor ? { madeFor } : {}), role, ...(effect ? { effect } : {}), source: 'nanoka.cc' });
  }
  return out;
}

const write = (game: string, file: string, data: unknown) => writeFileSync(resolve(ROOT, `src/games/${game}/data/${file}`), `${JSON.stringify(data, null, 1)}\n`);
const manifest = await getJson<{ zzz: { live: string; latest: string }; hsr: { live: string; latest: string } }>(`${BASE}/manifest.json`);
/** T54: characters in our list (upcoming, leaks) that the live files don't have yet: read from the beta files, marked. */
const notLive = async (game: 'zzz' | 'hsr', live: string) => {
  const ours = (JSON.parse(readFileSync(resolve(ROOT, `src/games/${game}/data/characters.json`), 'utf8')) as { id: string }[]).map((c) => String(c.id));
  const inLive = new Set(Object.keys(await getJson<Record<string, unknown>>(`${BASE}/${game}/${live}/character.json`)));
  return new Set(ours.filter((id) => !inLive.has(id)));
};
const z = await zzz(manifest.zzz.live);
const zBeta = manifest.zzz.latest === manifest.zzz.live ? [] : await zzz(manifest.zzz.latest, await notLive('zzz', manifest.zzz.live), true);
write('zzz', 'builds.json', [...z, ...zBeta]);
console.log(`zzz: ${z.length} recommended builds, ${zBeta.length} beta (${zBeta.map((b) => b.characterId).join(', ') || 'none'})`);
const h = await hsr(manifest.hsr.live);
const hBeta = manifest.hsr.latest === manifest.hsr.live ? { builds: [] } : await hsr(manifest.hsr.latest, await notLive('hsr', manifest.hsr.live), true);
write('hsr', 'builds.json', [...h.builds, ...hBeta.builds]);
write('hsr', 'teams.json', h.teams);
console.log(`hsr: ${h.builds.length} recommended builds, ${hBeta.builds.length} beta (${hBeta.builds.map((b) => b.characterId).join(', ') || 'none'}), ${h.teams.length} recommended teams`);
const zw = await zzzWeapons();
write('zzz', 'weapons.json', zw);
const hw = await hsrWeapons();
write('hsr', 'weapons.json', hw);
console.log(`weapons: zzz ${zw.length} (${zw.filter((w) => !w.icon).length} without a picture), hsr ${hw.length} (${hw.filter((w) => !w.icon).length} without a picture)`);
