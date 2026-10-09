import { useEffect, useState } from 'react';
import type { Banner, Character, GameContract } from '../../core/contract';
import { useGameData, type GameUserData } from '../../core/data/userData';
import { exampleBanners } from './examples';

export interface BannersData {
  user: GameUserData;
  characters: Map<string, Character>;
  /** Real banners, or examples when the game's list is empty. */
  banners: { list: Banner[]; example: boolean };
  loading: boolean;
}

/** Everything the Banners screen needs for one game. */
export function useBannersData(game: GameContract, now: number): BannersData {
  const user = useGameData(game.id);
  const [lists, setLists] = useState<{ characters: Character[]; banners: Banner[] } | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.all([game.data.characters(), game.data.banners()]).then(([characters, banners]) => {
      if (alive) setLists({ characters, banners });
    });
    return () => {
      alive = false;
    };
  }, [game]);

  const characters = lists?.characters ?? [];
  return {
    user,
    characters: new Map(characters.map((c) => [c.id, c])),
    banners: lists?.banners.length ? { list: lists.banners, example: false } : { list: exampleBanners(game, characters, now), example: true },
    loading: lists === null,
  };
}
