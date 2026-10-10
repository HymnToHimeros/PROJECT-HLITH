// @vitest-environment node
/** T34: "assume signature + average build" for owned characters with no saved build, both games. */
import { describe, expect, it } from 'vitest';
import type { CharacterBuild, TeamAccount } from '../src/core/contract';
import { averageBuild, withAssumedBuilds } from '../src/core/rules/averageBuild';
import { buildFit } from '../src/core/rules/buildFit';
import { ASSUME as HSR } from '../src/games/hsr/assumed';
import { GEAR_SLOTS as HSR_SLOTS } from '../src/games/hsr/gear';
import { library as hsrLib } from '../src/games/hsr/kitcheck/library';
import { hsrTeamRules } from '../src/games/hsr/kitcheck/team';
import { ASSUME as ZZZ } from '../src/games/zzz/assumed';
import { library as zzzLib } from '../src/games/zzz/kitcheck/library';
import { zzzTeamRules } from '../src/games/zzz/kitcheck/team';

const idOf = (lib: { names: Map<string, string> }, n: string) => [...lib.names].find(([, v]) => v === n)?.[0] ?? n;
const all: TeamAccount = { owned: () => true, dupes: () => 0 };

describe('Average build (T34)', () => {
  it('HSR: the game’s recommended sets and first main stats, each recommended sub stat once per piece, never the main stat', () => {
    const id = idOf(hsrLib(), 'Silver Wolf');
    const rec = HSR.recommended(id);
    if (!rec) throw new Error('no recommendation');
    const b = averageBuild(id, rec, HSR);
    expect(b.level).toBe(80);
    const piece = (slot: string) => b.gear.find((g) => g.slot === slot);
    expect(piece('Head')?.main).toBe('HP');
    for (const [slot, mains] of Object.entries(rec.mainStats)) expect(piece(slot)?.main).toBe(mains[0]);
    for (const g of b.gear) {
      expect(Object.keys(g.subs).length).toBeLessThanOrEqual(4);
      expect(Object.keys(g.subs)).not.toContain(g.main);
      expect(Object.values(g.rolls ?? {}).every((r) => r === 1)).toBe(true);
    }
    expect(piece('Head')?.set).toBe(rec.sets.find((s) => s.pieces === 4)?.options[0]);
    expect(piece('Link Rope')?.set).toBe(rec.sets.find((s) => s.pieces === 2)?.options[0]);
  });

  it('reads like a real build: built for what the game recommends, not for what it doesn’t', () => {
    const id = idOf(hsrLib(), 'Silver Wolf');
    const rec = HSR.recommended(id);
    if (!rec) throw new Error('no recommendation');
    const b = averageBuild(id, rec, HSR);
    // The game builds her for Effect Hit Rate (Body) and SPD (Feet): those read as built, HP doesn't.
    expect(buildFit(b, 'effect-hit-rate', HSR_SLOTS).fit).not.toBe('not');
    expect(buildFit(b, 'hp', HSR_SLOTS).fit).toBe('not');
  });

  it('ZZZ: Disc 1–3 keep their fixed main stat, Disc 4–6 take the first recommended one, sets fill the discs in order', () => {
    const id = idOf(zzzLib(), 'Lucia');
    const rec = ZZZ.recommended(id);
    if (!rec) throw new Error('no recommendation');
    const b = averageBuild(id, rec, ZZZ, 2);
    expect(b).toMatchObject({ level: 60, dupes: 2 });
    expect(b.gear.map((g) => g.main).slice(0, 3)).toEqual(['HP', 'ATK', 'DEF']);
    for (const [slot, mains] of Object.entries(rec.mainStats)) expect(b.gear.find((g) => g.slot === slot)?.main).toBe(mains[0]);
    expect(b.gear.filter((g) => g.set === rec.sets[0]?.options[0]).length).toBe(rec.sets[0]?.pieces);
  });

  it('switch off: the account is unchanged; switch on: only owned characters with nothing saved are assumed', () => {
    const lib = hsrLib();
    const fx = idOf(lib, 'Feixiao');
    const rw = idOf(lib, 'Robin');
    const saved: CharacterBuild = { characterId: rw, level: 80, dupes: 0, gear: [{ slot: 'Body', main: 'ATK %', subs: {} }] };
    const base: TeamAccount = { owned: (id) => id !== idOf(lib, 'Acheron'), dupes: () => 0, build: (id) => (id === rw ? saved : undefined) };
    expect(withAssumedBuilds(base, HSR)).toBe(base);
    const on = withAssumedBuilds({ ...base, assumeAverage: true }, HSR);
    expect(on.assumed?.(fx)).toBe(true);
    expect(on.weapon?.(fx)).toMatchObject({ name: 'I Venture Forth to Hunt', refine: 1 });
    expect(on.build?.(fx)?.gear.length).toBe(6);
    // A saved build always wins; a character you don't own is never assumed.
    expect(on.assumed?.(rw)).toBe(false);
    expect(on.build?.(rw)).toBe(saved);
    expect(on.assumed?.(idOf(lib, 'Acheron'))).toBe(false);
  });
});

describe('Team scores with the switch on (T34)', () => {
  it('HSR: signature-only kit lines unlock, and the Why says what was assumed', () => {
    const lib = hsrLib();
    const team = ['Feixiao', 'Topaz & Numby', 'Robin', 'Aventurine'].map((n) => idOf(lib, n));
    const off = hsrTeamRules.verdict(team, all);
    const on = hsrTeamRules.verdict(team, { ...all, assumeAverage: true });
    if (!off.rated || !on.rated || !on.explain) throw new Error('not rated');
    expect(on.count).toBeGreaterThanOrEqual(off.count);
    expect(off.reasons.some((r) => /signature/.test(r.text) && r.group === 'not-counted')).toBe(true);
    expect(on.explain.missing.at(-1)).toMatch(/^No build saved for .*Feixiao \(signature I Venture Forth to Hunt\).*: scored with their signature weapon and an average build \(recommended sets and main stats, 1 roll per recommended sub stat\), as your setting asks\.$/);
    expect(off.explain?.missing.some((m) => /No build saved for/.test(m))).toBe(false);
  });

  it('ZZZ Billy + Dialyn + Lucia: Lucia’s wanted build is read from the assumed build, not "no build saved"', () => {
    const lib = zzzLib();
    const team = ['Starlight - Billy', 'Dialyn', 'Lucia'].map((n) => idOf(lib, n));
    const off = zzzTeamRules.verdict(team, all);
    const on = zzzTeamRules.verdict(team, { ...all, assumeAverage: true });
    if (!off.rated || !on.rated) throw new Error('not rated');
    const lucia = (v: typeof on) => v.wants?.find((w) => w.who === idOf(lib, 'Lucia'));
    expect(lucia(off)?.fit).toBe('no-build');
    expect(lucia(on)?.fit).not.toBe('no-build');
    expect(lucia(on)?.have).toMatch(/^assumed: signature Dreamlit Hearth, average build/);
    expect(on.notes.some((n) => /^No build saved for .*Lucia \(signature Dreamlit Hearth\)/.test(n))).toBe(true);
  });

  it('who fits and if you pull read the switch too', () => {
    const lib = zzzLib();
    const on = zzzTeamRules.ifYouPull?.(idOf(lib, 'Lucia'), { ...all, owned: (id) => id !== idOf(lib, 'Lucia'), assumeAverage: true });
    expect(on).not.toBeNull();
  });
});
