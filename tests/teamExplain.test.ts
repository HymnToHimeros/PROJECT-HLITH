// @vitest-environment node
/** Team scores in plain words (owner's report T17), with real teams from both games. */
import { describe, expect, it } from 'vitest';
import { library as hsrLib } from '../src/games/hsr/kitcheck/library';
import { verdict as hsrVerdict } from '../src/games/hsr/kitcheck/team';
import { library as zzzLib } from '../src/games/zzz/kitcheck/library';
import { verdict as zzzVerdict } from '../src/games/zzz/kitcheck/team';

const idOf = (lib: { names: Map<string, string> }, n: string) => [...lib.names].find(([, v]) => v === n)?.[0] ?? n;
const all = { owned: () => true, dupes: () => 0 };

describe('Team scores in plain words', () => {
  it('ZZZ Billy + Dialyn + Lucia: who carries, what each gives, and the points add up to the count', () => {
    const v = zzzVerdict(['Starlight - Billy', 'Dialyn', 'Lucia'].map((n) => idOf(zzzLib(), n)), all);
    if (!v.rated || !v.explain) throw new Error('not rated');
    expect(v.explain.headline).toBe("Starlight - Billy deals the damage. Dialyn and Lucia connect with Starlight - Billy's kit; no better team found.");
    expect(v.explain.members.find((m) => m.id === idOf(zzzLib(), 'Dialyn'))?.text).toMatch(/^Dialyn: gives Starlight - Billy .*\+40% DMG/);
    expect(v.explain.members.reduce((n, m) => n + m.points, 0)).toBe(v.count);
    expect(v.explain.missing).toEqual([]);
  });

  it('HSR Feixiao team: what each member gives and what the best team found has that this one lacks', () => {
    const v = hsrVerdict(['Feixiao', 'Topaz & Numby', 'Tribbie', 'Aventurine'].map((n) => idOf(hsrLib(), n)), all);
    if (!v.rated || !v.explain) throw new Error('not rated');
    expect(v.explain.headline).toMatch(/^Feixiao deals the damage\. .* short of the best team found\.$/);
    expect(v.explain.members.find((m) => m.id === idOf(hsrLib(), 'Topaz & Numby'))?.text).toContain('their Follow-Up ATK sets off “Follow-Up ATK after teammates attack”');
    expect(v.explain.members.reduce((n, m) => n + m.points, 0)).toBe(v.count);
    expect(v.explain.missing[0]).toMatch(/^The best team found for Feixiao is .*: \d+ points against \d+ here/);
    expect(v.explain.missing.some((m) => / would bring: /.test(m))).toBe(true);
  });
});
