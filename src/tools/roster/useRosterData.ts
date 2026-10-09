import { useEffect, useState } from 'react';
import type { Character, GameContract, Kit, TeamPreset } from '../../core/contract';
import { useGameData, type GameUserData } from '../../core/data/userData';
import { examplePresets } from './examples';
import { teamSizeOf } from './shared';

export interface RosterData {
  user: GameUserData;
  characters: Character[];
  byId: Map<string, Character>;
  /** Real recommended teams, or examples while the game's list is empty. */
  presets: { list: TeamPreset[]; example: boolean };
  teamSize: number;
  loading: boolean;
}

/** Everything Characters and Teams need for one game. Your roster and teams are always real. */
export function useRosterData(game: GameContract): RosterData {
  const user = useGameData(game.id);
  const [lists, setLists] = useState<{ game: GameContract; characters: Character[]; presets: TeamPreset[] } | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.all([game.data.characters(), game.data.teams()]).then(([characters, presets]) => {
      // Some names carry the game's text markup (e.g. <unbreak>); show them as plain text.
      if (alive) setLists({ game, characters: characters.map((c) => (c.name.includes('<') ? { ...c, name: c.name.replace(/<\/?[a-z]+[^>]*>/gi, '') } : c)), presets });
    });
    return () => {
      alive = false;
    };
  }, [game]);

  const ready = lists?.game === game ? lists : null;
  const characters = ready?.characters ?? [];
  const realPresets = ready?.presets ?? [];
  const teamSize = teamSizeOf(game, realPresets);
  return {
    user,
    characters,
    byId: new Map(characters.map((c) => [c.id, c])),
    presets: realPresets.length ? { list: realPresets, example: false } : { list: examplePresets(characters, teamSize), example: true },
    teamSize,
    loading: ready === null,
  };
}

// Kit lists can be large, so each game's is loaded once, only when Kit check is shown.
const kitCache = new WeakMap<GameContract, Promise<Kit[]>>();

/** null while loading; [] when the game has no kit data. */
export function useKits(game: GameContract): Kit[] | null {
  const [state, setState] = useState<{ game: GameContract; kits: Kit[] } | null>(null);
  useEffect(() => {
    const load = game.data.kits;
    if (!load) return;
    let alive = true;
    let p = kitCache.get(game);
    if (!p) {
      p = load().catch(() => []);
      kitCache.set(game, p);
    }
    void p.then((kits) => {
      if (alive) setState({ game, kits });
    });
    return () => {
      alive = false;
    };
  }, [game]);
  if (!game.data.kits) return [];
  return state?.game === game ? state.kits : null;
}
