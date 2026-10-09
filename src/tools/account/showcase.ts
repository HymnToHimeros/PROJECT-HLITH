/**
 * The profile showcase: account facts and game stats, built only from your own data.
 * No React. A card with nothing behind it says so (`empty`) and names where to add
 * the data (`fix`); it never shows a 0 or a guess in place of a missing value.
 */
import type { BacklogItem, Character, GameContract, GameId, ModuleId } from '../../core/contract';
import type { Known } from '../../core/contract/known';
import type { GameUserData } from '../../core/data/userData';
import { mergeOwnItems } from '../edit-mode/merge';
import { pityFromHistory } from '../pity/pity';
import type { CardId } from './profile';

export type Fix = { label: string; module: ModuleId; tab?: string } | { label: string; section: string };

export interface ShowcaseInput {
  games: GameContract[];
  servers: Record<GameId, string>;
  data: Record<GameId, GameUserData>;
  /** Built-in character list per game; missing = still loading. */
  characters: Record<GameId, Character[] | undefined>;
  /** Built-in backlog list per game (real list, never examples); missing = still loading. */
  backlog: Record<GameId, BacklogItem[] | undefined>;
  /** Signed-in account facts from the session, or null in "this device only" mode. */
  account: { identities: string[]; provider?: string | undefined; createdAt?: string | undefined } | null;
  pinned: Record<GameId, string[]>;
}

export interface GameLine {
  game: GameContract;
}
export interface CharactersLine extends GameLine {
  owned: number;
  pinned: Character[];
}
export interface PullsLine extends GameLine {
  total: number;
  tops: number;
}
export interface PityLine extends GameLine {
  banners: { id: string; label: string; pity: number; guaranteed: Known<boolean> }[];
}
export interface BacklogLine extends GameLine {
  /** Items you've entered a done count for. */
  counted: number;
  items: number;
  /** Share done, 0–1. Only when every item has a count (percentages only when the data is complete). */
  done: number | null;
}

export type ShowcaseCard =
  | { id: 'games'; empty: boolean; fix?: Fix; lines: (GameLine & { server: string | null })[] }
  | { id: 'sign-in'; empty: boolean; fix?: Fix; methods: string[] }
  | { id: 'member-since'; empty: boolean; fix?: Fix; since: string | null }
  | { id: 'characters'; empty: boolean; fix?: Fix; loading: boolean; lines: CharactersLine[] }
  | { id: 'pulls'; empty: boolean; fix?: Fix; lines: PullsLine[] }
  | { id: 'pity'; empty: boolean; fix?: Fix; lines: PityLine[] }
  | { id: 'backlog'; empty: boolean; fix?: Fix; loading: boolean; lines: BacklogLine[] };

export const METHOD_LABEL: Record<string, string> = { discord: 'Discord', google: 'Google', email: 'Email link' };

export function showcaseCards(input: ShowcaseInput): Record<CardId, ShowcaseCard> {
  const { games, servers, data, account } = input;
  const user = (id: GameId) => data[id];

  const gameLines = games.map((game) => ({ game, server: game.servers.find((s) => s.id === servers[game.id])?.label ?? null }));

  const methods = account ? [...new Set([...account.identities, ...(account.provider ? [account.provider] : [])])] : [];

  const charactersLoading = games.some((g) => input.characters[g.id] === undefined);
  const charLines: CharactersLine[] = games
    .map((game) => {
      const roster = user(game.id)?.roster ?? {};
      const owned = Object.entries(roster).filter(([, e]) => e.owned);
      const byId = new Map((input.characters[game.id] ?? []).map((c) => [c.id, c]));
      const pinned = (input.pinned[game.id] ?? []).filter((id) => roster[id]?.owned).flatMap((id) => byId.get(id) ?? []);
      return { game, owned: owned.length, pinned };
    })
    .filter((l) => l.owned > 0);

  const pullLines: PullsLine[] = games
    .map((game) => {
      const pulls = user(game.id)?.pulls ?? [];
      return { game, total: pulls.length, tops: pulls.filter((p) => p.rarity === 'top').length };
    })
    .filter((l) => l.total > 0);

  const pityLines: PityLine[] = games
    .map((game) => {
      const pulls = user(game.id)?.pulls ?? [];
      const banners = game.bannerTypes.flatMap((bt) => {
        const { pity, guaranteed } = pityFromHistory(pulls, bt.id);
        return pity.known ? [{ id: bt.id, label: bt.label, pity: pity.value, guaranteed }] : [];
      });
      return { game, banners };
    })
    .filter((l) => l.banners.length > 0);

  const backlogLoading = games.some((g) => input.backlog[g.id] === undefined);
  const backlogLines: BacklogLine[] = games
    .map((game) => {
      const u = user(game.id);
      const items = mergeOwnItems('backlog', input.backlog[game.id] ?? [], u?.ownItems.backlog ?? {});
      const counts = items.map((it) => ({ it, done: u?.backlog[it.id] }));
      const counted = counts.filter((c) => c.done !== undefined);
      const total = items.reduce((n, it) => n + Math.max(0, it.total), 0);
      const doneSum = counted.reduce((n, c) => n + Math.min(Math.max(0, c.done ?? 0), Math.max(0, c.it.total)), 0);
      const complete = items.length > 0 && counted.length === items.length && total > 0;
      return { game, counted: counted.length, items: items.length, done: complete ? doneSum / total : null };
    })
    .filter((l) => l.items > 0 && l.counted > 0);

  return {
    games: { id: 'games', empty: false, lines: gameLines, ...(gameLines.some((l) => !l.server) ? { fix: { label: 'Choose servers', section: 'game-settings' } } : {}) },
    'sign-in': { id: 'sign-in', empty: methods.length === 0, methods, ...(account ? {} : { fix: { label: 'About sign-in', section: 'sign-in' } }) },
    'member-since': {
      id: 'member-since',
      empty: !account?.createdAt,
      since: account?.createdAt ?? null,
      ...(account ? {} : { fix: { label: 'About sign-in', section: 'sign-in' } }),
    },
    characters: { id: 'characters', empty: charLines.length === 0, loading: charactersLoading, lines: charLines, fix: { label: 'Open Roster', module: 'roster', tab: 'characters' } },
    pulls: { id: 'pulls', empty: pullLines.length === 0, lines: pullLines, fix: { label: 'Import pull history', module: 'pulls', tab: 'history' } },
    pity: { id: 'pity', empty: pityLines.length === 0, lines: pityLines, fix: { label: 'Import pull history', module: 'pulls', tab: 'history' } },
    backlog: { id: 'backlog', empty: backlogLines.length === 0, loading: backlogLoading, lines: backlogLines, fix: { label: 'Open Backlog', module: 'backlog' } },
  };
}
