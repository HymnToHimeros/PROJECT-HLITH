import { useEffect, useState } from 'react';
import type { Banner, Character, GameContract, PullRecord, Version } from '../../core/contract';
import type { Known } from '../../core/contract/known';
import { balances, useGameData, type GameUserData } from '../../core/data/userData';
import { backlogForBudget, categories } from '../backlog/backlog';
import { useBacklogData } from '../backlog/useBacklogData';
import type { BudgetInput } from '../budget/budget';
import { eventsForBudget } from '../events/events';
import { useEventsData } from '../events/useEventsData';
import { exampleBank, exampleBanners, exampleHistory, exampleVersionEnd } from './examples';

export interface PullsData {
  user: GameUserData;
  characters: Character[];
  /** Real banners, or examples when the list is empty. */
  banners: { list: Banner[]; example: boolean };
  bank: { value: Known<Record<string, number>>; example: boolean };
  history: { list: PullRecord[]; example: boolean };
  versionEnd: { at: number; example: boolean };
  /** Events and Backlog progress for the budget, up to a date. Only real lists count, never examples. */
  budgetExtras: (until: number) => Partial<BudgetInput>;
  /** Modules whose rewards aren't counted because their lists are still examples. */
  notCounted: string[];
  loading: boolean;
}

/** Everything the Pulls tabs need for one game, with examples filling the gaps. */
export function usePullsData(game: GameContract, now: number): PullsData {
  const user = useGameData(game.id);
  const [lists, setLists] = useState<{
    characters: Character[];
    banners: Banner[];
    versions: Version[];
  } | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.all([game.data.characters(), game.data.banners(), game.data.versions()]).then(([characters, banners, versions]) => {
      if (alive) setLists({ characters, banners, versions });
    });
    return () => {
      alive = false;
    };
  }, [game]);

  const events = useEventsData(game, now);
  const backlog = useBacklogData(game);
  const characters = lists?.characters ?? [];
  const budgetExtras = (until: number): Partial<BudgetInput> => ({
    ...(events.events.example ? {} : eventsForBudget(game, events.events.list, user, now, until)),
    ...(backlog.items.example ? {} : { backlog: backlogForBudget(categories(game, backlog.items.list, user)) }),
  });
  const notCounted = [events.events.example && 'Events', backlog.items.example && 'Backlog'].filter((x): x is string => Boolean(x));
  const realBank = balances(user.ledger);
  const current = (lists?.versions ?? []).find((v) => Date.parse(v.start) <= now && now < Date.parse(v.end));
  return {
    user,
    characters,
    banners: lists?.banners.length ? { list: lists.banners, example: false } : { list: exampleBanners(game, characters, now), example: true },
    bank: realBank.known ? { value: realBank, example: false } : { value: exampleBank(game), example: true },
    history: user.pulls.length ? { list: user.pulls, example: false } : { list: exampleHistory(game, characters, now), example: true },
    versionEnd: current ? { at: Date.parse(current.end), example: false } : { at: exampleVersionEnd(now), example: true },
    budgetExtras,
    notCounted,
    loading: lists === null || events.loading || backlog.loading,
  };
}
