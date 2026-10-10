import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from './cx';
import s from './Menu.module.css';

export interface MenuItem {
  label: string;
  onSelect: () => void;
}

interface Props {
  /** Screen-reader name of the trigger, e.g. "More for Web event". */
  label: string;
  items: MenuItem[];
  /** What the trigger shows; a ⋯ by default. */
  children?: ReactNode;
  className?: string;
}

/**
 * A small menu for the less common actions on a row (e.g. Skip, Reopen), so a
 * row shows one clear button instead of a wall of them. A real button with
 * aria-haspopup; the list is role="menu". Keyboard: Enter / Space / ↓ opens on
 * the first item, ↑ / ↓ / Home / End move, Escape or Tab closes, focus returns
 * to the trigger.
 */
export function Menu({ label, items, children, className }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [start, setStart] = useState<'first' | 'last'>('first');

  useEffect(() => {
    if (!open) return;
    const all = list.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
    (start === 'last' ? all?.[all.length - 1] : all?.[0])?.focus();
    const outside = (ev: PointerEvent) => {
      if (!wrap.current?.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open, start]);

  const close = (focus = true) => {
    setOpen(false);
    if (focus) trigger.current?.focus();
  };

  const onListKey = (ev: KeyboardEvent) => {
    const all = [...(list.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
    const at = all.indexOf(document.activeElement as HTMLButtonElement);
    const go = (i: number) => all[(i + all.length) % all.length]?.focus();
    if (ev.key === 'ArrowDown') go(at + 1);
    else if (ev.key === 'ArrowUp') go(at - 1);
    else if (ev.key === 'Home') go(0);
    else if (ev.key === 'End') go(all.length - 1);
    else if (ev.key === 'Escape') close();
    else if (ev.key === 'Tab') close(false);
    else return;
    if (ev.key !== 'Tab') ev.preventDefault();
  };

  return (
    <div className={cx(s.wrap, className)} ref={wrap}>
      <button
        ref={trigger}
        type="button"
        className={s.trigger}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => {
          setStart('first');
          setOpen((o) => !o);
        }}
        onKeyDown={(ev) => {
          if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
            ev.preventDefault();
            setStart(ev.key === 'ArrowUp' ? 'last' : 'first');
            setOpen(true);
          }
        }}
      >
        {children ?? <span aria-hidden="true">⋯</span>}
      </button>
      {open && (
        <div className={s.menu} role="menu" id={id} aria-label={label} ref={list} onKeyDown={onListKey}>
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={s.item}
              onClick={() => {
                close();
                it.onSelect();
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
