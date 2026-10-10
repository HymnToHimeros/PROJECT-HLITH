import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Character, GameContract, TeamPreset, TeamRules, TeamVerdict } from '../../core/contract';
import { EMPTY_GAME } from '../../core/data/userData';
import { BuildWants } from './BuildWants';
import type { RosterData } from './useRosterData';

const better: Character = { id: 'c4', name: 'Better Pick', rarity: 'mid', element: 'ice', role: 'support' };
const chars: Character[] = [
  { id: 'c1', name: 'Carry', rarity: 'top', element: 'fire', role: 'attack' },
  { id: 'c3', name: 'First Pick', rarity: 'mid', element: 'fire', role: 'support' },
  better,
];
const preset: TeamPreset = { id: 'p1', name: 'Fire team', slots: [{ characters: ['c1'] }, { characters: ['c3', 'c4'] }], source: 'test list' };

// The team rules fill the card with the better unit (T40: the last of each slot here) and want an HP build on c4,
// an ATK build once the "assume" switch is on, so the test sees which members and which account were asked.
const rules = {
  method: 'm',
  rated: () => true,
  whoFits: () => [],
  lineUps: () => [],
  ifYouPull: () => null,
  fill: (p: TeamPreset) => p.slots.map((s) => s.characters[s.characters.length - 1] ?? ''),
  verdict: (members, account): TeamVerdict => ({
    rated: true,
    percent: 100,
    label: 'Excellent',
    count: 1,
    best: 1,
    bestMembers: members,
    order: members,
    reasons: [],
    notes: [],
    ...(members.includes('c4') ? { wants: [{ who: 'c4', stat: account.assumeAverage ? 'ATK' : 'HP', label: '', have: 'no build saved', fit: 'no-build' as const, points: 0, max: 2, proof: { skill: 'Talent', quote: 'grows with HP' } }] } : {}),
  }),
} as TeamRules;

const data = (assume: boolean): RosterData => ({
  game: { id: 'aa', rules: { teams: rules } } as unknown as GameContract,
  user: { ...EMPTY_GAME, ...(assume ? { assumeAverageBuilds: true } : {}) },
  characters: chars,
  byId: new Map(chars.map((c) => [c.id, c])),
  presets: { list: [preset], example: false },
  sampleArt: new Map(),
  teamSize: 4,
});

describe('Builds their teams want (T42)', () => {
  it('asks about the members the card shows, not each slot’s first pick', () => {
    render(<BuildWants data={data(false)} character={better} />);
    expect(screen.getByText(/built for HP/)).toBeInTheDocument();
  });

  it('asks again when the "Assume signature + average build" switch changes', () => {
    const { rerender } = render(<BuildWants data={data(false)} character={better} />);
    expect(screen.getByText(/built for HP/)).toBeInTheDocument();
    rerender(<BuildWants data={data(true)} character={better} />);
    expect(screen.getByText(/built for ATK/)).toBeInTheDocument();
  });
});
