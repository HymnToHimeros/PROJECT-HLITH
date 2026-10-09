import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { GameContract, ModuleId } from '../contract';
import { MODULES } from '../registry/modules';
import { hiddenIn, hide, move, notAvailable, PHONE_BAR_SIZE, reset, restore, slot, type LayoutState, type Scope } from '../registry/layout';
import { Button } from '../ui/Button';
import { DragHandleRow } from '../ui/DragHandleRow';
import s from './shell.module.css';
import p from './picker.module.css';

interface Props {
  games: GameContract[];
  scope: Scope;
  layout: LayoutState;
  onChange: (layout: LayoutState) => void;
  onDone: () => void;
}

/**
 * Edit layout (DESIGN §1 rules): drag ⋮⋮ (or arrow keys on it) to reorder, Hide,
 * Restore, Reset to default. The dashed line shows where the phone bar ends.
 */
export function EditLayout({ games, scope, layout, onChange, onDone }: Props) {
  const visible = slot(games, scope, layout);
  const hidden = hiddenIn(games, scope, layout);
  const missing = notAvailable(games, scope);
  const [drag, setDrag] = useState<{ id: ModuleId; over: number } | null>(null);
  const [announce, setAnnounce] = useState('');
  const rowsRef = useRef<HTMLDivElement>(null);

  const shown = drag ? reorder(visible, drag.id, drag.over) : visible;

  const indexAt = (y: number): number => {
    const rows = [...(rowsRef.current?.querySelectorAll<HTMLElement>('[data-row]') ?? [])];
    const i = rows.findIndex((r) => {
      const box = r.getBoundingClientRect();
      return y < box.top + box.height / 2;
    });
    return i === -1 ? rows.length - 1 : i;
  };

  const onPointerDown = (id: ModuleId) => (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ id, over: visible.indexOf(id) });
  };
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (drag) setDrag({ ...drag, over: indexAt(e.clientY) });
  };
  const onPointerUp = () => {
    if (drag) onChange(move(games, scope, layout, drag.id, drag.over));
    setDrag(null);
  };
  const onKeyDown = (id: ModuleId) => (e: KeyboardEvent<HTMLButtonElement>) => {
    const step = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
    if (!step) return;
    e.preventDefault();
    const to = Math.max(0, Math.min(visible.length - 1, visible.indexOf(id) + step));
    onChange(move(games, scope, layout, id, to));
    setAnnounce(`${MODULES[id].label} moved to position ${to + 1} of ${visible.length}`);
  };

  return (
    <div className={s.section}>
      <p className={s.note}>Drag ⋮⋮ or use the arrow keys on it. The first {PHONE_BAR_SIZE} sit in the phone bar.</p>
      <div className={p.rows} ref={rowsRef}>
        {shown.map((id, i) => (
          <div key={id} data-row>
            {i === PHONE_BAR_SIZE && <div className={p.cut}>PHONE BAR ↑ · MORE ↓</div>}
            <DragHandleRow
              label={MODULES[id].label}
              state={drag?.id === id ? 'dragging' : 'normal'}
              {...(visible.length > 1 ? { onHide: () => onChange(hide(games, scope, layout, id)) } : {})}
              handleProps={{ onPointerDown: onPointerDown(id), onPointerMove, onPointerUp, onPointerCancel: () => setDrag(null), onKeyDown: onKeyDown(id) }}
            />
          </div>
        ))}
      </div>
      <span className="visually-hidden" aria-live="polite">
        {announce}
      </span>

      {hidden.length > 0 && (
        <div className={s.section}>
          <span className={s.sectionLabel}>HIDDEN · STILL IN THIS GAME</span>
          {hidden.map((id) => (
            <DragHandleRow key={id} label={MODULES[id].label} state="hidden" onRestore={() => onChange(restore(layout, id))} />
          ))}
        </div>
      )}
      {missing.length > 0 && (
        <div className={s.section}>
          <span className={s.sectionLabel}>NOT IN THIS GAME</span>
          {missing.map((id) => (
            <DragHandleRow key={id} label={MODULES[id].label} state="not-available" />
          ))}
        </div>
      )}

      <div className={p.actions}>
        <Button onClick={() => onChange(reset(games, scope))}>Reset to default</Button>
        <Button variant="primary" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}

function reorder(list: ModuleId[], id: ModuleId, to: number): ModuleId[] {
  const rest = list.filter((m) => m !== id);
  rest.splice(Math.max(0, Math.min(to, rest.length)), 0, id);
  return rest;
}
