import type { HTMLAttributes } from 'react';
import { cx } from './cx';
import { GameTag } from './Tags';
import s from './ui.module.css';

interface Props {
  label: string;
  state: 'normal' | 'dragging' | 'hidden' | 'not-available';
  onHide?: () => void;
  onRestore?: () => void;
  /** Spread onto the ⋮⋮ handle by Edit layout's drag logic (step 5). */
  handleProps?: HTMLAttributes<HTMLButtonElement>;
  /** Position number shown before the label ("01"). */
  num?: string;
  /** Game tag (All games). */
  tag?: { label: string; vent: string } | undefined;
}

export function DragHandleRow({ label, state, onHide, onRestore, handleProps, num, tag }: Props) {
  if (state === 'hidden') {
    return (
      <div className={cx(s.dragRow, s.hiddenRow)}>
        <span className={s.rowLabel}>{label}</span>
        <button type="button" className={s.restore} onClick={onRestore}>
          Restore
        </button>
      </div>
    );
  }
  if (state === 'not-available') {
    return (
      <div className={cx(s.dragRow, s.unavailableRow)} aria-disabled="true">
        <span className={s.rowLabel}>{label}</span>
        <span className={s.unavailableNote}>Not available for this game yet</span>
      </div>
    );
  }
  return (
    <div className={cx(s.dragRow, state === 'dragging' && s.dragging)}>
      <button type="button" className={s.handle} aria-label={`Move ${label}`} {...handleProps}>
        ⋮⋮
      </button>
      {num && <span className={s.rowNum}>{num}</span>}
      <span className={s.rowLabel}>{label}</span>
      {tag && <GameTag {...tag} />}
      {onHide && state === 'normal' && (
        <button type="button" className={s.rowAction} onClick={onHide}>
          Hide
        </button>
      )}
    </div>
  );
}
