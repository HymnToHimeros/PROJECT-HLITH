import { useEffect, useState } from 'react';
import type { Banner, Character, GameContract, PullRecord, Version } from '../../core/contract';
import type { Known } from '../../core/contract/known';
import { balances, useGameData, type GameUserData } from '../../core/data/userData';
import { exampleBank, exampleBanners, exampleHistory, exampleVersionEnd } from './examples';

export interface PullsData {
  user: GameUserData;
  characters: Character[];
  /** Real banners, or examples when the list is empty. */
  banners: { list: Banner[]; example: boolean };
  bank: { value: Known<Record<string, number>>; example: boolean };
  history: { list: PullRecord[]; example: boolean };
  versionEnd: { at: number; example: boolean };
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

  const characters = lists?.characters ?? [];
  const realBank = balances(user.ledger);
  const current = (lists?.versions ?? []).find((v) => Date.parse(v.start) <= now && now < Date.parse(v.end));
  return {
    user,
    characters,
    banners: lists?.banners.length ? { list: lists.banners, example: false } : { list: exampleBanners(game, characters, now), example: true },
    bank: realBank.known ? { value: realBank, example: false } : { value: exampleBank(game), example: true },
    history: user.pulls.length ? { list: user.pulls, example: false } : { list: exampleHistory(game, characters, now), example: true },
    versionEnd: current ? { at: Date.parse(current.end), example: false } : { at: exampleVersionEnd(now), example: true },
    loading: lists === null,
  };
}
