import { useEffect, useMemo, useState } from 'react';
import type { BacklogItem, GameContract } from '../../core/contract';
import { useGameData, type GameUserData } from '../../core/data/userData';
import { exampleBacklog } from './examples';
import { useWithOwnItems } from '../edit-mode/useWithOwnItems';

const NO_ITEMS: BacklogItem[] = [];

export interface BacklogData {
  user: GameUserData;
  /** The game's real backlog, or examples (with example done counts) while its list is empty. */
  items: { list: BacklogItem[]; example: boolean; exampleDone: Record<string, number> };
  loading: boolean;
}

export function useBacklogData(game: GameContract): BacklogData {
  const user = useGameData(game.id);
  const [list, setList] = useState<BacklogItem[] | null>(null);

  useEffect(() => {
    let alive = true;
    void game.data.backlog().then((items) => {
      if (alive) setList(items);
    });
    return () => {
      alive = false;
    };
  }, [game]);

  const examples = useMemo(() => exampleBacklog(game), [game]);
  const items = useWithOwnItems(game, 'backlog', list ?? NO_ITEMS);
  return {
    user,
    items: items.length ? { list: items, example: false, exampleDone: {} } : { list: examples.items, example: true, exampleDone: examples.done },
    loading: list === null,
  };
}
