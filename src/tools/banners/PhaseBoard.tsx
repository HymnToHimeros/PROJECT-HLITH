import { useState, type ReactNode } from 'react';
import type { Banner, GameContract } from '../../core/contract';
import { formatRange } from '../../core/time/reset';
import { cx } from '../../core/ui/cx';
import b from './banners.module.css';
import type { Phase } from './fit';

const DAY = 86_400_000;

export const PHASES: { id: Phase; label: string }[] = [
  { id: 'now', label: 'Now' },
  { id: 'next', label: 'Next' },
  { id: 'later', label: 'Later' },
];

export interface PhaseColumn {
  /** The column's first banner: its dates make the column's note. */
  first: Banner | undefined;
  count: number;
  /** The cards, stacked in the column. */
  children: ReactNode;
}

export const countdown = (ms: number) => {
  const d = Math.floor(ms / DAY);
  const h = Math.floor((ms % DAY) / 3_600_000);
  return d > 0 ? `${d}d ${h}h` : `${h}h`;
};

/** The line under a column's name, e.g. "Live · 9d 9h until the first one ends". */
export function phaseNote(id: Phase, first: Banner | undefined, now: number): string {
  if (id === 'now') return first ? (first.permanent ? 'Live now' : `Live · ${countdown(Date.parse(first.end) - now)} until the first one ends`) : 'Nothing limited is live';
  if (first) return `${formatRange(Date.parse(first.start), Date.parse(first.end))} · opens in ${countdown(Date.parse(first.start) - now)}`;
  return id === 'next' ? 'Not announced yet' : 'Nothing further listed';
}

/**
 * Now / Next / Later side by side, cards stacked in each column (the Banners board). Banners and
 * Pulls → Planner both use it, so the two always look the same. On a phone the columns become tabs.
 */
export function PhaseBoard({ game, now, many, column }: { game: GameContract; now: number; many: boolean; column: (id: Phase) => PhaseColumn }) {
  const [tab, setTab] = useState<Phase>('now');
  const columns = Object.fromEntries(PHASES.map(({ id }) => [id, column(id)])) as Record<Phase, PhaseColumn>;
  return (
    <>
      <div className={b.tabs} role="tablist" aria-label={`${game.short} phases`}>
        {PHASES.map(({ id, label }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={b.tabBtn} onClick={() => setTab(id)}>
            {label} <span className={b.tabCount}>{columns[id].count}</span>
          </button>
        ))}
      </div>
      <div className={cx(b.board, many && b.boardLabelled)}>
        {many && (
          <div className={b.gameLabel} aria-hidden="true">
            <span>{game.name}</span>
          </div>
        )}
        {PHASES.map(({ id, label }) => {
          const col = columns[id];
          return (
            <div key={id} role="group" aria-label={label} className={cx(b.column, id === 'now' && b.columnNow)} data-active={tab === id}>
              <div className={b.columnHead}>
                <span className={b.columnLabel}>{label}</span>
                <span className={b.columnNote}>{phaseNote(id, col.first, now)}</span>
              </div>
              {col.children}
              {col.count === 0 && <div className={b.emptyCell} aria-hidden="true" />}
            </div>
          );
        })}
      </div>
    </>
  );
}
