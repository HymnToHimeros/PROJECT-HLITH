// @vitest-environment node
/** T30: the kit value. Sizes from the kit text, one kind adds up, kinds multiply; the owner's teams and the method hold. */
import { describe, expect, it } from 'vitest';
import { partOf, percentOf, POINTS, sizeOf, typicalSize, value } from '../src/core/rules/kitValue';
import { check } from '../src/games/hsr/kitcheck/check';
import { library as hsrLib } from '../src/games/hsr/kitcheck/library';
import { verdict as hsrVerdict } from '../src/games/hsr/kitcheck/team';
import { library as zzzLib } from '../src/games/zzz/kitcheck/library';
import { verdict as zzzVerdict } from '../src/games/zzz/kitcheck/team';

const idOf = (lib: { names: Map<string, string> }, n: string) => [...lib.names].find(([, v]) => v === n)?.[0] ?? n;
const all = { owned: () => true, dupes: () => 0 };

describe('Sizes from the kit text', () => {
  it('reads percentages, multipliers, stacks, steps and skill-level formulas', () => {
    expect(sizeOf('+40%')).toBeCloseTo(0.4);
    expect(sizeOf('−30%')).toBeCloseTo(-0.3);
    expect(sizeOf('up to +100.8%')).toBeCloseTo(1.008);
    expect(sizeOf('+50%, 2 turns')).toBeCloseTo(0.5);
    expect(sizeOf('×1.35')).toBeCloseTo(0.35);
    expect(sizeOf('+20% per stack, up to 2')).toBeCloseTo(0.4);
    expect(sizeOf('+11.2%/16.8%/22.4% with 1/2/3 Songbirds')).toBeCloseTo(0.224);
    expect(sizeOf('(7 + 1.5 × Special Attack level)%')).toBeCloseTo(0.25);
    expect(sizeOf('+15% at 1 stack, +5% per extra stack, up to 5 stacks')).toBeCloseTo(0.35);
    expect(sizeOf('+20% to +60% (fewer enemies, more)')).toBeCloseTo(0.6);
    expect(sizeOf('+600 ATK')).toBeUndefined();
  });

  it('no stated percentage: the typical buff (the middle of the stated ones), said as such', () => {
    expect(typicalSize([0.1, 0.2, 0.5])).toBeCloseTo(0.2);
    expect(partOf('atk', '+1,200', 0.2)).toEqual({ zone: 'atk', size: 0.2, how: 'typical' });
    expect(partOf('dmg', '+40%', 0.2)).toEqual({ zone: 'dmg', size: 0.4, how: 'stated' });
  });

  it('an extra hit counts its % only when it is a share of the damage dealer’s own damage', () => {
    expect(partOf('extra-dmg', '24% of each hit as True DMG', 0.2)).toMatchObject({ size: 0.24, how: 'stated' });
    expect(partOf('extra-dmg', "80% of the Bondmate's ATK as Additional DMG, 2 actions", 0.2)).toMatchObject({ size: 0.2, how: 'typical' });
  });
});

describe('One kind adds up, kinds multiply', () => {
  it('Lucia’s +20% and Dialyn’s +40% DMG make +60%, not ×1.2 × ×1.4', () => {
    const same = value([[{ zone: 'dmg', size: 0.2, how: 'stated' }], [{ zone: 'dmg', size: 0.4, how: 'stated' }]]);
    expect(same.multiplier).toBeCloseTo(1.6);
    const apart = value([[{ zone: 'dmg', size: 0.2, how: 'stated' }], [{ zone: 'crit-dmg', size: 0.4, how: 'stated' }]]);
    expect(apart.multiplier).toBeCloseTo(1.68);
    // Each line's share adds up to the team's value exactly.
    expect(same.shares.reduce((n, x) => n + x, 0)).toBeCloseTo(same.points);
    expect(percentOf(POINTS * Math.log(1.6), POINTS * Math.log(1.68))).toBe(95);
  });
});

describe('The method’s count stays as written; the kit value ranks', () => {
  it('ZZZ: Billy > Dialyn > Lucia counts 9 (the method) and is the best squad by kit value; Billy > Lucia > Pan Yinhu is only Partly (owner’s T38)', () => {
    const lib = zzzLib();
    const ids = (ns: string[]) => ns.map((n) => idOf(lib, n));
    const mine = zzzVerdict(ids(['Starlight - Billy', 'Dialyn', 'Lucia']), all);
    expect(mine).toMatchObject({ rated: true, count: 9, bestMembers: ids(['Starlight - Billy', 'Dialyn', 'Lucia']) });
    expect(zzzVerdict(ids(['Starlight - Billy', 'Lucia', 'Pan Yinhu']), all)).toMatchObject({ rated: true, label: 'Partly' });
  });

  it('owner’s ruling: Astra Yao’s +1,200 ATK adds 0 to Starlight - Billy (his damage runs on Sheer Force, not ATK)', () => {
    const lib = zzzLib();
    const v = zzzVerdict(['Starlight - Billy', 'Dialyn', 'Astra Yao'].map((n) => idOf(lib, n)), all);
    if (!v.rated) throw new Error('not rated');
    const atk = v.reasons.find((r) => r.text.includes('ATK up to +1,200'));
    expect(atk?.points ?? 0).toBe(0);
  });

  it('an Anomaly squad without a Stun loses nothing for it: no role is needed unless a kit asks for it', () => {
    const lib = zzzLib();
    const v = zzzVerdict(['Miyabi', 'Yanagi', 'Astra Yao'].map((n) => idOf(lib, n)), all);
    if (!v.rated) throw new Error('not rated');
    expect(v.reasons.some((r) => /stun/i.test(r.text) && r.points < 0)).toBe(false);
  });
});

describe('Kit facts read for T30', () => {
  const lib = hsrLib();
  const ideal = { eidolon: () => 0, enhanced: () => 1, ideal: true };
  const team = (ns: string[]) => ns.map((n) => idOf(lib, n));

  it('Phainon: a teammate who shields him switches on +45% DMG; one whose abilities target him, +30% CRIT DMG (his own kit asks)', () => {
    const t = team(['Phainon', 'Sunday', 'Cerydra', 'Dan Heng • Permansor Terrae']);
    const out = check(t, lib, ideal, t[0]);
    if (!out.rated) throw new Error('not rated');
    const on = out.best.lines.filter((l) => l.kind === 'switched-on').map((l) => l.tag);
    expect(on).toEqual(expect.arrayContaining(['+45% DMG when a teammate heals or shields him', '+30% CRIT DMG when teammates target him']));
    const noShield = team(['Phainon', 'Sunday', 'Cerydra', 'Robin']);
    const out2 = check(noShield, lib, ideal, noShield[0]);
    if (!out2.rated) throw new Error('not rated');
    expect(out2.best.lines.find((l) => l.tag.startsWith('+45% DMG'))?.kind).toBe('off');
  });

  it('Aventurine • Waveflair as the only Elation character: Ashveil’s Follow-Up ATK CRIT DMG reaches him; teammates’ extra attacks feed his Fervor', () => {
    const t = team(['Aventurine • Waveflair', 'Mortenax Blade', 'Ashveil', 'Robin • Summeretto']);
    const out = check(t, lib, ideal, t[0]);
    if (!out.rated) throw new Error('not rated');
    const mine = out.best.lines.filter((l) => !l.forDd);
    expect(mine.some((l) => l.kind === 'buff' && l.tag === 'Allies: Follow-Up ATK CRIT DMG +80%')).toBe(true);
    expect(mine.filter((l) => l.kind === 'chain').map((l) => l.who)).toEqual(expect.arrayContaining(team(['Ashveil', 'Robin • Summeretto'])));
  });

  it('a buff for one chosen ally counts for one carry only in a multi-carry team', () => {
    const t = team(['Aventurine • Waveflair', 'Mortenax Blade', 'Ashveil', 'Sunday']);
    const out = check(t, lib, ideal, t[0]);
    if (!out.rated) throw new Error('not rated');
    expect(out.best.lines.filter((l) => l.who === t[3] && l.tag === 'One ally: acts now, +30% DMG' && (l.value ?? 0) > 0)).toHaveLength(1);
  });

  it('owner’s teams: Aventurine • Waveflair’s and Phainon’s are the best found', () => {
    const wf = hsrVerdict(team(['Aventurine • Waveflair', 'Mortenax Blade', 'Ashveil', 'Robin • Summeretto']), all);
    if (!wf.rated) throw new Error('not rated');
    expect(wf.bestMembers).toEqual(team(['Aventurine • Waveflair', 'Mortenax Blade', 'Ashveil', 'Robin • Summeretto']));
    const ph = hsrVerdict(team(['Phainon', 'Sunday', 'Cerydra', 'Dan Heng • Permansor Terrae']), all);
    if (!ph.rated) throw new Error('not rated');
    expect(ph.notes).toContain('This team has a healer or shielder, so the best team found keeps one too.');
    expect([...(ph.bestMembers ?? [])].sort()).toEqual([...team(['Phainon', 'Sunday', 'Cerydra', 'Dan Heng • Permansor Terrae'])].sort());
  });

  it('Phainon’s domain (owner): Dan Heng • Permansor Terrae’s Bondmate goes with him, so Dan Heng beats standard Robin and Huohuo; teammates’ field effects stay behind', () => {
    const value = (ns: string[]) => {
      const t = team(ns);
      const out = check(t, lib, ideal, t[0]);
      return out.rated ? out.best.value : 0;
    };
    const dh = value(['Phainon', 'Sunday', 'Cerydra', 'Dan Heng • Permansor Terrae']);
    expect(dh).toBeGreaterThan(value(['Phainon', 'Sunday', 'Cerydra', 'Robin']));
    expect(dh).toBeGreaterThan(value(['Phainon', 'Sunday', 'Cerydra', 'Huohuo']));
    const t = team(['Phainon', 'Sunday', 'Cerydra', 'Robin • Summeretto']);
    const out = check(t, lib, ideal, t[0]);
    if (!out.rated) throw new Error('not rated');
    expect(out.best.lines.find((l) => l.tag === 'Allies: ignore 15%+ DEF')?.why).toMatch(/can't follow/);
  });

  it('Cyrene’s Odes (decision 17 narrowed): Phainon gets his own Ode, not the +56% one; Odes for absent characters cost nothing', () => {
    const t = team(['Phainon', 'Cerydra', 'Cyrene', 'Dan Heng • Permansor Terrae']);
    const out = check(t, lib, ideal, t[0]);
    if (!out.rated) throw new Error('not rated');
    const cy = out.best.lines.filter((l) => l.who === t[2] && !l.forDd);
    expect(cy.find((l) => l.kind === 'buff' && l.tag.startsWith('Phainon: up to +100.8% CRIT DMG'))?.value).toBeGreaterThan(0);
    // Ode to Earth through Dan Heng • Permansor Terrae: his Bondmate (Phainon) deals more.
    expect(cy.some((l) => l.kind === 'buff' && l.tag === 'Bondmate: +33.6% DMG')).toBe(true);
    expect(cy.find((l) => l.tag === 'Chosen ally: +56% DMG')).toMatchObject({ kind: 'not-counted', points: 0 });
    expect(cy.find((l) => l.tag.startsWith('Aglaea:'))).toMatchObject({ kind: 'not-counted', points: 0 });
    expect(cy.every((l) => l.points >= 0)).toBe(true);
    // A damage dealer without an Ode of their own gets the +56%.
    const s = team(['Seele', 'Cyrene', 'Sparkle', 'Huohuo']);
    const out2 = check(s, lib, ideal, s[0]);
    if (!out2.rated) throw new Error('not rated');
    const all56 = out2.best.lines.find((l) => l.who === s[1] && l.tag === 'Chosen ally: +56% DMG');
    expect(all56?.why).toMatch(/^reaches Seele/);
    expect(all56?.value).toBeGreaterThan(0);
  });

  it('the game’s Phainon team as the card fills it (Cerydra, Cyrene, Dan Heng • Permansor Terrae) is within reach of the best found', () => {
    const v = hsrVerdict(team(['Phainon', 'Cerydra', 'Cyrene', 'Dan Heng • Permansor Terrae']), all);
    if (!v.rated) throw new Error('not rated');
    expect(v.percent).toBeGreaterThanOrEqual(60);
    expect(v.explain?.headline).toMatch(/% of the kit value of the best team found \(Phainon, Sunday, Cerydra and Dan Heng • Permansor Terrae\)\.$/);
  });
});
