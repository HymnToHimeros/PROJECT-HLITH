import type { CSSProperties, ReactNode } from 'react';
import type { Character, CharacterBuild, GameContract, GameId, SavedBuild } from '../../core/contract';
import { useGameData, type GameUserData, type RosterEntry } from '../../core/data/userData';
import { initials } from '../../core/ui';
import r from './roster.module.css';

export const NO_ENTRY: RosterEntry = { owned: false, wanted: false, dupes: 0 };

export const entryOf = (roster: Record<string, RosterEntry>, id: string): RosterEntry => roster[id] ?? NO_ENTRY;

export const elementOf = (game: GameContract, id: string) => game.elements.find((e) => e.id === id);
export const roleLabel = (game: GameContract, id: string) => game.roles.find((x) => x.id === id)?.label ?? id;

/** "Nihility · Lightning": role and element words from the game record. */
export const subtitleOf = (game: GameContract, c: Character) => `${roleLabel(game, c.role)} · ${elementOf(game, c.element)?.label ?? c.element}`;

/** "E2" / "M1" from the game's dupe prefix; undefined when the game has no dupes. */
export const dupesLabel = (game: GameContract, n: number) => (game.dupes ? `${game.dupes.prefix}${n}` : undefined);

export const rarityColor = (c: Pick<Character, 'rarity'>) => (c.rarity === 'top' ? 'var(--rarity-top)' : 'var(--rarity-mid)');

/** Newest first by release date; characters without a date go after, by name. */
export function byNewest(a: Character, b: Character): number {
  if (a.releasedAt && b.releasedAt) return b.releasedAt.localeCompare(a.releasedAt) || a.name.localeCompare(b.name);
  if (a.releasedAt) return -1;
  if (b.releasedAt) return 1;
  return a.name.localeCompare(b.name);
}

/** Released date still ahead: the character is upcoming (shown as unverified until it's out). */
export const isUpcoming = (c: Character, now = Date.now()) => Boolean(c.releasedAt && Date.parse(c.releasedAt) > now);

/** A game tag, only when several games share the screen (DESIGN: tags appear only in All games). */
export const tagOf = (game: GameContract, show: boolean) => (show ? { label: game.short, vent: game.vent } : undefined);

/**
 * Character art: the image fills the frame (object-fit: cover). Without art, a
 * properly sized hatched placeholder tinted by the element, with initials.
 * `src` comes from the character itself, or from sample art on EXAMPLE items only.
 */
export function CharArt({ name, src, elementColor, className, children, label = false }: { name: string; src?: string | undefined; elementColor: string; className?: string | undefined; children?: ReactNode; label?: boolean }) {
  return (
    <div className={`${r.art} ${className ?? ''}`} style={{ '--el': elementColor } as CSSProperties}>
      {src ? (
        <img src={src} alt="" loading="lazy" decoding="async" />
      ) : (
        <>
          <span className={r.artInitials} aria-hidden="true">
            {initials(name)}
          </span>
          {label && (
            <span className={r.artLabel} aria-hidden="true">
              ART
            </span>
          )}
        </>
      )}
      {children}
    </div>
  );
}

/** The art a character shows: its own art, or sample art when (and only when) it's on an example item. */
export function artOf(c: Character, kind: 'portrait' | 'art', sample?: { art: string; portrait: string } | undefined): string | undefined {
  const own = kind === 'portrait' ? (c.portrait ?? c.art) : (c.art ?? c.portrait);
  return own ?? (sample ? sample[kind] : undefined);
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

/** A section title row inside a screen: title, optional note, optional action. */
export function SectionHead({ title, note, children, id }: { title: string; note?: ReactNode; children?: ReactNode; id?: string }) {
  return (
    <div className={r.sectionHead}>
      <div className={r.sectionText}>
        <h3 className={r.sectionTitle} id={id}>
          {title}
        </h3>
        {note && <span className={r.muted}>{note}</span>}
      </div>
      {children}
    </div>
  );
}

/** A saved build (the build editor's shape) as the game rules read it: build score and team build wants (T18). */
export function toCharacterBuild(saved: SavedBuild, id: string, dupes: number): CharacterBuild {
  return {
    characterId: id,
    level: saved.level ?? 0,
    dupes,
    ...(saved.weapon
      ? {
          weapon: {
            name: saved.weapon.name,
            ...(saved.weapon.id ? { id: saved.weapon.id } : {}),
            ...(saved.weapon.level !== undefined ? { level: saved.weapon.level } : {}),
            ...(saved.weapon.refine !== undefined ? { refine: saved.weapon.refine } : {}),
          },
        }
      : {}),
    // Every piece that has anything entered: main stat, set, sub stats (and their rolls when known).
    gear: saved.gear
      .filter((g) => g.main || g.set || g.subs.length)
      .map((g) => ({
        slot: g.slot,
        main: g.main ?? '',
        subs: Object.fromEntries(g.subs.map((x) => [x.stat, x.value])),
        ...(g.set ? { set: g.set } : {}),
        ...(g.subs.some((x) => x.rolls !== undefined) ? { rolls: Object.fromEntries(g.subs.filter((x) => x.rolls !== undefined).map((x) => [x.stat, x.rolls ?? 0])) } : {}),
      })),
    ...(saved.skills ? { skills: saved.skills } : {}),
    ...(saved.totals && Object.keys(saved.totals).length ? { totals: saved.totals } : {}),
  };
}
