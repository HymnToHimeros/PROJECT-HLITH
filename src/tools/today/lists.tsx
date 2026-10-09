/**
 * Shared loaders for the time-based modules (Today, Calendar, Farm): the
 * built-in lists of every game in scope, loaded once, and your own data for
 * several games at the same time.
 */
import { useEffect, useState, type ReactNode } from 'react';
import type { Banner, Character, GameContract, GameEvent, GameId, Material, SampleArt, Version } from '../../core/contract';
import { useGameData, type GameUserData } from '../../core/data/userData';

export interface GameLists {
  characters: Character[];
  banners: Banner[];
  events: GameEvent[];
  versions: Version[];
  materials: Material[];
  /** Art for EXAMPLE items only (never on real data). */
  sampleArt?: SampleArt[];
}

/** Built-in lists per game id; null while loading. */
export function useGameLists(games: GameContract[]): Record<GameId, GameLists> | null {
  const [lists, setLists] = useState<{ for: string; value: Record<GameId, GameLists> } | null>(null);
  // Same games (by id) → keep showing what's loaded while a new array of them reloads.
  const key = games.map((g) => g.id).join(',');
  useEffect(() => {
    let alive = true;
    void Promise.all(
      games.map(async (g) => {
        const [characters, banners, events, versions, materials, sampleArt] = await Promise.all([
          g.data.characters(),
          g.data.banners(),
          g.data.events(),
          g.data.versions(),
          g.data.materials ? g.data.materials() : Promise.resolve([]),
          g.data.sampleArt ? g.data.sampleArt() : Promise.resolve([]),
        ]);
        return [g.id, { characters, banners, events, versions, materials, sampleArt }] as const;
      }),
    ).then((rows) => {
      if (alive) setLists({ for: rows.map(([id]) => id).join(','), value: Object.fromEntries(rows) });
    });
    return () => {
      alive = false;
    };
  }, [games]);
  return lists && lists.for === key ? lists.value : null;
}

/**
 * Your data for several games at once. Each step reads one game, so the
 * number of hooks per component never changes.
 */
export function WithUserData({ games, children, acc = {} }: { games: GameContract[]; children: (data: Record<GameId, GameUserData>) => ReactNode; acc?: Record<GameId, GameUserData> }) {
  const [first, ...rest] = games;
  if (!first) return <>{children(acc)}</>;
  return <Step game={first} rest={rest} acc={acc} render={children} />;
}

function Step({ game, rest, acc, render }: { game: GameContract; rest: GameContract[]; acc: Record<GameId, GameUserData>; render: (data: Record<GameId, GameUserData>) => ReactNode }) {
  const data = useGameData(game.id);
  return (
    <WithUserData games={rest} acc={{ ...acc, [game.id]: data }}>
      {render}
    </WithUserData>
  );
}

/** Games shown for a scope. */
export const inScope = (games: GameContract[], scope: GameId | 'all') => (scope === 'all' ? games : games.filter((g) => g.id === scope));

/** A game tag, only when several games share the screen (DESIGN: tags appear only in All games). */
export const tagFor = (game: GameContract, show: boolean) => (show ? { label: game.short, vent: game.vent } : undefined);
