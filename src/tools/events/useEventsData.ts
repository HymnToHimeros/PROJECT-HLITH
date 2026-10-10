import { useEffect, useMemo, useState } from 'react';
import type { GameContract, GameEvent, Version } from '../../core/contract';
import { useExamplesShown } from '../../core/data/prefs';
import { useGameData, type GameUserData } from '../../core/data/userData';
import { exampleVersionEnd } from '../pulls/examples';
import { exampleEvents } from './examples';
import { mixExamples } from '../edit-mode/examples';

const NO_EVENTS: GameEvent[] = [];

export interface EventsData {
  user: GameUserData;
  /**
   * `list`: the game's events with your changes and own events, plus examples (each in
   * `exampleIds`) while the game's list is empty. `real`: never examples (budgets, tasks).
   */
  events: { list: GameEvent[]; example: boolean; exampleIds: ReadonlySet<string>; real: GameEvent[] };
  /** null = unknown (no version list, and examples are hidden in Account → Example data). */
  versionEnd: { at: number | null; example: boolean };
  /** Every example event (hidden ones too), for Edit mode, while the game's list is empty; else undefined. */
  examples: GameEvent[] | undefined;
  loading: boolean;
}

/** Events for one game, with examples filling the gaps. Your progress is always your own. */
export function useEventsData(game: GameContract, now: number): EventsData {
  const user = useGameData(game.id);
  const showExamples = useExamplesShown();
  const [lists, setLists] = useState<{ events: GameEvent[]; versions: Version[]; at: number } | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.all([game.data.events(), game.data.versions()]).then(([events, versions]) => {
      // Examples are anchored to when the list loaded, so their countdowns stay steady.
      if (alive) setLists({ events, versions, at: Date.now() });
    });
    return () => {
      alive = false;
    };
  }, [game]);

  const current = (lists?.versions ?? []).find((v) => Date.parse(v.start) <= now && now < Date.parse(v.end));
  const at = lists?.at ?? now;
  const examples = useMemo(() => exampleEvents(game, at), [game, at]);
  const builtIn = lists?.events ?? NO_EVENTS;
  // Built-in events with your changes, your own events, and examples one by one (until you hide or change them).
  const mixed = useMemo(() => mixExamples('events', builtIn, user.ownItems.events, examples, showExamples), [builtIn, user.ownItems.events, examples, showExamples]);
  return {
    user,
    events: { list: mixed.list, example: mixed.example, exampleIds: mixed.exampleIds, real: mixed.real },
    examples: builtIn.length || !showExamples ? undefined : examples,
    versionEnd: current ? { at: Date.parse(current.end), example: false } : showExamples ? { at: exampleVersionEnd(at), example: true } : { at: null, example: false },
    loading: lists === null,
  };
}
