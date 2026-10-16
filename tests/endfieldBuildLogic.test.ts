// @vitest-environment node
/** HLITH's own Endfield build picks, from the kit and the gear texts (src/games/endfield/build). */
import { describe, expect, it } from 'vitest';
import type { RecommendedBuild } from '../src/core/contract';
import { endfield } from '../src/games/endfield/contract';
import characters from '../src/games/endfield/data/characters.json';
import gearSets from '../src/games/endfield/data/gear-sets.json';
import { levelPairs, skillNumbers } from '../src/games/endfield/build/kitNumbers';
import { SET_RULES } from '../src/games/endfield/build/sets';
import * as W from '../src/games/endfield/build/weights';

const CAMILLE = 'chr_0033_camille';
const LAEVATAIN = 'chr_0016_laevat';
const ARCLIGHT = 'chr_0007_ikut';
const NOW = Date.parse('2026-10-16T00:00:00Z');
const all = async () => ((await endfield.data.builds?.()) ?? []) as RecommendedBuild[];
const of = async (id: string) => (await all()).find((b) => b.characterId === id) as RecommendedBuild;

describe('the gear set rules are the game’s own words', () => {
  it('every rule quotes its set’s effect word for word, and every ruled set is an endgame set', () => {
    for (const [name, rules] of Object.entries(SET_RULES)) {
      const set = gearSets.find((s) => s.name === name);
      expect(set, name).toBeDefined();
      expect(set?.level, name).toBeGreaterThanOrEqual(W.ENDGAME_LEVEL);
      for (const r of rules) expect(set?.effects.map((e) => e.text).join(' '), `${name}: ${r.quote}`).toContain(r.quote);
    }
  });

  it('every level-70 set has an entry, so a new set can’t be skipped silently; only a set with no effect has no rules', () => {
    for (const s of gearSets.filter((x) => x.level >= W.ENDGAME_LEVEL)) {
      expect(SET_RULES[s.name], s.name).toBeDefined();
      expect((SET_RULES[s.name]?.length ?? 0) > 0, s.name).toBe(s.effects.length > 0);
    }
  });

  it('a pick’s reasons say only level-70 sets are compared', async () => {
    expect((await of(CAMILLE)).stepWhy?.sets?.join(' ')).toContain('Only level-70 sets are compared');
  });
});

describe('kit numbers', () => {
  it('reads the level-12 numbers, leaves out situational Finisher and Dive hits, and says how often it estimates', () => {
    const basic = skillNumbers({ id: 'basic-attack', label: 'Basic Attack: Test', gameText: 'Hits. At level 12: BATK SEQ 1 Multiplier: 50%; BATK SEQ 2 Multiplier: 70%; Finisher ATK Multiplier: 900%; Dive ATK Multiplier: 180%.' });
    expect(basic?.perUse).toBe(120);
    expect(basic?.estimate).toMatch(/^estimated at \d+ attack chains a minute$/);
    expect(levelPairs('x. At level 12: SP Cost: 100; DMG Multiplier: 200%.')).toEqual([['SP Cost', '100'], ['DMG Multiplier', '200%']]);
  });

  it('an ultimate that powers up basic attacks counts its enhanced chain over its duration, and says so', () => {
    const ult = skillNumbers({ id: 'ultimate', label: 'Ultimate: Twilight', gameText: 'At level 12: Ultimate Energy Cost: 300; Duration (s): 15; Enhanced BATK SEQ 1 Multiplier: 100%.' });
    expect(ult?.perUse).toBe(100 * (15 / W.BASIC_CHAIN_SECONDS));
    expect(ult?.estimate).toBe('estimated from Ultimate Energy Cost: 300 and its 15s of enhanced attacks');
  });
});

describe('Camille, Laevatain and Arclight', () => {
  it('Camille: no two guides agree on a set, so HLITH picks from his kit and shows Game8’s different pick as a note', async () => {
    const b = await of(CAMILLE);
    expect(b.stepSources?.sets).toBe("HLITH's pick from the kit");
    expect(b.sets[0]?.options[0]).toBe('Tide Surge');
    expect(b.stepWhy?.sets?.join(' ')).toContain('“the wearer gains Arts DMG Dealt +35% for 15s”');
    expect(b.stepWhy?.sets?.join(' ')).toContain('their kit applies Arts Inflictions: “deal Heat DMG and apply Heat Infliction');
    expect(b.stepNotes?.sets).toContain('Frontiers (Game8, 15 Oct 2026)');
    // Weapons: the game's list, ordered by the kit; stats: his main attribute first.
    expect(b.weapons[0]).toBe('Blessing of Lustrous Carmine');
    expect(b.source).toMatch(/^The game's recommended weapons \(the game doesn't rank them: Matching Skills, then Matching Stats; endfield\.wiki\.gg\/wiki\/Camille, CC BY-SA 4\.0, rev \d+\), put in order by HLITH's kit match$/);
    expect(b.ranked).toBe(false);
    expect(b.orderedBy).toBe('HLITH');
    expect(b.subStats[0]).toBe('Agility');
    expect(b.stepWhy?.subStats?.[0]).toBe('Agility: Agility is their main attribute.');
    expect(b.skillsFirst[0]).toEqual(['Basic Attack', 'Combo Skill']);
  });

  it('Laevatain: the guides’ Hot Work stays, HLITH adds the off-piece and explains Hot Work from her kit; a different skill order is a note', async () => {
    const b = await of(LAEVATAIN);
    expect(b.sets[0]).toEqual({ pieces: 3, options: ['Hot Work'] });
    expect(b.sets[1]?.pieces).toBe(1);
    expect(b.stepSources?.sets).toMatch(/^Community guides: .+; off-piece: HLITH's pick from the kit$/);
    expect(b.stepWhy?.sets?.join(' ')).toContain('their kit applies Combustion: “forcibly trigger temporary Combustion');
    expect(b.weapons[0]).toBe('Forgeborn Scathe');
    expect(b.skillsFirst[0]).toEqual(['Ultimate']);
    expect(b.stepNotes?.skills).toMatch(/^HLITH's pick from the kit would be /);
  });

  it('Arclight: the guides’ Frontiers stays; HLITH ranks his skills with the uses-a-minute estimate named', async () => {
    const b = await of(ARCLIGHT);
    expect(b.sets[0]?.options[0]).toBe('Frontiers');
    expect(b.stepWhy?.sets?.join(' ')).toContain('their kit recovers SP');
    expect(b.stepSources?.skills).toBe("HLITH's pick from the kit");
    expect(b.skillsFirst[0]).toEqual(['Ultimate']);
    expect(b.stepWhy?.skills?.join(' ')).toMatch(/estimated from Ultimate Energy Cost: \d+/);
    expect(b.subStats[0]).toBe('Agility');
  });
});

describe('every released operator', () => {
  it('has every field filled, each with a source and a reason', async () => {
    const released = characters.filter((c) => !c.releasedAt || Date.parse(c.releasedAt) <= NOW);
    const builds = await all();
    for (const c of released) {
      const b = builds.find((x) => x.characterId === c.id);
      expect(b, c.name).toBeDefined();
      if (!b) continue;
      expect(b.weapons.length, `${c.name} weapons`).toBeGreaterThan(0);
      expect(b.source, `${c.name} weapon source`).toBeTruthy();
      expect(b.sets.length, `${c.name} set`).toBeGreaterThan(0);
      expect(b.stepSources?.sets, `${c.name} set source`).toBeTruthy();
      expect(b.stepWhy?.sets?.length, `${c.name} set why`).toBeGreaterThan(0);
      expect(b.subStats.length, `${c.name} stats`).toBeGreaterThan(0);
      expect(b.stepSources?.subStats, `${c.name} stats source`).toBeTruthy();
      expect(b.stepWhy?.subStats?.length, `${c.name} stats why`).toBe(b.subStats.length);
      expect(b.skillsFirst.length, `${c.name} skills`).toBeGreaterThan(0);
      expect(b.stepSources?.skills, `${c.name} skills source`).toBeTruthy();
      if (b.stepSources?.skills?.startsWith('HLITH')) expect(b.stepWhy?.skills?.join(' '), `${c.name} skills why`).toMatch(/estimated/);
      if (b.weapons.length > 1) expect(b.stepWhy?.weapons?.length, `${c.name} weapon why`).toBe(b.weapons.length);
    }
  });

  it('an operator whose kit isn’t read yet says why HLITH has no pick, instead of guessing', async () => {
    const b = await of('chr_argent-flow');
    expect(b.stepWhy?.sets).toEqual(['Their kit hasn’t been read into the Kit check yet, so HLITH can’t pick from it.']);
    expect(b.subStats).toEqual([]);
  });
});
