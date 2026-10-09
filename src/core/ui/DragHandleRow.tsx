import type { HTMLAttributes } from 'react';
import { cx } from './cx';
import s from './ui.module.css';

interface Props {
  label: string;
  state: 'normal' | 'dragging' | 'hidden' | 'not-available';
  onHide?: () => void;
  onRestore?: () => void;
  /** Spread onto the ⋮⋮ handle by Edit layout's drag logic (step 5). */
  handleProps?: HTMLAttributes<HTMLButtonElement>;
}

export function DragHandleRow({ label, state, onHide, onRestore, handleProps }: Props) {
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
      <span className={s.rowLabel}>{label}</span>
      {onHide && state === 'normal' && (
        <button type="button" className={s.rowAction} onClick={onHide}>
          Hide
        </button>
      )}
    </div>
  );
}
