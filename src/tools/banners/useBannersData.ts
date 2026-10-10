import { useEffect, useMemo, useState } from 'react';
import type { Banner, Character, GameContract, SampleArt, Weapon } from '../../core/contract';
import { useExamplesShown, useServerOffset } from '../../core/data/prefs';
import { listAtServer } from '../../core/time/serverTime';
import { useGameData, type GameUserData } from '../../core/data/userData';
import { exampleBanners } from './examples';
import { mixExamples } from '../edit-mode/examples';

const NO_BANNERS: Banner[] = [];

export interface BannersData {
  user: GameUserData;
  characters: Map<string, Character>;
  /** Weapons by id (Light Cones, W-Engines), for weapon banners; empty when the game has no list. */
  weapons: Map<string, Weapon>;
  /** The game's banners with your changes and own banners, plus examples (each in `exampleIds`) while the game's list is empty. */
  banners: { list: Banner[]; example: boolean; exampleIds: ReadonlySet<string>; real: Banner[] };
  /** Character id → sample art. Only for illustrating example banners, never real ones. */
  sampleArt: Map<string, string>;
  /** Every example banner (hidden ones too), for Edit mode, while examples stand in for the list; else undefined. */
  examples: Banner[] | undefined;
  loading: boolean;
}

/** Everything the Banners screen needs for one game. */
export function useBannersData(game: GameContract, now: number): BannersData {
  const user = useGameData(game.id);
  const showExamples = useExamplesShown();
  const offset = useServerOffset(game);
  const [lists, setLists] = useState<{ characters: Character[]; banners: Banner[]; art: SampleArt[]; weapons: Weapon[] } | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.all([game.data.characters(), game.data.banners(), game.data.sampleArt?.() ?? Promise.resolve([]), game.data.weapons?.() ?? Promise.resolve([])]).then(([characters, banners, art, weapons]) => {
      if (alive) setLists({ characters, banners, art, weapons });
    });
    return () => {
      alive = false;
    };
  }, [game]);

  const characters = useMemo(() => lists?.characters ?? [], [lists]);
  const art = useMemo(() => lists?.art ?? [], [lists]);
  const weapons = useMemo(() => new Map((lists?.weapons ?? []).map((w) => [w.id, w])), [lists]);
  const builtIn = lists?.banners ?? NO_BANNERS;
  const examples = useMemo(() => exampleBanners(game, characters, now, art.map((a) => a.characterId)), [game, characters, now, art]);
  const mixed = mixExamples('banners', listAtServer(builtIn, offset), user.ownItems.banners, examples, showExamples);
  return {
    user,
    characters: new Map(characters.map((c) => [c.id, c])),
    weapons,
    banners: { list: mixed.list, example: mixed.example, exampleIds: mixed.exampleIds, real: mixed.real },
    examples: builtIn.length || !showExamples ? undefined : examples,
    sampleArt: new Map(art.map((a) => [a.characterId, a.art])),
    loading: lists === null,
  };
}
