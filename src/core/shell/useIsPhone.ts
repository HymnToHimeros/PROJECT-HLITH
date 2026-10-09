import { useSyncExternalStore } from 'react';

/** Phone layout below 820 px (DESIGN §3). Without matchMedia (tests, old browsers) it's the PC layout. */
const QUERY = '(max-width: 819px)';

const mq = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(QUERY) : null);

export function useIsPhone(): boolean {
  return useSyncExternalStore(
    (l) => {
      const m = mq();
      m?.addEventListener('change', l);
      return () => m?.removeEventListener('change', l);
    },
    () => mq()?.matches ?? false,
    () => false,
  );
}
