// @vitest-environment node
/** The build bands (T18, docs/logic/hsr-decisions.md 25–26). */
import { describe, expect, it } from 'vitest';
import { buildFit } from '../src/core/rules/buildFit';
import { GEAR_SLOTS as HSR } from '../src/games/hsr/gear';
import { GEAR_SLOTS as ZZZ } from '../src/games/zzz/gear';

const build = (gear: { slot: string; main: string; subs?: Record<string, number>; rolls?: Record<string, number> }[]) => ({ characterId: 'x', level: 80, dupes: 0, gear: gear.map((g) => ({ subs: {}, ...g })) });

describe('buildFit: is a saved build built for one stat?', () => {
  it('no build saved: said, scored at base', () => {
    expect(buildFit(undefined, 'hp', HSR)).toEqual({ fit: 'no-build', points: 0, have: 'no build saved' });
    expect(buildFit(build([]), 'hp', HSR).fit).toBe('no-build');
  });
  it('HSR HP: every slot that can be HP% plus 5 rolls is built; Head (always HP) is no sign', () => {
    const all = build(['Body', 'Feet', 'Planar Sphere', 'Link Rope'].map((slot) => ({ slot, main: 'HP %', subs: { 'HP %': 4, HP: 30 }, rolls: { 'HP %': 1, HP: 1 } })));
    expect(buildFit(all, 'hp', HSR)).toMatchObject({ fit: 'built', points: 2 });
    expect(buildFit(build([{ slot: 'Head', main: 'HP' }]), 'hp', HSR).fit).toBe('not');
  });
  it('partly: one HP% main and a few rolls', () => {
    expect(buildFit(build([{ slot: 'Body', main: 'HP %', subs: { 'HP %': 4 }, rolls: { 'HP %': 4 } }]), 'hp', HSR)).toMatchObject({ fit: 'partly', points: 1 });
  });
  it('SPD has one slot (Feet): Feet SPD and 4 rolls is built', () => {
    expect(buildFit(build([{ slot: 'Feet', main: 'SPD', subs: { SPD: 9 }, rolls: { SPD: 4 } }]), 'spd', HSR).fit).toBe('built');
  });
  it('subs without rolls count one each; says what it found', () => {
    const f = buildFit(build([{ slot: 'Disc 4', main: 'ATK %', subs: { ATK: 19, 'ATK %': 3 } }]), 'atk', ZZZ);
    expect(f.have).toBe('ATK main stat on Disc 4 (of 3 slots that can have it), 2 ATK sub-stat rolls');
    expect(f.fit).toBe('partly');
  });
});
