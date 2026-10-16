// @vitest-environment node
/** Team scores in plain words (owner's report T17), with real teams from both games. */
import { describe, expect, it } from 'vitest';
import { library as hsrLib } from '../src/games/hsr/kitcheck/library';
import { verdict as hsrVerdict } from '../src/games/hsr/kitcheck/team';
import { library as zzzLib } from '../src/games/zzz/kitcheck/library';
import { verdict as zzzVerdict } from '../src/games/zzz/kitcheck/team';
import { library as efLib } from '../src/games/endfield/kitcheck/library';
import { verdict as efVerdict } from '../src/games/endfield/kitcheck/team';

const idOf = (lib: { names: Map<string, string> }, n: string) => [...lib.names].find(([, v]) => v === n)?.[0] ?? n;
const all = { owned: () => true, dupes: () => 0 };

describe('Team scores in plain words', () => {
  it('ZZZ Billy + Dialyn + Lucia: who carries, what each gives, and the points add up to the count', () => {
    const v = zzzVerdict(['Starlight - Billy', 'Dialyn', 'Lucia'].map((n) => idOf(zzzLib(), n)), all);
    if (!v.rated || !v.explain) throw new Error('not rated');
    // At base builds (none saved): Lucia's HP build is what's still missing, and the best squad found is fully built.
    // T30: the best squad found is this one, fully built (Lucia's HP build is what's missing).
    expect(v.explain.headline).toMatch(/^Starlight - Billy deals the damage\. Dialyn and Lucia connect with Starlight - Billy's kit; \d+% of its kit value when fully built\.$/);
    expect(v.explain.members.find((m) => m.id === idOf(zzzLib(), 'Dialyn'))?.text).toMatch(/^Dialyn: gives Starlight - Billy .*\+40% DMG/);
    expect(v.explain.members.reduce((n, m) => n + m.points, 0)).toBe(v.count);
    expect(v.explain.missing.some((m) => /^Lucia built for HP: no build saved, scored at base; up to 2 points more\.$/.test(m))).toBe(true);
  });

  it('HSR Feixiao team: what each member gives and what the best team found has that this one lacks', () => {
    const v = hsrVerdict(['Feixiao', 'Topaz & Numby', 'Tribbie', 'Aventurine'].map((n) => idOf(hsrLib(), n)), all);
    if (!v.rated || !v.explain) throw new Error('not rated');
    // Topaz is a carry on Feixiao's own game team: her damage counts too (hsr-decisions 33).
    expect(v.explain.headline).toMatch(/^Feixiao deals the damage, with Topaz & Numby\. .*; \d+% of the kit value of the best team found \(Feixiao, .*\)\.$/);
    expect(v.explain.members.find((m) => m.id === idOf(hsrLib(), 'Topaz & Numby'))?.text).toContain('their Follow-Up ATK sets off “Follow-Up ATK after teammates attack”');
    expect(v.explain.members.reduce((n, m) => n + m.points, 0)).toBe(v.count);
    expect(v.explain.missing[0]).toMatch(/^The best team found for Feixiao is .*: kit value ×[\d.]+ against ×[\d.]+ here \(count \d+ against \d+\)/);
    expect(v.explain.missing.some((m) => / would bring: /.test(m))).toBe(true);
  });

  it('Endfield Laevatain team: a set-up chain reads "sets up X, which sets off Y", once even when two skills do it', () => {
    const v = efVerdict(['Laevatain', 'Camille', 'Si', 'Gilberta'].map((n) => idOf(efLib(), n)), all, efLib(), Date.parse('2026-10-20T00:00:00Z'));
    if (!v.rated || !v.explain) throw new Error('not rated');
    const camille = v.explain.members.find((m) => m.id === idOf(efLib(), 'Camille'))?.text ?? '';
    const chain = 'sets up Combustion (on another element’s Infliction), which sets off “Combo on Combustion or Corrosion”';
    expect(camille).toContain(chain);
    // Her Battle Skill and Ultimate both apply Heat Infliction: two points, one phrase.
    expect(camille.split(chain)).toHaveLength(2);
    expect(v.explain.members.map((m) => m.text).join(' ')).not.toContain('their sets up');
    expect(v.explain.members.reduce((n, m) => n + m.points, 0)).toBe(v.count);
  });
});
