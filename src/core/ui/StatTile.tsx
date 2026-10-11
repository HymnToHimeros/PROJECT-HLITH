import type { ReactNode } from 'react';
import type { Known } from '../contract/known';
import { CountUp } from './CountUp';
import { cx } from './cx';
import { NoData } from './NoData';
import { GameTag } from './Tags';
import s from './ui.module.css';

interface Props {
  label: string;
  value: Known<ReactNode>;
  /** 0–1. Drawn only when the value is known. */
  progress?: number;
  caption?: ReactNode;
  urgent?: boolean;
  tag?: { label: string; vent: string } | undefined;
  onFix?: () => void;
}

export function StatTile({ label, value, progress, caption, urgent = false, tag, onFix }: Props) {
  return (
    <div className={s.statTile}>
      <div className={s.statHead}>
        <span>{label}</span>
        {tag && <GameTag {...tag} />}
      </div>
      {value.known ? (
        <>
          <span className={s.statValue}>
            <CountUp>{value.value}</CountUp>
          </span>
          {progress !== undefined && (
            <div className={s.track} role="progressbar" aria-label={label} aria-valuenow={Math.round(clamp(progress) * 100)} aria-valuemin={0} aria-valuemax={100}>
              <div className={s.fill} style={{ width: `${clamp(progress) * 100}%` }} />
            </div>
          )}
          {caption && <span className={cx(s.caption, urgent && s.urgent)}>{caption}</span>}
        </>
      ) : (
        <>
          <span className={cx(s.statValue, s.dash)} aria-hidden="true">
            —
          </span>
          <NoData dash={false} fix={value.fix} onFix={onFix} />
        </>
      )}
    </div>
  );
}

const clamp = (n: number) => Math.min(1, Math.max(0, n));
