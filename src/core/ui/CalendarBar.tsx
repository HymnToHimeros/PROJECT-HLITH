import type { CSSProperties } from 'react';
import { cx } from './cx';
import { GameTag, UnverifiedTag } from './Tags';
import s from './ui.module.css';

interface Props {
  kind: 'confirmed' | 'leak' | 'plan';
  title: string;
  /** Date range text, always shown on the bar ("12–26 Oct"). */
  range: string;
  /** Position on the timeline, in percent. */
  left: number;
  width: number;
  vent?: string | undefined;
  tag?: { label: string; vent: string } | undefined;
  source?: string | undefined; // required for leaks
}

/** Sits inside a position:relative lane, height 38px. */
export function CalendarBar({ kind, title, range, left, width, vent, tag, source }: Props) {
  const style = { left: `${left}%`, width: `${width}%`, ...(vent ? { '--tag-vent': vent } : {}) } as CSSProperties;
  return (
    <div
      className={cx(s.calBar, kind === 'confirmed' && s.calConfirmed, kind === 'leak' && s.calLeak, kind === 'plan' && s.calPlan)}
      style={style}
    >
      <span>{title}</span>
      <span className={s.calRange}>{range}</span>
      {kind === 'leak' && <UnverifiedTag source={source ?? 'source unknown'} />}
      {tag && <GameTag {...tag} />}
    </div>
  );
}
