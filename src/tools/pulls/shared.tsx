import type { ReactNode } from 'react';
import type { GameContract } from '../../core/contract';
import { ExampleTag, GameTag } from '../../core/ui';
import p from './pulls.module.css';

export const percent = (x: number) => `${(x * 100).toFixed(x > 0.995 && x < 1 ? 1 : x < 0.01 ? 2 : 1)}%`;

/** Shown at the top whenever any example data is on screen. */
export function ExampleNotice({ children }: { children?: ReactNode }) {
  return (
    <div className={p.notice} role="note">
      <ExampleTag />
      <span>Example data, not yours. It shows how this page works. {children ?? 'Add or import your own and it is replaced.'}</span>
    </div>
  );
}

export function GameHeading({ game, show }: { game: GameContract; show: boolean }) {
  if (!show) return null;
  return (
    <h2 className={p.gameHead}>
      <GameTag label={game.short} vent={game.vent} />
      {game.name}
    </h2>
  );
}

/** A value with its EXAMPLE badge when it comes from example data. */
export function Ex({ example, children }: { example: boolean; children: ReactNode }) {
  return (
    <span>
      {children} {example && <ExampleTag />}
    </span>
  );
}
