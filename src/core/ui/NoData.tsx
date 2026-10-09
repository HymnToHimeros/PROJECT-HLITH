import { FIX_LABEL, type FixAction } from '../contract/known';
import { Button } from './Button';
import { cx } from './cx';
import s from './ui.module.css';

interface Props {
  fix?: FixAction | undefined;
  onFix?: (() => void) | undefined;
  /** Show the em dash where the number would be. Off when the dash sits elsewhere. */
  dash?: boolean;
  dashClassName?: string;
}

/** A missing value: em dash in line.empty + "No data yet" in glacier + how to fix it. Never a 0. */
export function NoData({ fix, onFix, dash = true, dashClassName }: Props) {
  const fixLabel = fix ? FIX_LABEL[fix] : null;
  return (
    <span className={s.noData}>
      {dash && (
        <span className={cx(s.dash, dashClassName)} aria-hidden="true">
          —
        </span>
      )}
      <span className={s.noDataText}>
        No data yet
        {fixLabel && (
          <>
            {' · '}
            {onFix ? (
              <Button variant="quiet" onClick={onFix}>
                {fixLabel}
              </Button>
            ) : (
              fixLabel
            )}
          </>
        )}
      </span>
    </span>
  );
}
