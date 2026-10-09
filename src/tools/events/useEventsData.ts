import { useEffect, useMemo, useState } from 'react';
import type { GameContract, GameEvent, Version } from '../../core/contract';
import { useGameData, type GameUserData } from '../../core/data/userData';
import { exampleVersionEnd } from '../pulls/examples';
import { exampleEvents } from './examples';

export interface EventsData {
  user: GameUserData;
  /** The game's real events, or examples while its list is empty. */
  events: { list: GameEvent[]; example: boolean };
  versionEnd: { at: number; example: boolean };
  loading: boolean;
}

/** Events for one game, with examples filling the gaps. Your progress is always your own. */
export function useEventsData(game: GameContract, now: number): EventsData {
  const user = useGameData(game.id);
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
  return {
    user,
    events: lists?.events.length ? { list: lists.events, example: false } : { list: examples, example: true },
    versionEnd: current ? { at: Date.parse(current.end), example: false } : { at: exampleVersionEnd(at), example: true },
    loading: lists === null,
  };
}
