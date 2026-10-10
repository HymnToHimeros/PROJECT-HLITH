// @vitest-environment node
/** T41: "Best found from your characters" cards, and a carry who heals being the team's sustain. */
import { describe, expect, it } from 'vitest';
import type { TeamAccount, TeamPreset } from '../src/core/contract';
import { BEST_FOUND, bestFoundCards } from '../src/core/rules/bestCards';
import { library as hsrLib } from '../src/games/hsr/kitcheck/library';
import { gameTeams, hsrTeamRules } from '../src/games/hsr/kitcheck/team';
import hsrTeams from '../src/games/hsr/data/teams.json';

const lib = hsrLib();
const id = (n: string) => [...lib.names].find(([, v]) => v === n)?.[0] ?? n;
const owning = (names: string[]): TeamAccount => ({ owned: (x) => names.map(id).includes(x), dupes: () => 0, assumeAverage: true });
const presets = gameTeams(hsrTeams as TeamPreset[]);

describe('core: when a best-found card is added', () => {
  const name = (x: string) => x;
  it('only when every card of that damage dealer is under 90% and none shows the best line-up', () => {
    expect(bestFoundCards([{ dd: 'a', members: ['a', 'b'], percent: 88 }], () => ['a', 'c'], name, 2)).toEqual([
      { id: `${BEST_FOUND}-a`, name: 'a · best found from your characters', slots: [{ characters: ['a'] }, { characters: ['c'] }], source: BEST_FOUND },
    ]);
    expect(bestFoundCards([{ dd: 'a', members: ['a', 'b'], percent: 88 }, { dd: 'a', members: ['a', 'd'], percent: 90 }], () => ['a', 'c'], name, 2)).toEqual([]);
    expect(bestFoundCards([{ dd: 'a', members: ['a', 'b'], percent: 50 }, { dd: 'a', members: ['b', 'a'], percent: 40 }], () => ['a', 'b'], name, 2)).toEqual([]);
    // A best team that can't fill the team size gets no card.
    expect(bestFoundCards([{ dd: 'a', members: ['a', 'b', 'c'], percent: 50 }], () => ['a', 'd'], name, 3)).toEqual([]);
  });
});

describe('HSR: Aventurine • Waveflair (no game list has Mortenax Blade, Ashveil and Robin • Summeretto together)', () => {
  const a = owning(['Aventurine • Waveflair', 'Mortenax Blade', 'Ashveil', 'Robin • Summeretto', 'Dan Heng • Permansor Terrae', 'Huohuo', 'Yao Guang']);
  it('gets a best-found card with his best team from these characters when his card stays under 90% (his team 2: Yao Guang)', () => {
    const team2 = presets.filter((t) => t.id === 'game-1513-2');
    expect(team2).toHaveLength(1);
    const cards = hsrTeamRules.bestCards?.(team2, a) ?? [];
    const wf = cards.find((c) => c.id === `${BEST_FOUND}-${id('Aventurine • Waveflair')}`);
    expect(wf?.source).toBe(BEST_FOUND);
    expect([...(wf?.slots.map((s) => s.characters[0]) ?? [])].sort()).toEqual(['Aventurine • Waveflair', 'Mortenax Blade', 'Ashveil', 'Robin • Summeretto'].map(id).sort());
    // The card fills exactly that line-up, and it is his best found.
    const members = wf ? (hsrTeamRules.fill?.(wf, a) ?? []) : [];
    const v = hsrTeamRules.verdict(members, a);
    if (!v.rated) throw new Error(v.why);
    expect([...v.bestMembers].sort()).toEqual([...members].sort());
  });
});

describe('HSR: Castorice heals allies herself, so her sustain slot may take anyone her game teams list', () => {
  it('her card fills Cyrene + Tribbie + Trailblazer (Remembrance) when no healer would do more', () => {
    const card = presets.find((t) => t.id === 'game-1407-1');
    if (!card) throw new Error('no Castorice team');
    const a = owning(['Castorice', 'Cyrene', 'Tribbie', 'Trailblazer · Remembrance (Caelus)', 'Huohuo', 'Lingsha']);
    expect([...(hsrTeamRules.fill?.(card, a) ?? [])].sort()).toEqual(['Castorice', 'Cyrene', 'Tribbie', 'Trailblazer · Remembrance (Caelus)'].map(id).sort());
  });
});
