/**
 * Shared loaders for the time-based modules (Today, Calendar, Farm): the
 * built-in lists of every game in scope, loaded once, and your own data for
 * several games at the same time.
 */
import { useEffect, useState, type ReactNode } from 'react';
import type { Banner, Character, GameContract, GameEvent, GameId, Material, SampleArt, Version } from '../../core/contract';
import { useGameData, type GameUserData } from '../../core/data/userData';
import { listAtServer, serverOffset } from '../../core/time/serverTime';
import { mixExamples } from '../edit-mode/examples';
import { exampleEvents } from '../events/examples';
import { exampleBannerSchedule } from '../pulls/examples';

export interface GameLists {
  characters: Character[];
  banners: Banner[];
  events: GameEvent[];
  versions: Version[];
  materials: Material[];
  /** Art for EXAMPLE items only (never on real data). */
  sampleArt?: SampleArt[];
  /** After `withOwnItems`: ids of the banners and events that are examples. */
  exampleIds?: ReadonlySet<string>;
  /** After `withOwnItems`: only real banners and events (never examples), for tasks and budgets. */
  real?: { banners: Banner[]; events: GameEvent[] };
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

/**
 * The built-in banners and events with your changes and own items (hidden ones left out),
 * plus each game's examples one by one while its list is empty and examples are shown
 * (the same examples Events, Banners and Pulls use, so a tick or hide on one shows everywhere).
 * Leaks are left out while "Hide leaks" is on.
 */
export function withOwnItems(
  games: GameContract[],
  lists: Record<GameId, GameLists>,
  user: Record<GameId, GameUserData>,
  opts: { showExamples: boolean; hideLeaks: boolean; now: number; servers?: Record<string, string> },
): Record<GameId, GameLists> {
  const { showExamples, hideLeaks, now, servers = {} } = opts;
  const noLeaks = <T extends { leak?: unknown }>(list: T[]) => (hideLeaks ? list.filter((x) => !x.leak) : list);
  return Object.fromEntries(
    Object.entries(lists).map(([id, l]) => {
      const game = games.find((g) => g.id === id);
      const own = user[id]?.ownItems;
      const art = (l.sampleArt ?? []).map((a) => a.characterId);
      // "Server time" ends move to the user's server.
      const offset = game ? serverOffset(game, servers) : undefined;
      const banners = mixExamples('banners', listAtServer(l.banners, offset), own?.banners, game ? exampleBannerSchedule(game, l.characters, now, art) : [], showExamples);
      const events = mixExamples('events', listAtServer(l.events, offset), own?.events, game ? exampleEvents(game, now) : [], showExamples);
      return [id, { ...l, banners: noLeaks(banners.list), events: noLeaks(events.list), exampleIds: new Set([...banners.exampleIds, ...events.exampleIds]), real: { banners: banners.real, events: events.real } }];
    }),
  );
}
