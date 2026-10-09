import type { CSSProperties } from 'react';
import s from './ui.module.css';

/** Game tag in that game's vent. Shown only in All games. */
export function GameTag({ label, vent }: { label: string; vent: string }) {
  return (
    <span className={s.gameTag} style={{ '--tag-vent': vent } as CSSProperties}>
      {label}
    </span>
  );
}

/** Leak or datamine marker. The source is always shown. */
export function UnverifiedTag({ source }: { source: string }) {
  return (
    <span className={s.unverified}>
      <span className={s.unverifiedTag} title="Not confirmed by the game">
        ? UNVERIFIED
      </span>
      <span className={s.source}>{source}</span>
    </span>
  );
}
