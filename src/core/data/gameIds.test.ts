import { describe, expect, it } from 'vitest';
import { characterIndex, findCharacter } from './gameIds';

// Argent Flow was listed before the game gave her an id; the wiki adds chr_0040_argent later.
const chars = [
  { id: 'chr_0036_jsspsi', name: 'Si', rarity: 'top' as const, element: 'nature', role: 'caster' },
  { id: 'chr_argent-flow', gameId: 'chr_0040_argent', name: 'Argent Flow', rarity: 'top' as const, element: 'electric', role: 'guard' },
];

describe("the game's ids find our characters", () => {
  it('a pull record with the game id finds the character under our id', () => {
    expect(findCharacter(chars, 'chr_0040_argent')?.id).toBe('chr_argent-flow');
    expect(findCharacter(chars, 'chr_argent-flow')?.id).toBe('chr_argent-flow');
    expect(findCharacter(chars, 'chr_0036_jsspsi')?.name).toBe('Si');
    expect(findCharacter(chars, 'chr_9999_x')).toBeUndefined();
    expect(characterIndex(chars).get('chr_0040_argent')?.id).toBe('chr_argent-flow');
  });
});
