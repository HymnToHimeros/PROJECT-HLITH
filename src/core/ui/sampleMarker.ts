/**
 * Is example data on screen right now? Every <ExampleNotice> counts itself in,
 * and the shell shows the design's SAMPLE DATA marker in the header while any is
 * mounted. Screens don't have to do anything else.
 */
import { useEffect, useSyncExternalStore } from 'react';

let count = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function useMarkSample(on = true): void {
  useEffect(() => {
    if (!on) return;
    count += 1;
    notify();
    return () => {
      count -= 1;
      notify();
    };
  }, [on]);
}

export function useSampleShown(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => count > 0,
    () => false,
  );
}
