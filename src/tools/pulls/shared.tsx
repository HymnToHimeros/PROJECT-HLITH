import type { ReactNode } from 'react';
import type { GameContract } from '../../core/contract';
import { ExampleTag, GameTag } from '../../core/ui';
import { cx } from '../../core/ui/cx';
import k from './kit.module.css';
import p from './pulls.module.css';

export const percent = (x: number) => `${(x * 100).toFixed(x > 0.995 && x < 1 ? 1 : x < 0.01 ? 2 : 1)}%`;

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

/**
 * The design's on/off switch (40×24 track, dark knob). The track takes the
 * game's vent when on. A real switch for screen readers.
 */
export function Switch({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: (on: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={cx(k.switch, checked && k.switchOn)}
      onClick={() => onChange(!checked)}
    >
      <span className={k.knob} aria-hidden="true" />
    </button>
  );
}

/** Filter buttons (one pressed at a time). Not tabs: the content below stays the same screen. */
export function Filters<T extends string>({ label, options, value, onChange }: { label: string; options: { id: T; label: string }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div className={k.filters} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" className={k.filter} aria-pressed={o.id === value} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** The design's dashed one-line notice: em dash, what's missing, and where to fix it. */
export function Strip({ children, action }: { children: ReactNode; action?: { label: string; onClick: () => void } | undefined }) {
  return (
    <div className={k.strip}>
      <span className={k.stripDash} aria-hidden="true">
        —
      </span>
      <span className={k.stripText}>{children}</span>
      {action && (
        <button type="button" className={k.stripAction} onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}

/** Tile from the design: label, big mono number, caption. */
export function Tile({ label, value, caption, tone }: { label: string; value: ReactNode; caption?: ReactNode; tone?: 'glacier' | 'muted' | undefined }) {
  return (
    <div className={k.tile}>
      <span className={k.tileLabel}>{label}</span>
      <span className={cx(k.tileValue, tone === 'muted' && k.tileEmpty)}>{value}</span>
      {caption && <span className={cx(k.tileCaption, tone === 'glacier' && k.glacier)}>{caption}</span>}
    </div>
  );
}

/** A tile whose value can't be proven yet: grey dash + "No data yet · why". */
export function EmptyTile({ label, why }: { label: string; why: string }) {
  return <Tile label={label} value="—" tone="muted" caption={<span className={k.glacier}>No data yet · {why}</span>} />;
}
