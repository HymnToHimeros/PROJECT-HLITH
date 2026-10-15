/**
 * Finding a list item by the id a game import gives (pull history, roster import): our own `id`,
 * or the game's own `gameId` when the two differ (src/core/contract/entities.ts, Character.gameId).
 */
import type { Character } from '../contract';

/** Every character under its own id and, when it has one, its game id. */
export function characterIndex<T extends Pick<Character, 'id' | 'gameId'>>(list: T[]): Map<string, T> {
  const index = new Map<string, T>();
  for (const c of list) if (c.gameId && !index.has(c.gameId)) index.set(c.gameId, c);
  // Our own ids win over a game id that happens to be the same text.
  for (const c of list) index.set(c.id, c);
  return index;
}

/** The character an imported id stands for, or undefined. */
export const findCharacter = <T extends Pick<Character, 'id' | 'gameId'>>(list: T[] | undefined, id: string): T | undefined =>
  list?.find((c) => c.id === id) ?? list?.find((c) => c.gameId === id);
