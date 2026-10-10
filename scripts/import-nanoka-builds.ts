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
 * Writes src/games/<game>/data/builds.json, and src/games/hsr/data/teams.json.
 */
import { writeFileSync } from 'node:fs';
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
const plain = (s: string) => s.replace(/<[^>]+>/g, '').replace(/\u00a0/g, ' ').trim();

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
}

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

async function zzz(): Promise<Build[]> {
  const v = (await getJson<{ zzz: { live: string } }>(`${BASE}/manifest.json`)).zzz.live;
  const list = await getJson<Record<string, unknown>>(`${BASE}/zzz/${v}/character.json`);
  const sets = await getJson<Record<string, { en: { name: string } }>>(`${BASE}/zzz/${v}/equipment.json`);
  const weapons = await getJson<Record<string, { icon: string; en: string }>>(`${BASE}/zzz/${v}/weapon.json`);
  const details = new Map<string, ZzzDetail>();
  for (const id of Object.keys(list)) details.set(id, await getJson<ZzzDetail>(`${BASE}/zzz/${v}/en/character/${id}.json`));
  // Stat names as the game's own recommendations print them; "%" when the game formats it as a percentage.
  const stat: Record<string, string> = { ...ZZZ_FLAT };
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
    const own = Object.values(weapons).find((w) => w.icon === `Weapon_S_${id}`);
    const pr = d.skill_priority?.[0];
    out.push({
      characterId: id,
      source: "the game's own recommendation (nanoka.cc)",
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
  teams?: { team_id: number; member_list: number[]; backup_list1?: number[]; backup_list2?: number[]; backup_list3?: number[] }[];
}

async function hsr(): Promise<{ builds: Build[]; teams: unknown[] }> {
  const v = (await getJson<{ hsr: { live: string } }>(`${BASE}/manifest.json`)).hsr.live;
  const list = await getJson<Record<string, { en: string }>>(`${BASE}/hsr/${v}/character.json`);
  const relicSets = await getJson<Record<string, { en: string }>>(`${BASE}/hsr/${v}/relicset.json`);
  const cones = await getJson<Record<string, { en: string }>>(`${BASE}/hsr/${v}/lightcone.json`);
  const builds: Build[] = [];
  const teams: unknown[] = [];
  for (const id of Object.keys(list)) {
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
      builds.push({
        characterId: id,
        source: "the game's own recommendation (nanoka.cc)",
        sets: [
          { pieces: 4, options: r.set4_id_list.map((s) => plain(need(relicSets, s, 'relic set', who).en)) },
          { pieces: 2, options: r.set2_id_list.map((s) => plain(need(relicSets, s, 'planar set', who).en)) },
        ],
        mainStats: Object.fromEntries(slots.filter(([, l]) => l?.length).map(([slot, l]) => [slot, (l ?? []).map((p) => need(HSR_STAT, p, 'stat', who))])),
        subStats: (r.sub_affix_property_list ?? []).map((p) => need(HSR_STAT, p, 'stat', who)),
        weapons: (d.lightcones ?? []).map((c) => plain(need(cones, c, 'Light Cone', who).en)),
        skillsFirst: [],
      });
    }
    // The game's first recommended team per character (the Teams screen lists every one).
    for (const t of (d.teams ?? []).slice(0, 1)) {
      // The lead plus the three places; each place lists the game's first pick, then its backups.
      const places = [[Number(id)], ...[0, 1, 2].map((i) => [t.member_list[i], ...((i === 0 ? t.backup_list1 : i === 1 ? t.backup_list2 : t.backup_list3) ?? [])].filter((x): x is number => typeof x === 'number'))];
      const slots = places.map((p) => ({ characters: [...new Set(p.map(String))].filter((c) => c in list) })).filter((s) => s.characters.length);
      if (slots.length < 2) continue;
      teams.push({ id: `game-${id}-${t.team_id}`, name: `${plain(d.name)} team${t.team_id > 1 ? ` ${t.team_id}` : ''}`, slots, source: "the game's own recommended team (nanoka.cc)" });
    }
  }
  return { builds, teams };
}

const write = (game: string, file: string, data: unknown) => writeFileSync(resolve(ROOT, `src/games/${game}/data/${file}`), `${JSON.stringify(data, null, 1)}\n`);
const z = await zzz();
write('zzz', 'builds.json', z);
console.log(`zzz: ${z.length} recommended builds`);
const h = await hsr();
write('hsr', 'builds.json', h.builds);
write('hsr', 'teams.json', h.teams);
console.log(`hsr: ${h.builds.length} recommended builds, ${h.teams.length} recommended teams`);
