import { useRef, type KeyboardEvent } from 'react';
import s from './ui.module.css';

interface Props<T extends string> {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}

/** Tabs like Pulls' Planner · Calculator · Bank log · History. Arrow keys move between them. */
export function Segmented<T extends string>({ label, options, value, onChange }: Props<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (e: KeyboardEvent, i: number) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + options.length) % options.length;
    const opt = options[next];
    if (!opt) return;
    onChange(opt.id);
    refs.current[next]?.focus();
  };
  return (
    <div className={s.segmented} role="tablist" aria-label={label}>
      {options.map((o, i) => (
        <button
          key={o.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="tab"
          aria-selected={o.id === value}
          tabIndex={o.id === value ? 0 : -1}
          className={s.segment}
          onClick={() => onChange(o.id)}
          onKeyDown={(e) => move(e, i)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
