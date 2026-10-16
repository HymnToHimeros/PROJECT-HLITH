// @vitest-environment node
/**
 * Endfield recommended builds: the game's own recommended weapons (from each operator's wiki page), gear sets
 * and skill order only where two or more community guides agree, and the wiki's gear sets.
 */
import { describe, expect, it } from 'vitest';
import { agreedSet, agreedSkills, buildFor, recommendedWeapons, type CommunityBuilds } from '../scripts/import-endfield-builds';
import { plain, setEffects, STATS, weaponSkillTable } from '../scripts/import-endfield-gear';
import attributes from '../src/games/endfield/data/operator-attributes.json';
import gearPieces from '../src/games/endfield/data/gear-pieces.json';
import weaponSkills from '../src/games/endfield/data/weapon-skills.json';
import type { RecommendedBuild } from '../src/core/contract';
import buildsJson from '../src/games/endfield/data/builds.json';
import characters from '../src/games/endfield/data/characters.json';
import communityJson from '../src/games/endfield/data/community-builds.json';
import gearSets from '../src/games/endfield/data/gear-sets.json';
import weapons from '../src/games/endfield/data/weapons.json';
import { endfield } from '../src/games/endfield/contract';

const builds = buildsJson as unknown as RecommendedBuild[];
const community = communityJson as unknown as CommunityBuilds;
const page = (skill: string, stats: string) => `{{Operator infobox\n|name = Test\n|matskill = ${skill}\n|matstats = ${stats}\n}}\n==Stats==`;
const at = (source: string, date = '2026-10-15') => ({ source, url: `https://example.org/${source}`, date });

describe('Endfield recommended weapons: reading a page', () => {
  it('Matching Skills first, then Matching Stats, each weapon once', () => {
    const r = recommendedWeapons(page('Rapid Ascent, Aspirant', 'Grand Vision, Rapid Ascent'));
    expect(r.all).toEqual(['Rapid Ascent', 'Aspirant', 'Grand Vision']);
  });

  it('an empty field (Si: no Matching Stats) gives nothing, never the template’s closing braces', () => {
    expect(recommendedWeapons(page('Jade Vessel', '')).all).toEqual(['Jade Vessel']);
  });

  it('a weapon, gear set or skill name the lists don’t know is reported (the import stops on it); no weapons → no build', () => {
    const known = new Map([['JET', { icon: 'x.png' }]]);
    const data = { sources: {}, operators: { c: { sets: [{ ...at('a'), set: 'Not A Set' }], skills: [{ ...at('a'), tiers: [['Ult']] }] } } };
    const r = buildFor('c', 'Test', 1, page('JET, Not A Weapon', ''), known, false, { data, sets: new Map() });
    expect(r.unknown).toEqual(['weapon "Not A Weapon"', 'gear set "Not A Set" (a)', 'skill "Ult" (a)']);
    expect(buildFor('c', 'Test', 1, page('', ''), known, false).build).toBeNull();
  });
});

describe('community guides: only what two sources agree on', () => {
  it('a gear set needs two sources, and more than any other set', () => {
    expect(agreedSet([{ ...at('game8'), set: 'Hot Work' }])).toBeNull();
    expect(agreedSet([{ ...at('game8'), set: 'Hot Work' }, { ...at('gamewith'), set: 'Frontiers' }])).toBeNull();
    expect(agreedSet([{ ...at('game8'), set: 'Hot Work' }, { ...at('gamewith'), set: 'Hot Work' }])?.set).toBe('Hot Work');
    // A newer pair outvotes an older guide.
    const three = agreedSet([{ ...at('game8'), set: 'Qingbo' }, { ...at('gamewith'), set: 'Swordmancer' }, { ...at('18183'), set: 'Qingbo' }]);
    expect(three?.set).toBe('Qingbo');
    expect(three?.by.map((e) => e.source)).toEqual(['game8', '18183']);
  });

  it('a skill order keeps only the tiers every source shares; a disagreement merges into one tier, and one tier of everything is nothing', () => {
    const strict = [['Ultimate'], ['Battle Skill'], ['Basic Attack'], ['Combo Skill']];
    const stars = [['Ultimate'], ['Basic Attack', 'Battle Skill', 'Combo Skill']];
    expect(agreedSkills([{ ...at('a'), tiers: strict }, { ...at('b'), tiers: stars }])).toEqual([['Ultimate'], ['Basic Attack', 'Battle Skill', 'Combo Skill']]);
    expect(agreedSkills([{ ...at('a'), tiers: strict }])).toBeNull();
    const other = [['Battle Skill'], ['Ultimate'], ['Basic Attack'], ['Combo Skill']];
    expect(agreedSkills([{ ...at('a'), tiers: strict }, { ...at('b'), tiers: other }])).toEqual([['Battle Skill', 'Ultimate'], ['Basic Attack'], ['Combo Skill']]);
    const reversed = [['Combo Skill'], ['Basic Attack'], ['Battle Skill'], ['Ultimate']];
    expect(agreedSkills([{ ...at('a'), tiers: strict }, { ...at('b'), tiers: reversed }])).toBeNull();
  });

  it('every entry in community-builds.json names a known source, its page and that page’s date', () => {
    const ids = new Set(characters.map((c) => c.id));
    const sources = new Set(Object.keys(community.sources));
    for (const [id, o] of Object.entries(community.operators)) {
      expect(ids.has(id), id).toBe(true);
      for (const e of [...(o.sets ?? []), ...(o.skills ?? [])]) {
        expect(sources.has(e.source), `${id}: ${e.source}`).toBe(true);
        expect(e.url, id).toMatch(/^https:\/\//);
        expect(e.date, id).toMatch(/^\d{4}-\d\d-\d\d$/);
      }
    }
  });
});

describe('Endfield builds.json', () => {
  const names = new Set(weapons.map((w) => w.name));
  const sets = new Set(gearSets.map((s) => s.name));
  const ids = new Set(characters.map((c) => c.id));

  it('every build is an operator we list, every weapon is in weapons.json and every set in gear-sets.json', () => {
    expect(builds.length).toBe(characters.length);
    for (const b of builds) {
      expect(ids.has(b.characterId), b.characterId).toBe(true);
      expect(b.weapons.length, b.characterId).toBeGreaterThan(0);
      for (const w of b.weapons) expect(names.has(w), `${b.characterId}: ${w}`).toBe(true);
      for (const s of b.sets.flatMap((x) => x.options)) expect(sets.has(s), `${b.characterId}: ${s}`).toBe(true);
    }
  });

  it('weapons are the game’s unranked list; no main stats step; no sub stats (no source has them)', () => {
    for (const b of builds) {
      expect(b.source).toMatch(/^the game's recommendation, not ranked: Matching Skills first, then Matching Stats \(endfield\.wiki\.gg\/wiki\/.+, CC BY-SA 4\.0, revision \d+\)$/);
      expect(b.ranked).toBe(false);
      expect(b.hasMainStats).toBe(false);
      expect(b.mainStats).toEqual({});
      expect(b.subStats).toEqual([]);
    }
  });

  it('a gear set or skill order is there only with two agreeing sources, credited as community guides with dates', () => {
    for (const b of builds) {
      const own = community.operators[b.characterId];
      const set = b.sets[0]?.options[0];
      if (set) {
        expect(own?.sets?.filter((e) => e.set === set).length ?? 0, b.characterId).toBeGreaterThanOrEqual(2);
        expect(b.stepSources?.sets).toMatch(/^Community guides: .+ \(\d{1,2} \w{3} \d{4}\)(, .+ \(\d{1,2} \w{3} \d{4}\))+$/);
        expect(b.items?.[set]?.effects[0]?.label, b.characterId).toBe('3-piece');
      } else expect(b.stepSources?.sets).toBeUndefined();
      if (b.skillsFirst.length) {
        expect(own?.skills?.length ?? 0, b.characterId).toBeGreaterThanOrEqual(2);
        expect(b.stepSources?.skills).toMatch(/^Community guides: /);
      } else expect(b.stepSources?.skills).toBeUndefined();
    }
    // Laevatain: Game8, GameWith and 18183 all say Hot Work; GameWith and endfield.gg both put her Ultimate first.
    const laevatain = builds.find((b) => b.characterId === 'chr_0016_laevat');
    expect(laevatain?.sets).toEqual([{ pieces: 3, options: ['Hot Work'] }]);
    expect(laevatain?.skillsFirst[0]).toEqual(['Ultimate']);
    // Camille: only Game8 names a set → none.
    expect(builds.find((b) => b.characterId === 'chr_0033_camille')?.sets).toEqual([]);
  });

  it('gear sets: the wiki’s names and 3-piece effects in plain text, each with its page revision', () => {
    expect(setEffects('3-piece set effect: Wearer\'s ATK <span style="color:\n#8DA2DF">+8%</span>. [[File:X.png|15px|link=]]Vulnerability')).toEqual([{ label: '3-piece', text: "Wearer's ATK +8%. Vulnerability" }]);
    expect(setEffects('No Set Effects')).toEqual([]);
    // Markup hidden inside markup can't come back together, and entities are decoded once.
    expect(plain('<scr<script>ipt>alert(1)</scr</script>ipt>')).toBe('alert(1)');
    expect(plain('A &amp;lt;b&amp;gt; &amp;amp; C')).toBe('A &lt;b&gt; &amp; C');
    for (const s of gearSets) {
      expect(s.version, s.name).toMatch(/^wiki revision \d+$/);
      expect(JSON.stringify(s.effects), s.name).not.toMatch(/<|\[\[|&#/);
    }
  });

  it('gear pieces: every one in a known set (or none), a slot, and 1–3 fixed stats the STATS list knows, with numbers', () => {
    expect(gearPieces.length).toBeGreaterThan(200);
    const stats = new Set<string>(STATS);
    for (const p of gearPieces) {
      if (p.set) expect(sets.has(p.set), p.name).toBe(true);
      expect(['Armor', 'Gloves', 'Kit']).toContain(p.slot);
      expect(p.stats.length, p.name).toBeGreaterThan(0);
      for (const x of p.stats) {
        expect(stats.has(x.stat), `${p.name}: ${x.stat}`).toBe(true);
        expect(x.values.every((v) => Number.isFinite(v) && v > 0), `${p.name}: ${x.stat}`).toBe(true);
      }
      expect(p.version, p.name).toMatch(/^wiki revision \d+$/);
    }
    // Every endgame set has pieces for all three slots.
    for (const s of gearSets.filter((x) => x.level === 70 && x.effects.length)) for (const slot of ['Armor', 'Gloves', 'Kit']) expect(gearPieces.some((p) => p.set === s.name && p.slot === slot), `${s.name} ${slot}`).toBe(true);
  });

  it('weapon skills: every weapon recommended for a released operator has its three skills in words, at rank 1 and the top rank', () => {
    const byName = new Map(weaponSkills.map((w) => [w.weapon, w]));
    // Operators not out yet (beta) may name a weapon the wiki has no skills for yet (Argent Flow's Lunar Calling).
    for (const w of new Set(builds.filter((b) => !b.beta).flatMap((b) => b.weapons))) {
      const ws = byName.get(w);
      expect(ws?.skills.length, w).toBe(3);
      for (const k of ws?.skills ?? []) expect(k.rank1 && k.max, `${w}: ${k.name}`).toBeTruthy();
    }
    const html = '<div>Weapon Skills</div></table><table class="mrfz-wtable"><tr><th>Rank</th><th>A</th></tr><tr><th>1</th><td>ATK <span>+5%</span></td></tr><tr><th>9</th><td>ATK <span>+39%</span></td></tr></table>';
    expect(weaponSkillTable(html, ['A'])).toEqual([{ name: 'A', rank1: 'ATK +5%', max: 'ATK +39%' }]);
  });

  it('every released operator has a main attribute from its page', () => {
    const all = attributes as Record<string, { main: string; secondary?: string; version: string }>;
    for (const c of characters.filter((x) => !x.releasedAt || Date.parse(x.releasedAt) <= Date.parse('2026-10-16'))) {
      expect(['Strength', 'Agility', 'Intellect', 'Will']).toContain(all[c.id]?.main);
      expect(all[c.id]?.version, c.id).toMatch(/^wiki revision \d+$/);
    }
  });

  it('the contract serves them to the character page', async () => {
    const served = (await endfield.data.builds?.()) ?? [];
    expect(served.map((b) => b.characterId).sort()).toEqual(builds.map((b) => b.characterId).sort());
  });
});
