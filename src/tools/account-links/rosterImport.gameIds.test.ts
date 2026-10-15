import { describe, expect, it } from 'vitest';
import type { GameContract } from '../../core/contract';
import { planImport } from './rosterImport';

// Argent Flow was listed before the game gave her an id; the wiki adds chr_0040_argent later.
const chars = [
  { id: 'chr_0036_jsspsi', name: 'Si', rarity: 'top' as const, element: 'nature', role: 'caster' },
  { id: 'chr_argent-flow', gameId: 'chr_0040_argent', name: 'Argent Flow', rarity: 'top' as const, element: 'electric', role: 'guard' },
];

describe('roster import with game ids', () => {
  it('a character imported under the game id raises our id, never a new one', () => {
    const game = { dupes: { max: 5 } } as unknown as GameContract;
    const rows = planImport(game, [{ id: 'chr_0040_argent', name: 'Ye Minghe', dupes: 1, level: 1, weapon: null } as never], chars, {});
    expect(rows).toEqual([expect.objectContaining({ id: 'chr_argent-flow', status: 'new', dupesAfter: 1 })]);
  });
});
