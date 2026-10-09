import type { Known } from '../contract/known';
import { formatNumber } from '../time/format';
import { NoData } from './NoData';
import s from './ui.module.css';

interface Props {
  label: string;
  value: Known<{ done: number; total: number }>;
  onFix?: () => void;
}

/** "12/18" with a vent fill. Unknown → "No data yet" and an empty track, never 0/18. */
export function ProgressBar({ label, value, onFix }: Props) {
  const ratio = value.known && value.value.total > 0 ? Math.min(1, value.value.done / value.value.total) : 0;
  return (
    <div className={s.progress}>
      <div className={s.progressHead}>
        <span className={s.progressLabel}>{label}</span>
        {value.known ? (
          <span className={s.progressValue}>
            {formatNumber(value.value.done)}/{formatNumber(value.value.total)}
          </span>
        ) : (
          <NoData dash={false} fix={value.fix} onFix={onFix} />
        )}
      </div>
      <div
        className={s.track}
        role="progressbar"
        aria-label={label}
        {...(value.known ? { 'aria-valuenow': Math.round(ratio * 100), 'aria-valuemin': 0, 'aria-valuemax': 100 } : {})}
      >
        {value.known && <div className={s.fill} style={{ width: `${ratio * 100}%` }} />}
      </div>
    </div>
  );
}
