import { useEffect, useState } from 'react';
import type { Character, GameContract, GameId, Kit, SampleArt, TeamPreset } from '../../core/contract';
import type { GameUserData } from '../../core/data/userData';
import { examplePresets } from './examples';

/** One game's built-in lists, as Roster needs them. */
export interface RosterLists {
  characters: Character[];
  byId: Map<string, Character>;
  /** Real recommended teams, or examples while the game's list is empty. */
  presets: { list: TeamPreset[]; example: boolean };
  /** Sample art, used ONLY on example items (example teams, example previews). */
  sampleArt: Map<string, SampleArt>;
  teamSize: number;
}

/** Lists plus your own data, for one game. Your roster and teams are always real. */
export interface RosterData extends RosterLists {
  game: GameContract;
  user: GameUserData;
}

// Some names carry the game's text markup (e.g. <unbreak>); show them as plain text.
const clean = (c: Character): Character => (c.name.includes('<') ? { ...c, name: c.name.replace(/<\/?[a-z]+[^>]*>/gi, '') } : c);

/** Built-in lists for every game shown; null while loading. */
export function useRosterLists(games: GameContract[]): Record<GameId, RosterLists> | null {
  const [state, setState] = useState<{ key: string; value: Record<GameId, RosterLists> } | null>(null);
  const key = games.map((g) => g.id).join(',');
  useEffect(() => {
    let alive = true;
    void Promise.all(
      games.map(async (game) => {
        const [raw, presets, art] = await Promise.all([game.data.characters(), game.data.teams(), game.data.sampleArt ? game.data.sampleArt().catch(() => []) : Promise.resolve([])]);
        const characters = raw.map(clean);
        const sampleArt = new Map(art.map((a) => [a.characterId, a]));
        const lists: RosterLists = {
          characters,
          byId: new Map(characters.map((c) => [c.id, c])),
          presets: presets.length ? { list: presets, example: false } : { list: examplePresets(characters, game.teamSize, [...sampleArt.keys()]), example: true },
          sampleArt,
          teamSize: game.teamSize,
        };
        return [game.id, lists] as const;
      }),
    ).then((rows) => {
      if (alive) setState({ key: rows.map(([id]) => id).join(','), value: Object.fromEntries(rows) });
    });
    return () => {
      alive = false;
    };
  }, [games]);
  return state && state.key === key ? state.value : null;
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
