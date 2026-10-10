import { useEffect, useMemo, useState } from 'react';
import type { GameContract, GameEvent, Version } from '../../core/contract';
import { useExamplesShown } from '../../core/data/prefs';
import { useGameData, type GameUserData } from '../../core/data/userData';
import { useHideLeaks } from '../banners/leakPref';
import { exampleCycles } from '../calendar/examples';
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
  /**
   * Example dates for endgame cycles the game record has no start date for, by income row id
   * (the same ones Calendar draws). Empty while examples are hidden or the list has its own endgame events.
   */
  cycleExamples: ReadonlyMap<string, { start: number; end: number }>;
  /** Every example event (hidden ones too), for Edit mode, while the game's list is empty; else undefined. */
  examples: GameEvent[] | undefined;
  loading: boolean;
}

/** Events for one game, with examples filling the gaps. Leaks are left out while "Hide leaks" is on. Your progress is always your own. */
export function useEventsData(game: GameContract, now: number): EventsData {
  const user = useGameData(game.id);
  const showExamples = useExamplesShown();
  const hideLeaks = useHideLeaks();
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
  const list = useMemo(() => (hideLeaks ? mixed.list.filter((e) => !e.leak) : mixed.list), [mixed.list, hideLeaks]);
  const cycleExamples = useMemo(
    () => new Map(showExamples && !list.some((e) => e.kind === 'endgame') ? exampleCycles(game, at).map((c) => [c.rowId, { start: c.start, end: c.end }] as const) : []),
    [game, at, showExamples, list],
  );
  return {
    user,
    events: { list, example: mixed.example, exampleIds: mixed.exampleIds, real: mixed.real },
    cycleExamples,
    examples: builtIn.length || !showExamples ? undefined : examples,
    versionEnd: current ? { at: Date.parse(current.end), example: false } : showExamples ? { at: exampleVersionEnd(at), example: true } : { at: null, example: false },
    loading: lists === null,
  };
}
