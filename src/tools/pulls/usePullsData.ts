import { useEffect, useState } from 'react';
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
import { useWithOwnItems } from '../edit-mode/useWithOwnItems';

const NO_BANNERS: Banner[] = [];

export interface PullsData {
  user: GameUserData;
  characters: Character[];
  /** Real banners, or examples when the list is empty. */
  banners: { list: Banner[]; example: boolean };
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
  const characters = lists?.characters ?? [];
  // Only real items count (the game's list and yours), never examples.
  const backlogCats = categories(game, backlog.items.real, user);
  const backlogNotCounted = backlog.items.real.length === 0 && backlog.items.example;
  const budgetExtras = (until: number): Partial<BudgetInput> => ({
    ...(events.events.example ? {} : eventsForBudget(game, events.events.list, user, now, until)),
    ...(backlogNotCounted ? {} : { backlog: backlogForBudget(backlogCats) }),
  });
  const notCounted = [events.events.example && 'Events', backlogNotCounted && 'Backlog'].filter((x): x is string => Boolean(x));
  const realBank = balances(user.ledger);
  const current = (lists?.versions ?? []).find((v) => Date.parse(v.start) <= now && now < Date.parse(v.end));
  const ownBanners = useWithOwnItems(game, 'banners', lists?.banners ?? NO_BANNERS);
  return {
    user,
    characters,
    banners: ownBanners.length || !showExamples ? { list: ownBanners, example: false } : { list: exampleBannerSchedule(game, characters, now, lists?.withArt), example: true },
    bank: realBank.known || !showExamples ? { value: realBank, example: false } : { value: exampleBank(game), example: true },
    history: user.pulls.length || !showExamples ? { list: user.pulls, example: false } : { list: exampleHistory(game, characters, now), example: true },
    versionEnd: current ? { at: Date.parse(current.end), example: false } : showExamples ? { at: exampleVersionEnd(now), example: true } : { at: null, example: false },
    budgetExtras,
    notCounted,
    backlogCats,
    loading: lists === null || events.loading || backlog.loading,
  };
}
