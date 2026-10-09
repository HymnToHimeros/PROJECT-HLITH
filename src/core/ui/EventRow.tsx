import type { CSSProperties, ReactNode } from 'react';
import { GameTag, UnverifiedTag } from './Tags';
import s from './ui.module.css';

interface Props {
  label: string;
  /** Right side: usually a <Timer>. */
  end?: ReactNode;
  tag?: { label: string; vent: string } | undefined;
  unverified?: { source: string } | undefined;
}

export function EventRow({ label, end, tag, unverified }: Props) {
  return (
    <div className={s.eventRow}>
      <span className={s.eventMark} style={tag ? ({ background: tag.vent } as CSSProperties) : undefined} aria-hidden="true" />
      <span className={s.eventLabel}>{label}</span>
      {unverified && <UnverifiedTag source={unverified.source} />}
      {tag && <GameTag {...tag} />}
      {end}
    </div>
  );
}
