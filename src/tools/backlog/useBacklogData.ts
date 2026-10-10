import { useEffect, useMemo, useState } from 'react';
import type { BacklogItem, GameContract } from '../../core/contract';
import { useExamplesShown } from '../../core/data/prefs';
import { useGameData, type GameUserData } from '../../core/data/userData';
import { exampleBacklog } from './examples';
import { mergeRows, type Origin } from '../edit-mode/merge';

const NO_ITEMS: BacklogItem[] = [];

/** One row as Edit mode sees it: where it came from and whether you hid it. */
export interface BacklogRow {
  item: BacklogItem;
  origin: Origin;
  hidden: boolean;
}

export interface BacklogData {
  user: GameUserData;
  items: {
    /** What the screen shows: the game's list with your changes and own items, plus examples while the game's list is empty. */
    list: BacklogItem[];
    /** Any example on screen. */
    example: boolean;
    /** Ids of the items on screen that are examples (each shows an EXAMPLE badge). */
    exampleIds: ReadonlySet<string>;
    /** Example done counts for example items you haven't entered yourself. */
    exampleDone: Record<string, number>;
    /** Only real items (the game's list and yours): what Pulls counts. Never examples. */
    real: BacklogItem[];
  };
  /** Every row including hidden ones, for Edit mode. */
  rows: BacklogRow[];
  loading: boolean;
}

/**
 * Backlog for one game. Everything is yours to change: built-in items take your changes
 * field by field, you add your own, and you hide anything (nothing is deleted). While the
 * game's list is empty, examples show (unless hidden in Account → Example data); changing
 * an example turns it into your own item, so it stops being an example.
 */
export function useBacklogData(game: GameContract): BacklogData {
  const user = useGameData(game.id);
  const showExamples = useExamplesShown();
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
  const own = user.ownItems.backlog;

  return useMemo(() => {
    const builtIn = list ?? NO_ITEMS;
    const merged = mergeRows('backlog', builtIn, own);
    const real = merged.filter((r) => !r.hidden).map((r) => r.item);
    const useExamples = builtIn.length === 0 && showExamples;
    // An example you changed (now your own item) or hid is no longer shown as an example.
    const taken = (id: string) => Boolean(own[id]?.mine || own[id]?.hidden);
    const shownExamples = useExamples ? examples.items.filter((e) => !taken(e.id)) : [];
    const hiddenExamples = useExamples ? examples.items.filter((e) => own[e.id]?.hidden && !own[e.id]?.mine) : [];
    const exampleIds = new Set(shownExamples.map((e) => e.id));
    const exampleDone = Object.fromEntries(Object.entries(examples.done).filter(([id]) => exampleIds.has(id)));
    const rows: BacklogRow[] = [
      ...shownExamples.map((item) => ({ item, origin: 'example' as const, hidden: false })),
      ...hiddenExamples.map((item) => ({ item, origin: 'example' as const, hidden: true })),
      ...merged,
    ];
    return {
      user,
      items: { list: [...shownExamples, ...real], example: shownExamples.length > 0, exampleIds, exampleDone, real },
      rows,
      loading: list === null,
    };
  }, [list, own, showExamples, examples, user]);
}
