import { useEffect, useState } from 'react';
import type { Banner, Character, GameContract, SampleArt } from '../../core/contract';
import { useGameData, type GameUserData } from '../../core/data/userData';
import { exampleBanners } from './examples';

export interface BannersData {
  user: GameUserData;
  characters: Map<string, Character>;
  /** Real banners, or examples when the game's list is empty. */
  banners: { list: Banner[]; example: boolean };
  /** Character id → sample art. Only for illustrating example banners, never real ones. */
  sampleArt: Map<string, string>;
  loading: boolean;
}

/** Everything the Banners screen needs for one game. */
export function useBannersData(game: GameContract, now: number): BannersData {
  const user = useGameData(game.id);
  const [lists, setLists] = useState<{ characters: Character[]; banners: Banner[]; art: SampleArt[] } | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.all([game.data.characters(), game.data.banners(), game.data.sampleArt?.() ?? Promise.resolve([])]).then(([characters, banners, art]) => {
      if (alive) setLists({ characters, banners, art });
    });
    return () => {
      alive = false;
    };
  }, [game]);

  const characters = lists?.characters ?? [];
  const art = lists?.art ?? [];
  return {
    user,
    characters: new Map(characters.map((c) => [c.id, c])),
    banners: lists?.banners.length ? { list: lists.banners, example: false } : { list: exampleBanners(game, characters, now, art.map((a) => a.characterId)), example: true },
    sampleArt: new Map(art.map((a) => [a.characterId, a.art])),
    loading: lists === null,
  };
}
