// @vitest-environment node
/** The worked examples of docs/logic/hsr-theory.md, and what the Roster builds on the check. */
import { describe, expect, it } from 'vitest';
import type { TeamAccount } from '../../../core/contract';
import { check, type Line } from './check';
import teamsJson from '../data/teams.json';
import type { TeamPreset } from '../../../core/contract';
import { buildLibrary, library, SHEETS } from './library';
import { gameTeams, ifYouPull, lineUps, recommendedTeams, synergyLabel, verdict, whoFits } from './team';

const lib = library();
const id = (name: string) => {
  const found = [...lib.names].find(([, n]) => n === name)?.[0];
  if (!found) throw new Error(`no ${name}`);
  return found;
};
const e0 = { eidolon: () => 0, enhanced: () => undefined };
const run = (...names: string[]) => {
  const out = check(names.map(id), lib, e0, id(names[0] ?? ''));
  if (!out.rated) throw new Error(out.why);
  return out.best;
};
const has = (lines: Line[], kind: Line['kind'], who: string, tag: RegExp) => lines.some((l) => l.kind === kind && lib.names.get(l.who) === who && tag.test(l.tag));
const own = (names: string[], dupes = 0): TeamAccount => {
  const ids = new Set(names.map(id));
  return { owned: (x) => ids.has(x), dupes: () => dupes };
};

describe('HSR check: worked examples', () => {
  it('1. Feixiao + Topaz + Robin + Aventurine: Proof of Debt counts (Follow-Up ATK), two Follow-Up chains, count 9', () => {
    const r = run('Feixiao', 'Topaz & Numby', 'Robin', 'Aventurine');
    expect(has(r.lines, 'buff', 'Topaz & Numby', /Follow-Up ATK DMG taken/)).toBe(true);
    expect(has(r.lines, 'chain', 'Topaz & Numby', /Follow-Up/)).toBe(true);
    expect(has(r.lines, 'chain', 'Aventurine', /Follow-Up/)).toBe(true);
    expect(r.sustain).toBe(true);
    expect(r.count).toBe(9);
  });

  it('2. Acheron + Jiaoqiu + Pela + Aventurine: The Abyss switched on by Nihility teammates, every debuff chains, count 9', () => {
    const r = run('Acheron', 'Jiaoqiu', 'Pela', 'Aventurine');
    const abyss = r.lines.filter((l) => l.kind === 'switched-on');
    expect(abyss.map((l) => l.tag)).toEqual(['Her DMG ×1.15 (1 other Nihility)', 'Her DMG ×1.6 (2 other Nihility)']);
    expect(abyss[0]?.helpers?.map((h) => lib.names.get(h)).sort()).toEqual(['Jiaoqiu', 'Pela']);
    expect(r.lines.filter((l) => l.kind === 'chain').map((l) => lib.names.get(l.who)).sort()).toEqual(['Aventurine', 'Jiaoqiu', 'Pela']);
    expect(r.count).toBe(9);
    // Without a second Nihility the full tier is off (−1) and Robin's debuff-less kit adds no chain.
    const swap = run('Acheron', 'Jiaoqiu', 'Robin', 'Aventurine');
    expect(swap.lines.some((l) => l.kind === 'off' && l.tag === 'Her DMG ×1.6 (2 other Nihility)')).toBe(true);
    expect(swap.chains).toBe(r.chains - 1);
  });

  it('3. Firefly + Ruan Mei + Harmony Trailblazer + Lingsha: Befog reaches Firefly (Break DMG), not a Follow-Up carry', () => {
    const r = run('Firefly', 'Ruan Mei', 'Trailblazer · Harmony (Caelus)', 'Lingsha');
    expect(has(r.lines, 'buff', 'Lingsha', /Break DMG taken/)).toBe(true);
    expect(r.count).toBe(8);
    const f = run('Feixiao', 'Ruan Mei', 'Trailblazer · Harmony (Caelus)', 'Lingsha');
    expect(has(f.lines, 'buff', 'Lingsha', /Break DMG taken/)).toBe(false);
    expect(has(f.lines, 'buff', 'Trailblazer · Harmony (Caelus)', /Super Break DMG \+/)).toBe(false);
  });

  it('each teammate counts each stat once, however many sentences give it', () => {
    const r = run('Feixiao', 'Sparkle', 'Robin', 'Silver Wolf');
    const counted = r.lines.filter((l) => l.kind === 'buff' && lib.names.get(l.who) === 'Robin');
    expect(counted.length).toBe(5);
    expect(r.lines.some((l) => l.kind === 'not-counted' && /already counts once/.test(l.why))).toBe(true);
  });

  it('a team without a healer or shield says so, and the best team always has one', () => {
    expect(run('Feixiao', 'Sparkle', 'Robin', 'Silver Wolf').sustain).toBe(false);
    for (const p of recommendedTeams()) {
      const r = run(...p.slots.map((s) => lib.names.get(s.characters[0] ?? '') ?? ''));
      expect(r.sustain, p.name).toBe(true);
    }
  });

  it('only one Trailblazer form per team', () => {
    for (const p of recommendedTeams()) expect(p.slots.filter((s) => (s.characters[0] ?? '').startsWith('80')).length, p.name).toBeLessThanOrEqual(1);
  });

  it('Eidolons lock: Acheron E2 needs E2', () => {
    const r = run('Acheron', 'Jiaoqiu', 'Pela', 'Aventurine');
    expect(r.lines.some((l) => l.kind === 'locked' && lib.names.get(l.who) === 'Acheron' && /needs E2/.test(l.why))).toBe(true);
  });
});

describe('HSR team rules for the Roster', () => {
  const team = ['Feixiao', 'Topaz & Numby', 'Robin', 'Aventurine'];

  it('synergy %: the team against the best for its damage dealer, with every reason and quote', () => {
    const v = verdict(team.map(id), own(team));
    expect(v.rated).toBe(true);
    if (!v.rated) return;
    expect(v.percent).toBe(100);
    expect(v.unordered).toBe(true);
    expect(v.order[0]).toBe(id('Feixiao'));
    expect(v.reasons.filter((x) => x.group === 'counted').every((x) => x.proof?.quote)).toBe(true);
    const all = verdict(team.map(id), own([...lib.sheets.keys()].map((x) => lib.names.get(x) ?? x)));
    if (all.rated) expect(all.percent).toBeLessThan(100);
  });

  it('labels, and teams of fewer than four are Incomplete', () => {
    expect(synergyLabel(90, 4)).toBe('Excellent');
    expect(synergyLabel(70, 4)).toBe('Good');
    expect(synergyLabel(90, 3)).toBe('Incomplete');
  });

  it('not rated: a character whose kit is not read yet', () => {
    const partial = buildLibrary(SHEETS.filter((s) => s.characterId !== id('Robin')));
    const v = verdict(team.map(id), own(team), partial);
    expect(v.rated).toBe(false);
    if (!v.rated) expect(v.why).toContain('Robin');
  });

  it('Who fits, Line-ups and If you pull', () => {
    const fits = whoFits([id('Feixiao'), id('Robin'), id('Aventurine')], own(team));
    expect(fits.find((f) => f.id === id('Topaz & Numby'))?.how.some((h) => /Follow-Up/.test(h))).toBe(true);
    const ups = lineUps(own([...team, 'Acheron', 'Jiaoqiu', 'Pela', 'Huohuo']));
    expect(ups.length).toBe(2);
    expect(new Set(ups.flatMap((u) => u.members)).size).toBe(8);
    const pull = ifYouPull(id('Topaz & Numby'), own(['Feixiao', 'Robin', 'Aventurine', 'Pela']));
    expect(pull?.percent).toBeGreaterThan(0);
  });
});

describe('HSR: teams are built around real damage dealers (T19)', () => {
  it("the game builds teams around Feixiao, never around March 7th (Hunt), Topaz or Moze, who are Feixiao's partners", () => {
    for (const c of ['Feixiao', 'Acheron', 'Firefly', 'Kafka', 'The Herta']) expect(lib.centres.has(id(c)), c).toBe(true);
    for (const c of ['March 7th', 'Topaz & Numby', 'Moze', 'Dr. Ratio', 'Black Swan']) expect(lib.centres.has([...lib.names].find(([k, n]) => n === c && lib.sheets.get(k)?.damage)?.[0] ?? ''), c).toBe(false);
  });

  it("the game's team from March 7th (Hunt)'s page leads with Feixiao and is named after her", () => {
    const t = gameTeams(teamsJson as TeamPreset[]).find((x) => x.id === 'game-1224-1');
    expect(t?.slots[0]?.characters[0]).toBe(id('Feixiao'));
    expect(t?.name).toBe('Feixiao team · with March 7th');
  });

  it('in a team with March 7th (Hunt) and Feixiao, Feixiao is the damage dealer, whoever is listed first', () => {
    const v = verdict(['1224', id('Feixiao'), id('Robin'), id('Aventurine')], own([]));
    expect(v.rated && v.order[0]).toBe(id('Feixiao'));
  });

  it('kit-check teams are only built around centres, and never use another centre the game never pairs with them', () => {
    const teams = recommendedTeams();
    for (const p of teams) expect(lib.centres.has(p.slots[0]?.characters[0] ?? ''), p.name).toBe(true);
    const fei = teams.find((p) => p.slots[0]?.characters[0] === id('Feixiao'));
    expect(fei?.slots.flatMap((s) => s.characters)).not.toContain(id('Castorice'));
  });
});

