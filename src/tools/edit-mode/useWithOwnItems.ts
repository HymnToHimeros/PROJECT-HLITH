import { useMemo } from 'react';
import type { GameContract, GameId } from '../../core/contract';
import { useGameData, type OwnItemTypes, type OwnKind } from '../../core/data/userData';
import { mergeOwnItems, mergeRows, type MergedRow } from './merge';

const idOf = (game: GameContract | GameId) => (typeof game === 'string' ? game : game.id);

/**
 * For list screens (Events, Banners, Backlog): the built-in list with your
 * own items added, your changes applied and your hidden items left out.
 * Pass the game's real list (not examples).
 */
export function useWithOwnItems<K extends OwnKind>(game: GameContract | GameId, kind: K, builtInList: readonly OwnItemTypes[K][]): OwnItemTypes[K][] {
  const own = useGameData(idOf(game)).ownItems[kind];
  return useMemo(() => mergeOwnItems(kind, builtInList, own), [kind, builtInList, own]);
}

/** Every row with where it came from and whether it is hidden (for Edit mode itself). */
export function useOwnRows<K extends OwnKind>(game: GameContract | GameId, kind: K, builtInList: readonly OwnItemTypes[K][]): MergedRow<OwnItemTypes[K]>[] {
  const own = useGameData(idOf(game)).ownItems[kind];
  return useMemo(() => mergeRows(kind, builtInList, own), [kind, builtInList, own]);
}
