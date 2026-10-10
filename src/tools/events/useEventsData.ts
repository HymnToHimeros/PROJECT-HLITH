import { useEffect, useMemo, useState } from 'react';
import type { GameContract, GameEvent, Version } from '../../core/contract';
import { useExamplesShown } from '../../core/data/prefs';
import { useGameData, type GameUserData } from '../../core/data/userData';
import { exampleVersionEnd } from '../pulls/examples';
import { exampleEvents } from './examples';
import { useWithOwnItems } from '../edit-mode/useWithOwnItems';

const NO_EVENTS: GameEvent[] = [];

export interface EventsData {
  user: GameUserData;
  /** The game's real events, or examples while its list is empty. */
  events: { list: GameEvent[]; example: boolean };
  /** null = unknown (no version list, and examples are hidden in Account → Example data). */
  versionEnd: { at: number | null; example: boolean };
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
  // Built-in events plus your own from Edit mode (hidden ones left out).
  const events = useWithOwnItems(game, 'events', lists?.events ?? NO_EVENTS);
  return {
    user,
    events: events.length || !showExamples ? { list: events, example: false } : { list: examples, example: true },
    versionEnd: current ? { at: Date.parse(current.end), example: false } : showExamples ? { at: exampleVersionEnd(at), example: true } : { at: null, example: false },
    loading: lists === null,
  };
}
