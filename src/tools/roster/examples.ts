/**
 * Example recommended teams, shown only while the game's real preset list is
 * empty. Built from the character list alone (a new top-rarity character plus
 * others of the same element), so they show how scoring looks, not real advice.
 * Always shown with an EXAMPLE badge; ids start with `example-`.
 */
import type { Character, TeamPreset } from '../../core/contract';
import { byNewest } from './shared';

export function examplePresets(characters: Character[], size: number): TeamPreset[] {
  const sorted = [...characters].sort(byNewest);
  const stars = sorted.filter((c) => c.rarity === 'top').slice(0, 3);
  // Each example team uses different characters, so no two look the same.
  const used = new Set(stars.map((s) => s.id));
  return stars.map((star) => {
    const others = sorted.filter((c) => !used.has(c.id));
    const pool = [...others.filter((c) => c.element === star.element), ...others.filter((c) => c.element !== star.element)];
    const slots = [{ characters: [star.id] }];
    for (let k = 0; k < size - 1; k++) {
      const options = pool.slice(k * 2, k * 2 + 2).map((c) => c.id);
      if (options.length) slots.push({ characters: options });
    }
    for (const slot of slots) for (const id of slot.characters) used.add(id);
    return { id: `example-team-${star.id}`, name: `${star.name} team`, slots, source: 'example' };
  });
}
