// @vitest-environment node
/** Build score (docs/logic/build-score.md) with real characters and the game's own recommendations. */
import { describe, expect, it } from 'vitest';
import type { CharacterBuild } from '../src/core/contract';
import { hsr } from '../src/games/hsr/contract';
import { zzz } from '../src/games/zzz/contract';
import { gradeOf } from '../src/core/rules/buildScore';

const score = (game: typeof hsr, b: CharacterBuild) => {
  const out = game.rules.scoreBuild?.(b);
  if (!out?.known) throw new Error('no score');
  return out.value;
};
const part = (v: ReturnType<typeof score>, label: string) => v.parts?.find((p) => p.label === label);

describe('Build score', () => {
  it('Robin with the recommended build scores 100 (S), each part explained', () => {
    const relic = (slot: string, main: string) => ({ slot, main, set: 'Musketeer of Wild Wheat', subs: { 'ATK %': 10, SPD: 4 } });
    const v = score(hsr, {
      characterId: '1309',
      level: 80,
      dupes: 0,
      weapon: { name: 'Flowing Nightglow', level: 80 },
      gear: [
        relic('Head', 'HP'),
        relic('Hands', 'ATK'),
        relic('Body', 'ATK %'),
        relic('Feet', 'ATK %'),
        { slot: 'Planar Sphere', main: 'ATK %', set: 'Sprightly Vonwacq', subs: { ATK: 30 } },
        { slot: 'Link Rope', main: 'Energy Regeneration Rate', set: 'Sprightly Vonwacq', subs: { SPD: 2 } },
      ],
    });
    expect(v.score).toBe(100);
    expect(v.grade).toBe('S');
    expect(part(v, '4-piece set')?.detail).toBe('Musketeer of Wild Wheat on 4 pieces.');
    expect(part(v, 'Weapon')?.detail).toBe('Flowing Nightglow is recommended (#1 of 3).');
    expect(v.basis).toContain("the game's own recommendation");
  });

  it('wrong main stat, off-list weapon and half-useful sub stats lower the score, and say why', () => {
    const v = score(hsr, {
      characterId: '1309',
      level: 40,
      dupes: 0,
      weapon: { name: 'Cornucopia' },
      gear: [{ slot: 'Body', main: 'CRIT Rate', subs: { 'ATK %': 5, 'CRIT DMG': 6 } }],
    });
    expect(part(v, 'Level')?.value).toBe(50);
    expect(part(v, 'Weapon')?.value).toBe(0);
    expect(part(v, 'Body main stat')?.detail).toBe('CRIT Rate; recommended: ATK %.');
    expect(part(v, 'Sub stats')?.value).toBe(50);
    // Nothing entered for the other slots or sets: shown as no data yet, not counted.
    expect(part(v, 'Feet main stat')?.value).toBeNull();
    expect(part(v, '4-piece set')?.value).toBeNull();
    expect(v.score).toBe(Math.round((50 + 0 + 0 + 50) / 4));
    expect(v.basis).toMatch(/not counted/);
  });

  it('HSR relic sets count only on Head, Hands, Body and Feet; planar sets only on Sphere and Rope', () => {
    const v = score(hsr, {
      characterId: '1309',
      level: 80,
      dupes: 0,
      gear: ['Head', 'Hands', 'Body', 'Planar Sphere'].map((slot) => ({ slot, main: '', subs: {}, set: 'Musketeer of Wild Wheat' })),
    });
    expect(part(v, '4-piece set')?.value).toBe(0);
  });

  it('sub stats weigh by rolls when the rolls are known (ZZZ Dialyn)', () => {
    const v = score(zzz, {
      characterId: '1481',
      level: 60,
      dupes: 0,
      gear: [{ slot: 'Disc 4', main: 'CRIT Rate', subs: { 'CRIT DMG': 24, HP: 112 }, rolls: { 'CRIT DMG': 3, HP: 1 } }],
    });
    expect(part(v, 'Sub stats')?.value).toBe(75);
    expect(part(v, 'Sub stats')?.detail).toContain('3 of 4 rolls');
  });

  it('ZZZ discs: any six slots count toward the 4- and 2-piece sets', () => {
    const disc = (n: number, set: string) => ({ slot: `Disc ${n}`, main: '', subs: {}, set });
    const v = score(zzz, { characterId: '1481', level: 60, dupes: 0, gear: [1, 2, 3, 4].map((n) => disc(n, 'King of the Summit')).concat([disc(5, 'Shockstar Disco'), disc(6, 'Shockstar Disco')]) });
    expect(part(v, '4-piece set')?.value).toBe(100);
    expect(part(v, '2-piece set')?.value).toBe(100);
  });

  it('no recommendation for the character: no score, never a guess', () => {
    expect(hsr.rules.scoreBuild?.({ characterId: 'nobody', level: 80, dupes: 0, gear: [] }).known).toBe(false);
  });

  it('grades', () => {
    expect([95, 80, 65, 45, 10].map(gradeOf)).toEqual(['S', 'A', 'B', 'C', 'D']);
  });
});

describe('No score from too little (FRAME’s report: "100/100 · S" from the level alone)', () => {
  it('with fewer than 3 checked parts there is no score yet', () => {
    const levelOnly: CharacterBuild = { characterId: '1005', level: 80, dupes: 0, gear: [] };
    expect(hsr.rules.scoreBuild?.(levelOnly)).toMatchObject({ known: false });
  });
});
