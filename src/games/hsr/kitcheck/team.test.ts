// @vitest-environment node
/** The worked examples of docs/logic/hsr-theory.md, and what the Roster builds on the check. */
import { describe, expect, it } from 'vitest';
import type { TeamAccount } from '../../../core/contract';
import { check, compare, type Line } from './check';
import teamsJson from '../data/teams.json';
import type { TeamPreset } from '../../../core/contract';
import { buildLibrary, library, SHEETS } from './library';
import { gameTeams, hsrTeamRules, ifYouPull, lineUps, recommendedTeams, synergyLabel, verdict, whoFits } from './team';

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
  it('1. Feixiao + Topaz + Robin + Aventurine: Proof of Debt counts (Follow-Up ATK), two Follow-Up chains, 9 for Feixiao', () => {
    const r = run('Feixiao', 'Topaz & Numby', 'Robin', 'Aventurine');
    expect(has(r.lines, 'buff', 'Topaz & Numby', /Follow-Up ATK DMG taken/)).toBe(true);
    expect(has(r.lines, 'chain', 'Topaz & Numby', /Follow-Up/)).toBe(true);
    expect(has(r.lines, 'chain', 'Aventurine', /Follow-Up/)).toBe(true);
    expect(r.sustain).toBe(true);
    // The worked example counts Feixiao's side: 9. Topaz is a carry on Feixiao's own game team, so what reaches
    // her counts too (decision 33): the team total adds her side.
    expect(r.lines.filter((l) => !l.forDd).reduce((n, l) => n + l.points, 0)).toBe(9);
    expect(r.coDds).toEqual([id('Topaz & Numby')]);
    expect(r.count).toBeGreaterThan(9);
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

  it('a team does not need a healer or shield (owner’s ruling, decision 32): no penalty, no label, no tiebreak', () => {
    const team = ['Aventurine • Waveflair', 'Mortenax Blade', 'Ashveil', 'Robin • Summeretto'].map(id);
    const v = verdict(team, own(['Aventurine • Waveflair', 'Mortenax Blade', 'Ashveil', 'Robin • Summeretto']));
    if (!v.rated) throw new Error(v.why);
    expect(v.label).not.toMatch(/sustain/);
    expect(v.notes.some((n) => /sustain/i.test(n))).toBe(false);
    const healer = check(team.slice(0, 3).concat(id('Huohuo')), lib, e0, team[0]);
    const none = check(team, lib, e0, team[0]);
    if (!healer.rated || !none.rated) throw new Error('not rated');
    // Equal counts rank the same whether or not someone heals: only count, team support and chains decide.
    expect(compare({ ...none.best, sustain: false }, { ...none.best, sustain: true })).toBe(0);
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

  it('Who fits, Line-ups and If you pull (only teammates the carry’s own game team lists)', () => {
    const mine = ['Feixiao', 'Topaz & Numby', 'Tribbie', 'Aventurine'];
    const fits = whoFits([id('Feixiao'), id('Tribbie'), id('Aventurine')], own(mine));
    expect(fits.find((f) => f.id === id('Topaz & Numby'))?.how.some((h) => /Follow-Up/.test(h))).toBe(true);
    // Robin isn't in Feixiao's own game team, so she is never suggested for him.
    expect(whoFits([id('Feixiao')], own([...mine, 'Robin'])).some((f) => f.id === id('Robin'))).toBe(false);
    const ups = lineUps(own([...mine, 'Acheron', 'Jiaoqiu', 'Pela', 'Huohuo']));
    expect(ups.length).toBe(2);
    expect(new Set(ups.flatMap((u) => u.members)).size).toBe(8);
    const pull = ifYouPull(id('Topaz & Numby'), own(['Feixiao', 'Tribbie', 'Aventurine', 'Huohuo']));
    expect(pull?.percent).toBeGreaterThan(0);
  });
});

describe('HSR: teams are built around real damage dealers (T19)', () => {
  it("the game builds teams around Feixiao, never around March 7th (Hunt), Topaz or Moze, who are Feixiao's partners", () => {
    for (const c of ['Feixiao', 'Acheron', 'Firefly', 'Kafka', 'The Herta']) expect(lib.centres.has(id(c)), c).toBe(true);
    for (const c of ['March 7th', 'Topaz & Numby', 'Moze', 'Dr. Ratio', 'Black Swan']) expect(lib.centres.has([...lib.names].find(([k, n]) => n === c && lib.sheets.get(k)?.damage)?.[0] ?? ''), c).toBe(false);
  });

  it('only a carry’s own game team is a team: partner and starter pages (March 7th (Hunt), March 7th, Asta, Bronya) are not', () => {
    const shown = gameTeams(teamsJson as TeamPreset[]);
    for (const t of ['game-1224-1', 'game-1001-1', 'game-1009-1', 'game-1101-1']) expect(shown.some((x) => x.id === t), t).toBe(false);
    const fei = shown.find((x) => x.id === 'game-1220-1');
    expect(fei?.slots[0]?.characters).toEqual([id('Feixiao')]);
    expect(fei?.name).toBe('Feixiao team');
    expect(shown.filter((x) => x.slots.some((sl) => sl.characters.includes(id('Phainon')))).map((x) => x.name)).toEqual(['Phainon team']);
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

describe('HSR: any equipped Light Cone counts when its path is the wearer’s (T18 step 4)', () => {
  const team = ['Feixiao', 'Topaz & Numby', 'Robin', 'Aventurine'];
  const run = (weapon: { id: string; name: string } | undefined, wearer = 'Robin') => {
    const r = check(team.map(id), lib, { ...e0, weapon: (x) => (x === id(wearer) ? weapon : undefined) }, id('Feixiao'));
    if (!r.rated) throw new Error(r.why);
    return r.best.lines.filter((l) => l.piece?.startsWith('weapon:'));
  };
  it('Dance! Dance! Dance! (Harmony) on Robin (Harmony) is read, with the Light Cone named as proof', () => {
    const lines = run({ id: '21018', name: 'Dance! Dance! Dance!' });
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((l) => l.piece === 'weapon:21018' && l.kind !== 'locked')).toBe(true);
    const v = verdict(team.map(id), { ...own(team), weapon: (x) => (x === id('Robin') ? { id: '21018', name: 'Dance! Dance! Dance!' } : undefined) });
    if (!v.rated) throw new Error(v.why);
    expect(v.reasons.some((x) => x.proof?.skill === 'Light Cone: Dance! Dance! Dance!')).toBe(true);
  });
  it('a Destruction Light Cone on Robin does nothing (its effect only works for Destruction)', () => {
    expect(run({ id: '20002', name: 'Collapsing Sky' })).toEqual([]);
  });
  it('someone else’s signature works on another wearer of its path: Robin’s Flowing Nightglow on Topaz does nothing (Hunt), on Robin it is her kit piece', () => {
    expect(run({ id: '23026', name: 'Flowing Nightglow' }, 'Topaz & Numby')).toEqual([]);
    expect(run({ id: '23026', name: 'Flowing Nightglow' })).toEqual([]);
  });
});

describe('HSR: a signature on another wearer of its path', () => {
  it('Robin’s Flowing Nightglow on Sparkle (Harmony) brings its team buff', () => {
    const team = ['Feixiao', 'Topaz & Numby', 'Sparkle', 'Aventurine'];
    const r = check(team.map(id), lib, { ...e0, weapon: (x) => (x === id('Sparkle') ? { id: '23026', name: 'Flowing Nightglow' } : undefined) }, id('Feixiao'));
    if (!r.rated) throw new Error(r.why);
    const lines = r.best.lines.filter((l) => l.piece === 'weapon:23026');
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((l) => lib.names.get(l.who) === 'Sparkle' && l.kind !== 'locked')).toBe(true);
  });
});

describe('HSR: the owner’s Phainon test (report 2026-10-10: no mix-matching, the better unit is picked)', () => {
  const owned = ['Phainon', 'Sunday', 'Cerydra', 'Dan Heng • Permansor Terrae', 'March 7th', 'Asta', 'Bronya', 'Tingyun', 'Sparkle', 'Huohuo'];
  const phainonTeams = () => gameTeams(teamsJson as TeamPreset[]).filter((t) => t.slots.some((s) => s.characters.includes(id('Phainon'))));
  it('owning Phainon, Sunday, Cerydra and Dan Heng • Permansor Terrae, his team is exactly those four', () => {
    const teams = phainonTeams();
    expect(teams.length).toBe(1);
    const t = teams[0];
    if (!t) throw new Error('no Phainon team');
    const members = hsrTeamRules.fill?.(t, own(owned)) ?? [];
    expect([...members].sort()).toEqual(['Phainon', 'Sunday', 'Cerydra', 'Dan Heng • Permansor Terrae'].map(id).sort());
    expect(members[0]).toBe(id('Phainon'));
  });
  it('no team with March 7th, Asta or Bronya is shown for Phainon, and none is suggested beside him', () => {
    for (const t of phainonTeams()) for (const n of ['March 7th', 'Asta', 'Bronya']) expect(t.slots.some((s) => s.characters.includes(id(n))), n).toBe(false);
    const fits = whoFits([id('Phainon')], own(owned)).map((f) => lib.names.get(f.id));
    for (const n of ['March 7th', 'Asta', 'Bronya', 'Tingyun', 'Sparkle']) expect(fits, n).not.toContain(n);
    expect(fits).toEqual(expect.arrayContaining(['Sunday', 'Cerydra', 'Dan Heng • Permansor Terrae']));
  });
  it('the best team found for Phainon comes from his own game team, never Tingyun + Sparkle + Huohuo', () => {
    const v = verdict(['Phainon', 'Cerydra', 'Sunday', 'Dan Heng • Permansor Terrae'].map(id), own(owned));
    if (!v.rated) throw new Error(v.why);
    for (const n of ['Tingyun', 'Sparkle', 'March 7th', 'Asta', 'Bronya']) expect(v.bestMembers.map((m) => lib.names.get(m)), n).not.toContain(n);
  });
});

describe('HSR: the owner’s own team lists (decision 31)', () => {
  const owned = ['Phainon', 'Sunday', 'Cerydra', 'Dan Heng • Permansor Terrae', 'Robin • Summeretto'];
  const phainon = () => gameTeams(teamsJson as TeamPreset[]).find((t) => t.id === 'game-1408-1');
  // The card shows Phainon's slot first, then Cerydra's, Cyrene's and the sustain slot; the owner puts Robin • Summeretto first in slot 3.
  const list = () => (phainon()?.slots ?? []).map((s, i) => (i === 2 ? [id('Robin • Summeretto'), ...s.characters] : s.characters));
  const withList = () => ({ ...own(owned), teamList: (p: string) => (p === 'game-1408-1' ? list() : undefined) });
  it('without an edit Robin • Summeretto is never suggested for Phainon (the game’s page doesn’t list her)', () => {
    expect(whoFits([id('Phainon')], own(owned)).some((f) => f.id === id('Robin • Summeretto'))).toBe(false);
  });
  it('with the owner’s list, the card fills Phainon, Cerydra, Robin • Summeretto, Dan Heng • Permansor Terrae', () => {
    const t = phainon();
    if (!t) throw new Error('no Phainon team');
    expect(hsrTeamRules.fill?.(t, withList())).toEqual(['Phainon', 'Cerydra', 'Robin • Summeretto', 'Dan Heng • Permansor Terrae'].map(id));
  });
  it('and she becomes a teammate everywhere teams are made, with the Why saying the list is the owner’s', () => {
    expect(whoFits([id('Phainon')], withList()).some((f) => f.id === id('Robin • Summeretto'))).toBe(true);
    const v = verdict(['Phainon', 'Cerydra', 'Robin • Summeretto', 'Dan Heng • Permansor Terrae'].map(id), withList());
    if (!v.rated) throw new Error(v.why);
    expect(v.notes.some((n) => /edited by you/.test(n))).toBe(true);
  });
});

describe('HSR: characters the owner hid (the unpicked Trailblazer) are never used', () => {
  const caelus = new Set(['8001', '8003', '8005', '8007', '8009']);
  const everyone = [...lib.sheets.keys()];
  const a = { owned: () => true, dupes: () => 0, skip: (x: string) => caelus.has(x) };
  it('no card, suggestion or best team uses a hidden Trailblazer', () => {
    for (const t of gameTeams(teamsJson as TeamPreset[])) for (const m of hsrTeamRules.fill?.(t, a) ?? []) expect(caelus.has(m), `${t.name}: ${m}`).toBe(false);
    for (const dd of ['Castorice', 'Phainon', 'Feixiao']) {
      expect(whoFits([id(dd)], a).some((f) => caelus.has(f.id)), dd).toBe(false);
      const v = verdict([id(dd)], a);
      if (v.rated) expect(v.bestMembers.some((m) => caelus.has(m)), dd).toBe(false);
    }
    expect(everyone.some((x) => caelus.has(x))).toBe(true);
  });
});

describe('HSR: the owner’s Team 1 (Aventurine • Waveflair, Mortenax Blade, Ashveil, Robin • Summeretto)', () => {
  const team = ['Aventurine • Waveflair', 'Mortenax Blade', 'Ashveil', 'Robin • Summeretto'];
  const v = () => verdict(team.map(id), own(team));
  it('solo modes are read: no other Elation / Nihility switches them on, and the duo branch costs nothing', () => {
    const r = check(team.map(id), lib, e0, id('Aventurine • Waveflair'));
    if (!r.rated) throw new Error(r.why);
    const lines = r.best.lines;
    expect(lines.some((l) => l.entry === 'revel-solo-follow-up' && l.kind === 'switched-on')).toBe(true);
    expect(lines.some((l) => l.entry === 'heart-self-dmg' && l.points > 0)).toBe(true);
    expect(lines.some((l) => l.points < 0 && (l.entry === 'revel-elation' || /another Nihility/.test(l.tag)))).toBe(false);
  });
  it('it is the game’s own multi-carry team: Mortenax Blade’s and Ashveil’s damage count too', () => {
    const r = check(team.map(id), lib, e0, id('Aventurine • Waveflair'));
    if (!r.rated) throw new Error(r.why);
    expect([...(r.best.coDds ?? [])].sort()).toEqual([id('Mortenax Blade'), id('Ashveil')].sort());
    const x = v();
    if (!x.rated) throw new Error(x.why);
    expect(x.explain?.headline).toMatch(/^Aventurine • Waveflair deals the damage, with (Mortenax Blade and Ashveil|Ashveil and Mortenax Blade)\./);
    expect(x.label).not.toMatch(/sustain/);
    expect(x.percent).toBeGreaterThanOrEqual(65);
  });
});
