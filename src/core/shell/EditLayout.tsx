import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { GameContract, ModuleId } from '../contract';
import { MODULES } from '../registry/modules';
import { hiddenIn, hide, move, notAvailable, PHONE_BAR_SIZE, reset, restore, slot, type LayoutState, type Scope } from '../registry/layout';
import { Button } from '../ui/Button';
import { DragHandleRow } from '../ui/DragHandleRow';
import { HowTo } from '../ui/HowTo';
import p from './picker.module.css';

interface Props {
  games: GameContract[];
  scope: Scope;
  layout: LayoutState;
  onChange: (layout: LayoutState) => void;
  onDone: () => void;
  /** "Honkai: Star Rail" or "All games". */
  scopeName: string;
}

const two = (n: number) => String(n).padStart(2, '0');

/**
 * Edit layout (DESIGN §1 rules): drag ⋮⋮ (or arrow keys on it) to reorder, Hide,
 * Restore, Reset to default. The dashed line shows where the phone bar ends.
 */
export function EditLayout({ games, scope, layout, onChange, onDone, scopeName }: Props) {
  const visible = slot(games, scope, layout);
  const hidden = hiddenIn(games, scope, layout);
  const missing = notAvailable(games, scope);
  const [drag, setDrag] = useState<{ id: ModuleId; over: number } | null>(null);
  const [announce, setAnnounce] = useState('');
  // The layout from just before "Reset to default", so one tap brings it back.
  const [beforeReset, setBeforeReset] = useState<LayoutState | null>(null);
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
    <>
      <div className={p.editHead}>
        <span className={p.editLabel}>EDIT LAYOUT</span>
        <h3 className={p.editTitle}>{scopeName}</h3>
        <p className={p.editNote}>Drag ⋮⋮ to reorder. One order for every game.</p>
      </div>
      <div className={p.editBody}>
        <div className={p.rows} ref={rowsRef}>
          {shown.map((id, i) => (
            <div key={id} data-row>
              <DragHandleRow
                label={MODULES[id].label}
                num={two(i + 1)}
                state={drag?.id === id ? 'dragging' : 'normal'}
                {...(visible.length > 1 ? { onHide: () => onChange(hide(games, scope, layout, id)) } : {})}
                handleProps={{ onPointerDown: onPointerDown(id), onPointerMove, onPointerUp, onPointerCancel: () => setDrag(null), onKeyDown: onKeyDown(id) }}
              />
              {i === PHONE_BAR_SIZE - 1 && shown.length > PHONE_BAR_SIZE && <div className={p.cut}>PHONE BAR ↑ · MORE ↓</div>}
            </div>
          ))}
        </div>
        <span className="visually-hidden" aria-live="polite">
          {announce}
        </span>

        {hidden.length > 0 && (
          <>
            <span className={p.editSection}>{scope === 'all' ? 'HIDDEN · STILL IN YOUR GAMES' : 'HIDDEN · STILL IN THIS GAME'}</span>
            <div className={p.rows}>
              {hidden.map((id) => (
                <DragHandleRow key={id} label={MODULES[id].label} state="hidden" onRestore={() => onChange(restore(layout, id))} />
              ))}
            </div>
          </>
        )}
        {missing.length > 0 && (
          <>
            <span className={p.editSection}>NOT IN THIS GAME</span>
            <div className={p.rows}>
              {missing.map((id) => (
                <DragHandleRow key={id} label={MODULES[id].label} state="not-available" />
              ))}
            </div>
          </>
        )}
        <div style={{ marginTop: 'var(--s-4)' }}>
          <HowTo
            steps={[
              'Press and hold ⋮⋮ next to a module, then drag it up or down. On a keyboard, focus ⋮⋮ and use the arrow keys.',
              `The first ${PHONE_BAR_SIZE} modules sit in the phone’s bottom bar; the rest go under More.`,
              'Hide takes a module out of the menu. It stays in the game: Restore brings it back with everything you saved.',
              'One order for every game and All games. Modules a game doesn’t have simply drop out. Reset to default puts the order back the way it came (Undo brings yours back).',
            ]}
          />
        </div>
      </div>
      <div className={p.actions}>
        {beforeReset ? (
          <Button
            onClick={() => {
              onChange(beforeReset);
              setBeforeReset(null);
              setAnnounce('Your order is back');
            }}
          >
            Undo reset
          </Button>
        ) : (
          <Button
            onClick={() => {
              setBeforeReset(layout);
              onChange(reset());
              setAnnounce('Order reset to default. Undo brings yours back.');
            }}
          >
            Reset to default
          </Button>
        )}
        <Button variant="primary" onClick={onDone}>
          Done
        </Button>
      </div>
    </>
  );
}

function reorder(list: ModuleId[], id: ModuleId, to: number): ModuleId[] {
  const rest = list.filter((m) => m !== id);
  rest.splice(Math.max(0, Math.min(to, rest.length)), 0, id);
  return rest;
}
