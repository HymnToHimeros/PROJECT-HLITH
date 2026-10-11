import { displayFormat } from '../time/displayFormat';
import { formatCountdown, isUrgent, ticksLive } from '../time/format';
import { formatDateTime, formatTime } from '../time/reset';
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

/** "ends in" → "ends", "in" → "on": the words in front of a date instead of a time left. */
const datePrefix = (prefix: string | undefined) => {
  if (!prefix) return '';
  const p = prefix.replace(/\s*in$/, '');
  return p ? `${p} ` : 'on ';
};

/** The moment itself: just the time when it's within a day, else the day and time. */
const when = (to: number, left: number) => (left > 0 && left < 86_400_000 ? formatTime(to) : formatDateTime(to));

export function Timer({ to, deadline = false, prefix, className }: Props) {
  // Tick every second under a day, every minute otherwise; stop once it hits zero.
  const now = useNow((t) => (to - t <= 0 ? null : ticksLive(to - t) ? 1_000 : 60_000));
  const left = to - now;
  // Customise → Time and format → Countdowns: time left (default), the date, or both.
  const style = displayFormat().countdown ?? 'left';
  return (
    <time
      dateTime={new Date(to).toISOString()}
      className={cx(s.timer, deadline && isUrgent(left) && s.urgent, className)}
    >
      {style === 'date' ? (
        `${datePrefix(prefix)}${when(to, left)}`
      ) : (
        <>
          {prefix ? `${prefix} ` : ''}
          {formatCountdown(left)}
          {style === 'both' && ` · ${when(to, left)}`}
        </>
      )}
    </time>
  );
}
