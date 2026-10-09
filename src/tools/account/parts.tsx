import type { CSSProperties, ReactNode } from 'react';
import a from './account.module.css';

/** Sub-page header inside the Account sheet: ← back, title, ✕. */
export function SubHeader({ title, sub, onBack, onClose }: { title: string; sub?: string; onBack: () => void; onClose: () => void }) {
  return (
    <div className={a.head}>
      <button type="button" className={a.iconBtn} onClick={onBack} aria-label="Back to Account">
        ←
      </button>
      <div className={a.headText}>
        <h2 className={a.title}>{title}</h2>
        {sub && <span className={a.sub}>{sub}</span>}
      </div>
      <button type="button" className={a.iconBtn} onClick={onClose} aria-label="Close">
        ✕
      </button>
    </div>
  );
}

/** One row of the Account sheet (design: label, sub line, ›). */
export function Row({ title, sub, onClick, disabled = false }: { title: string; sub: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button type="button" className={a.row} onClick={onClick} disabled={disabled}>
      <span className={a.rowText}>
        <span className={a.rowTitle}>{title}</span>
        <span className={a.rowSub}>{sub}</span>
      </span>
      <span className={a.chev} aria-hidden="true">
        ›
      </span>
    </button>
  );
}

export function Card({ title, children, danger = false, label }: { title: string; children: ReactNode; danger?: boolean; label?: string }) {
  return (
    <section className={danger ? `${a.card} ${a.danger}` : a.card} aria-label={label ?? title}>
      <h3 className={a.cardTitle}>{title}</h3>
      {children}
    </section>
  );
}

/** On/off switch drawn over a real checkbox (keyboard and screen readers work as usual). */
export function Switch({
  label,
  hint,
  checked,
  onChange,
  disabled = false,
  vent,
}: {
  label: string;
  hint?: ReactNode;
  checked: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
  vent?: string;
}) {
  return (
    <label className={a.switchRow} style={vent ? ({ '--sw-vent': vent } as CSSProperties) : undefined}>
      <span className={a.switchText}>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <span className={a.switch}>
        <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
        <span className={a.track} aria-hidden="true" />
      </span>
    </label>
  );
}

/** "3 days ago", "today". */
export function ago(t: number, now: number): string {
  const days = Math.floor((now - t) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}
