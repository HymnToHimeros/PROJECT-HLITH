// @vitest-environment node
/** T40: a recommended card fills each slot with the owned pick that gives the team the highest kit value, both games. */
import { describe, expect, it } from 'vitest';
import type { TeamAccount, TeamPreset } from '../src/core/contract';
import { fillTeam } from '../src/core/rules/fillTeam';
import { check } from '../src/games/hsr/kitcheck/check';
import { library as hsrLib } from '../src/games/hsr/kitcheck/library';
import { gameTeams, hsrTeamRules } from '../src/games/hsr/kitcheck/team';
import hsrTeams from '../src/games/hsr/data/teams.json';
import { library as zzzLib } from '../src/games/zzz/kitcheck/library';
import { recommendedTeams, zzzTeamRules } from '../src/games/zzz/kitcheck/team';

const idOf = (lib: { names: Map<string, string> }, n: string) => [...lib.names].find(([, v]) => v === n)?.[0] ?? n;
const owning = (ids: string[], dupes: Record<string, number> = {}): TeamAccount => ({ owned: (x) => ids.includes(x), dupes: (x) => dupes[x] ?? 0 });

describe('HSR: the owner’s Phainon card (owner, 2026-10-10: "the recommended stuff just is wrong")', () => {
  const lib = hsrLib();
  const id = (n: string) => idOf(lib, n);
  const card = gameTeams(hsrTeams as TeamPreset[]).find((t) => t.id === 'game-1408-1');
  const mine = ['Phainon', 'Sunday', 'Cerydra', 'Cyrene', 'Dan Heng • Permansor Terrae', 'Huohuo', 'Tribbie'].map(id);

  it('the first owned in list order gave Cerydra + Cyrene; the best owned picks give Sunday + Cerydra + Dan Heng • Permansor Terrae', () => {
    if (!card) throw new Error('no Phainon team');
    const a = { ...owning(mine, { [id('Huohuo')]: 1 }), assumeAverage: true };
    expect([...fillTeam(card, a.owned)].sort()).toEqual(['Phainon', 'Cerydra', 'Cyrene', 'Dan Heng • Permansor Terrae'].map(id).sort());
    const filled = hsrTeamRules.fill?.(card, a) ?? [];
    expect([...filled].sort()).toEqual(['Phainon', 'Sunday', 'Cerydra', 'Dan Heng • Permansor Terrae'].map(id).sort());
    const v = hsrTeamRules.verdict(filled, a);
    if (!v.rated) throw new Error(v.why);
    expect([...v.bestMembers].sort()).toEqual([...filled].sort());
  });

  it('in his domain (8 turns), Huohuo’s heal switches on “+45% DMG for 4 turn(s)” for 4 of them; Dan Heng • Permansor Terrae’s Souldragon Shields go along', () => {
    const ideal = { eidolon: () => 0, enhanced: () => 1, ideal: true };
    const line = (fourth: string) => {
      const t = ['Phainon', 'Sunday', 'Cerydra', fourth].map(id);
      const out = check(t, lib, ideal, t[0]);
      if (!out.rated) throw new Error('not rated');
      return out.best.lines.find((l) => l.tag === '+45% DMG when a teammate heals or shields him');
    };
    expect(line('Huohuo')?.why).toMatch(/counted 4\/8$/);
    expect(line('Huohuo')?.parts?.[0]?.size).toBeCloseTo(0.45 * 0.5);
    expect(line('Dan Heng • Permansor Terrae')?.why).toMatch(/goes with Phainon/);
    expect(line('Dan Heng • Permansor Terrae')?.parts?.[0]?.size).toBeCloseTo(0.45);
  });
});

describe('ZZZ mirrors it', () => {
  const lib = zzzLib();
  const id = (n: string) => idOf(lib, n);
  it('Ellen’s card takes Dialyn over Lighter when both are owned (higher kit value)', () => {
    const card = recommendedTeams().find((t) => t.slots[0]?.characters[0] === id('Ellen'));
    if (!card) throw new Error('no Ellen card');
    const a = owning(['Ellen', 'Trigger', 'Lighter', 'Dialyn'].map(id));
    const filled = zzzTeamRules.fill?.(card, a) ?? [];
    expect(filled).toContain(id('Dialyn'));
    expect(filled).not.toContain(id('Lighter'));
  });
});
