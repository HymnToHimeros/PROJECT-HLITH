import type { Known } from '../contract/known';
import { formatNumber } from '../time/format';
import { NoData } from './NoData';
import s from './ui.module.css';

export function CurrencyChip({ name, amount }: { name: string; amount: Known<number> }) {
  return (
    <span className={s.chip}>
      <span className={s.chipDot} aria-hidden="true" />
      {name}
      {amount.known ? <span className={s.chipAmount}>{formatNumber(amount.value)}</span> : <NoData dash={false} />}
    </span>
  );
}
