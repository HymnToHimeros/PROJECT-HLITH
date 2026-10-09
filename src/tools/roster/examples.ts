/**
 * Example data for Roster, shown only while the real data is missing and
 * always with an EXAMPLE badge. Built from the character list alone, so it
 * shows how a screen looks, never real advice. Ids start with `example-`.
 *
 * The real versions are filled by the ROSTER-LOGIC workstream (recommended
 * teams, team scores, build scores, who fits, if you pull, materials).
 */
import type { Character, GameContract, TeamPreset } from '../../core/contract';
import { byNewest } from './shared';

/** Example recommended teams: a top-rarity character plus others of the same element. Characters with sample art lead. */
export function examplePresets(characters: Character[], size: number, withArt: string[] = []): TeamPreset[] {
  const sorted = [...characters].sort(byNewest);
  const art = new Set(withArt);
  const tops = sorted.filter((c) => c.rarity === 'top');
  const stars = [...tops.filter((c) => art.has(c.id)), ...tops.filter((c) => !art.has(c.id))].slice(0, 3);
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

/** Example team score ("synergy"), only ever shown next to an EXAMPLE badge. ROSTER-LOGIC replaces it. */
export const exampleScore = (index: number) => [91, 84, 79, 72][index % 4] ?? 70;

/** Example build score parts (design: Stats, gear, skills, weapon), shown only as an EXAMPLE preview. */
export function exampleBuild(game: GameContract) {
  return {
    score: 86,
    grade: 'S',
    parts: [
      { label: 'Stats', value: 88 },
      { label: game.terms.gear, value: 82 },
      { label: game.terms.skill, value: 96 },
      { label: game.terms.weapon, value: 78 },
    ],
  };
}
