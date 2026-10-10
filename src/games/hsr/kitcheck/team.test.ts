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
    // Robin's ATK buff grows with her ATK (T18): 100% needs her built for ATK; with no build saved the team is short.
    const atkBuild = { characterId: id('Robin'), level: 80, dupes: 0, gear: ['Body', 'Feet', 'Planar Sphere', 'Link Rope'].map((slot) => ({ slot, main: 'ATK %', subs: { 'ATK %': 3.9 }, rolls: { 'ATK %': 2 } })) };
    const unbuilt = verdict(team.map(id), own(team));
    if (!unbuilt.rated) throw new Error(unbuilt.why);
    expect(unbuilt.percent).toBeLessThan(100);
    expect(unbuilt.wants?.find((w) => w.who === id('Robin'))).toMatchObject({ stat: 'ATK', fit: 'no-build', points: 0, max: 2 });
    const v = verdict(team.map(id), { ...own(team), build: (x) => (x === id('Robin') ? atkBuild : undefined) });
    expect(v.rated).toBe(true);
    if (!v.rated) return;
    expect(v.wants?.find((w) => w.who === id('Robin'))).toMatchObject({ fit: 'built', points: 2 });
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


describe('HSR: signature Light Cones count only when equipped (T18)', () => {
  const team = ['Feixiao', 'Topaz & Numby', 'Robin', 'Aventurine'];
  const robin = (lines: Line[]) => lines.find((l) => lib.names.get(l.who) === 'Robin' && l.entry === 'lc-cadenza');
  it('no Light Cone saved: Robin\'s signature is locked and earns nothing', () => {
    const r = check(team.map(id), lib, e0, id('Feixiao'));
    if (!r.rated) throw new Error(r.why);
    expect(robin(r.best.lines)?.kind).toBe('locked');
    expect(robin(r.best.lines)?.points).toBe(0);
  });
  it('another Light Cone saved: still locked, and says which one is saved', () => {
    const r = check(team.map(id), lib, { ...e0, weapon: () => ({ id: '21000', name: 'Post-Op Conversation' }) }, id('Feixiao'));
    if (!r.rated) throw new Error(r.why);
    expect(robin(r.best.lines)?.kind).toBe('locked');
    expect(robin(r.best.lines)?.why).toMatch(/Post-Op Conversation/);
  });
  it('Flowing Nightglow saved on Robin: the piece is read and the team count does not drop', () => {
    const without = check(team.map(id), lib, e0, id('Feixiao'));
    const withIt = check(team.map(id), lib, { ...e0, weapon: (x) => (x === id('Robin') ? { id: '23026', name: 'Flowing Nightglow' } : undefined) }, id('Feixiao'));
    if (!without.rated || !withIt.rated) throw new Error('not rated');
    const line = robin(withIt.best.lines);
    expect(line?.kind).not.toBe('locked');
    expect(withIt.best.count).toBeGreaterThanOrEqual(without.best.count);
  });
});

describe('HSR: builds a team wants (T18, owner\'s Phainon example)', () => {
  const team = ['Phainon', 'Robin • Summeretto', 'Sunday', 'Huohuo'];
  const rs = () => id('Robin • Summeretto');
  const hp = (mains: number, rolls: number) => ({
    characterId: rs(),
    level: 80,
    dupes: 0,
    gear: ['Body', 'Feet', 'Planar Sphere', 'Link Rope'].map((slot, i) => ({ slot, main: i < mains ? 'HP %' : 'SPD', subs: { 'HP %': 4 }, rolls: { 'HP %': i === 0 ? rolls : 0 } })),
  });
  const withBuild = (b?: ReturnType<typeof hp>) => verdict(team.map(id), { ...own(team), build: (x) => (x === rs() ? b : undefined) });
  const want = (v: ReturnType<typeof verdict>) => (v.rated ? v.wants?.find((w) => w.who === rs()) : undefined);

  it('Phainon’s team wants an HP build on Robin • Summeretto, with the kit line that says why', () => {
    const w = want(withBuild());
    expect(w).toMatchObject({ stat: 'HP', label: 'HP build on Robin • Summeretto', fit: 'no-build', points: 0, max: 2 });
    expect(w?.proof.quote).toMatch(/of Robin • Summeretto's Max HP/);
  });

  it('an HP build scores higher than a partly HP build, which scores higher than none', () => {
    const none = withBuild();
    const partly = withBuild(hp(1, 4));
    const built = withBuild(hp(4, 5));
    expect(want(partly)?.fit).toBe('partly');
    expect(want(built)?.fit).toBe('built');
    if (!none.rated || !partly.rated || !built.rated) throw new Error('not rated');
    expect(built.count).toBe(partly.count + 1);
    expect(partly.count).toBe(none.count + 1);
    expect(built.percent).toBeGreaterThan(none.percent);
  });

  it('the “Why” says it in words: what the team wants and what is missing', () => {
    const v = withBuild(hp(1, 4));
    if (!v.rated) throw new Error('not rated');
    expect(v.explain?.members.find((m) => m.id === rs())?.text).toMatch(/the team wants them built for HP: partly built for it/);
    expect(v.explain?.missing.some((m) => /Robin • Summeretto built for HP: partly built for it; up to 1 point more/.test(m))).toBe(true);
  });

  it('a build is only read for characters you own', () => {
    const v = verdict(team.map(id), { ...own(team.filter((n) => !n.startsWith('Robin'))), build: () => hp(4, 5) });
    expect(want(v)?.fit).toBe('no-build');
  });
});
