// @vitest-environment node
/** Endfield recommended builds: the game's own recommended weapons, from each operator's wiki page. */
import { describe, expect, it } from 'vitest';
import { buildFor, recommendedWeapons } from '../scripts/import-endfield-builds';
import builds from '../src/games/endfield/data/builds.json';
import characters from '../src/games/endfield/data/characters.json';
import weapons from '../src/games/endfield/data/weapons.json';
import { endfield } from '../src/games/endfield/contract';

const page = (skill: string, stats: string) => `{{Operator infobox\n|name = Test\n|matskill = ${skill}\n|matstats = ${stats}\n}}\n==Stats==`;

describe('Endfield recommended weapons: reading a page', () => {
  it('Matching Skills first, then Matching Stats, each weapon once', () => {
    const r = recommendedWeapons(page('Rapid Ascent, Aspirant', 'Grand Vision, Rapid Ascent'));
    expect(r.skills).toEqual(['Rapid Ascent', 'Aspirant']);
    expect(r.stats).toEqual(['Grand Vision', 'Rapid Ascent']);
    expect(r.all).toEqual(['Rapid Ascent', 'Aspirant', 'Grand Vision']);
  });

  it('an empty field (Si: no Matching Stats) gives nothing, never the template’s closing braces', () => {
    expect(recommendedWeapons(page('Jade Vessel', '')).all).toEqual(['Jade Vessel']);
  });

  it('a weapon name not in weapons.json is reported (the import stops on it); no weapons → no build', () => {
    const known = new Map([['JET', { icon: 'x.png' }]]);
    const r = buildFor('c', 'Test', 1, page('JET, Not A Weapon', ''), known, false);
    expect(r.unknown).toEqual(['Not A Weapon']);
    expect(buildFor('c', 'Test', 1, page('', ''), known, false).build).toBeNull();
  });
});

describe('Endfield builds.json', () => {
  const names = new Set(weapons.map((w) => w.name));
  const ids = new Set(characters.map((c) => c.id));

  it('every build is an operator we list, and every weapon is in weapons.json', () => {
    expect(builds.length).toBeGreaterThan(0);
    for (const b of builds) {
      expect(ids.has(b.characterId), b.characterId).toBe(true);
      expect(b.weapons.length, b.characterId).toBeGreaterThan(0);
      for (const w of b.weapons) expect(names.has(w), `${b.characterId}: ${w}`).toBe(true);
    }
  });

  it('weapons only: no gear sets, main stats, sub stats or skill order, so those stay "No data yet"', () => {
    for (const b of builds) {
      expect(b.sets).toEqual([]);
      expect(b.mainStats).toEqual({});
      expect(b.subStats).toEqual([]);
      expect(b.skillsFirst).toEqual([]);
    }
  });

  it('the source says it is the game’s list, not ranked, with the page and its revision', () => {
    for (const b of builds) {
      expect(b.source).toMatch(/^the game's recommended weapons, not ranked: Matching Skills first, then Matching Stats \(endfield\.wiki\.gg\/wiki\/.+, CC BY-SA 4\.0, revision \d+\)$/);
      expect(b.version).toMatch(/^wiki revision \d+$/);
    }
  });

  it('the contract serves them to the character page', async () => {
    const served = (await endfield.data.builds?.()) ?? [];
    expect(served.map((b) => b.characterId).sort()).toEqual(builds.map((b) => b.characterId).sort());
  });
});
