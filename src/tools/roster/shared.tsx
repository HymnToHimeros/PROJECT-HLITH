import type { Character, GameContract } from '../../core/contract';
import type { RosterEntry } from '../../core/data/userData';
import { GameTag } from '../../core/ui';
import r from './roster.module.css';

export const NO_ENTRY: RosterEntry = { owned: false, wanted: false, dupes: 0 };

export const entryOf = (roster: Record<string, RosterEntry>, id: string): RosterEntry => roster[id] ?? NO_ENTRY;

export const elementOf = (game: GameContract, id: string) => game.elements.find((e) => e.id === id);
export const roleLabel = (game: GameContract, id: string) => game.roles.find((x) => x.id === id)?.label ?? id;

/** "Nihility · Lightning": role and element words from the game record. */
export const subtitleOf = (game: GameContract, c: Character) => `${roleLabel(game, c.role)} · ${elementOf(game, c.element)?.label ?? c.element}`;

/** "E2" / "M1" from the game's dupe prefix; undefined when the game has no dupes. */
export const dupesLabel = (game: GameContract, n: number) => (game.dupes ? `${game.dupes.prefix}${n}` : undefined);

/** How many characters a team holds, from the game record. */
export function teamSizeOf(game: GameContract): number {
  return game.teamSize;
}

/** Newest first by release date; characters without a date go after, by name. */
export function byNewest(a: Character, b: Character): number {
  if (a.releasedAt && b.releasedAt) return b.releasedAt.localeCompare(a.releasedAt) || a.name.localeCompare(b.name);
  if (a.releasedAt) return -1;
  if (b.releasedAt) return 1;
  return a.name.localeCompare(b.name);
}

export function GameHeading({ game, show }: { game: GameContract; show: boolean }) {
  if (!show) return null;
  return (
    <h2 className={r.gameHead}>
      <GameTag label={game.short} vent={game.vent} />
      {game.name}
    </h2>
  );
}

/** A small "who" chip: name plus owned / wanted / missing, never colour alone. */
export function WhoChip({ name, status }: { name: string; status: 'owned' | 'wanted' | 'gap' }) {
  const word = status === 'owned' ? 'owned' : status === 'wanted' ? 'wanted' : 'not owned';
  return (
    <span className={`${r.who} ${r[`who_${status}`] ?? ''}`}>
      <span className={r.whoName}>{name}</span>
      <span className={r.whoState}>{word}</span>
    </span>
  );
}
