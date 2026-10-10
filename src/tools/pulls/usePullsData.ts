import { useEffect, useMemo, useState } from 'react';
import type { Banner, Character, GameContract, PullRecord, Version } from '../../core/contract';
import type { Known } from '../../core/contract/known';
import { useExamplesShown } from '../../core/data/prefs';
import { balances, useGameData, type GameUserData } from '../../core/data/userData';
import { backlogForBudget, categories, type CategoryView } from '../backlog/backlog';
import { useBacklogData } from '../backlog/useBacklogData';
import type { BudgetInput } from '../budget/budget';
import { eventsForBudget } from '../events/events';
import { useEventsData } from '../events/useEventsData';
import { exampleBank, exampleBannerSchedule, exampleHistory, exampleVersionEnd } from './examples';
import { mixExamples } from '../edit-mode/examples';
import { useHideLeaks } from '../banners/leakPref';

const NO_BANNERS: Banner[] = [];

export interface PullsData {
  user: GameUserData;
  characters: Character[];
  /** The game's banners with your changes and own banners, plus examples (each in `exampleIds`) while the list is empty. Leaks left out while hidden. `examples`: every example banner, for Edit mode, while examples stand in. */
  banners: { list: Banner[]; example: boolean; exampleIds: ReadonlySet<string>; examples: Banner[] | undefined };
  bank: { value: Known<Record<string, number>>; example: boolean };
  history: { list: PullRecord[]; example: boolean };
  /** null = unknown (no version list, and examples are hidden in Account → Example data). */
  versionEnd: { at: number | null; example: boolean };
  /** Events and Backlog progress for the budget, up to a date. Only real lists count, never examples. */
  budgetExtras: (until: number) => Partial<BudgetInput>;
  /** Modules whose rewards aren't counted because their lists are still examples. */
  notCounted: string[];
  /** Backlog categories (real list only; empty while the list is an example), for the Calculator's switches. */
  backlogCats: CategoryView[];
  loading: boolean;
}

/** Everything the Pulls tabs need for one game, with examples filling the gaps (unless hidden in Account → Example data). */
export function usePullsData(game: GameContract, now: number): PullsData {
  const user = useGameData(game.id);
  const showExamples = useExamplesShown();
  const hideLeaks = useHideLeaks();
  const [lists, setLists] = useState<{
    characters: Character[];
    banners: Banner[];
    versions: Version[];
    withArt: string[];
  } | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.all([game.data.characters(), game.data.banners(), game.data.versions(), game.data.sampleArt?.() ?? Promise.resolve([])]).then(([characters, banners, versions, art]) => {
      if (alive) setLists({ characters, banners, versions, withArt: art.map((a) => a.characterId) });
    });
    return () => {
      alive = false;
    };
  }, [game]);

  const events = useEventsData(game, now);
  const backlog = useBacklogData(game);
  const characters = useMemo(() => lists?.characters ?? [], [lists]);
  // Only real items count (the game's list and yours), never examples.
  const backlogCats = categories(game, backlog.items.real, user);
  const backlogNotCounted = backlog.items.real.length === 0 && backlog.items.example;
  // Examples are never counted; with only examples, the Calculator says so.
  const eventsNotCounted = events.events.real.length === 0 && events.events.example;
  const budgetExtras = (until: number): Partial<BudgetInput> => ({
    ...(eventsNotCounted ? {} : eventsForBudget(game, events.events.real, user, now, until)),
    ...(backlogNotCounted ? {} : { backlog: backlogForBudget(backlogCats) }),
  });
  const notCounted = [eventsNotCounted && 'Events', backlogNotCounted && 'Backlog'].filter((x): x is string => Boolean(x));
  const realBank = balances(user.ledger);
  const current = (lists?.versions ?? []).find((v) => Date.parse(v.start) <= now && now < Date.parse(v.end));
  const builtInBanners = lists?.banners ?? NO_BANNERS;
  const exampleList = useMemo(() => exampleBannerSchedule(game, characters, now, lists?.withArt), [game, characters, now, lists?.withArt]);
  const mixed = mixExamples('banners', builtInBanners, user.ownItems.banners, exampleList, showExamples);
  // "Hide leaks" (Intel) hides leaked banners here too.
  const shownBanners = hideLeaks ? mixed.list.filter((b) => !b.leak) : mixed.list;
  return {
    user,
    characters,
    banners: { list: shownBanners, example: shownBanners.some((b) => mixed.exampleIds.has(b.id)), exampleIds: mixed.exampleIds, examples: builtInBanners.length || !showExamples ? undefined : exampleList },
    // Your first bank log entry replaces the example bank, even before a balance check.
    bank: realBank.known || user.ledger.length > 0 || !showExamples ? { value: realBank, example: false } : { value: exampleBank(game), example: true },
    history: user.pulls.length || !showExamples ? { list: user.pulls, example: false } : { list: exampleHistory(game, characters, now), example: true },
    versionEnd: current ? { at: Date.parse(current.end), example: false } : showExamples ? { at: exampleVersionEnd(now), example: true } : { at: null, example: false },
    budgetExtras,
    notCounted,
    backlogCats,
    loading: lists === null || events.loading || backlog.loading,
  };
}
