import { formatCountdown, isUrgent, ticksLive } from '../time/format';
import { cx } from './cx';
import s from './ui.module.css';
import { useNow } from './useNow';

interface Props {
  /** Epoch ms of the moment counted down to. */
  to: number;
  /** Deadline (something ends): turns ember.soft under 72 h. Off for things that start. */
  deadline?: boolean;
  prefix?: string;
  className?: string;
}

export function Timer({ to, deadline = false, prefix, className }: Props) {
  // Tick every second under a day, every minute otherwise; stop once it hits zero.
  const now = useNow((t) => (to - t <= 0 ? null : ticksLive(to - t) ? 1_000 : 60_000));
  const left = to - now;
  return (
    <time
      dateTime={new Date(to).toISOString()}
      className={cx(s.timer, deadline && isUrgent(left) && s.urgent, className)}
    >
      {prefix ? `${prefix} ` : ''}
      {formatCountdown(left)}
    </time>
  );
}
