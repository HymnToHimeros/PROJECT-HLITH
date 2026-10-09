import { useEffect, useRef, useState } from 'react';

type Interval = number | null | ((now: number) => number | null);

/**
 * Current time, refreshed on a timer. `interval` is fixed ms, null to stop,
 * or a function choosing the next delay from the current time (e.g. tick
 * every second under a day, every minute otherwise).
 */
export function useNow(interval: Interval): number {
  const [now, setNow] = useState(() => Date.now());
  const pick = useRef(interval);
  useEffect(() => {
    pick.current = interval;
  });
  useEffect(() => {
    const choose = pick.current;
    const delay = typeof choose === 'function' ? choose(now) : choose;
    if (delay === null) return;
    const id = setTimeout(() => setNow(Date.now()), delay);
    return () => clearTimeout(id);
  }, [now]);
  return now;
}
