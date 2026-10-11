import { useEffect, useState, type ReactNode } from 'react';

const NUMBER = /^(\d{1,3}(?:[,\u202f\u00a0 ]\d{3})*|\d+)$/;

/**
 * A whole number that ticks up to its value when it first appears (T50), like "1,240" counting up.
 * Only with Animations on (<html data-motion="on">); otherwise, and for anything that isn't a plain
 * whole number, the value shows as it is. The real value is always there for screen readers.
 */
export function CountUp({ children, ms = 600 }: { children: ReactNode; ms?: number }) {
  const text = typeof children === 'number' ? String(children) : typeof children === 'string' ? children : null;
  const match = text !== null && NUMBER.test(text.trim());
  const target = match ? Number(text.replace(/\D/g, '')) : 0;
  const animate = match && target > 0 && typeof document !== 'undefined' && document.documentElement.dataset.motion === 'on' && typeof requestAnimationFrame === 'function';
  const [shown, setShown] = useState<number | null>(animate ? 0 : null);
  useEffect(() => {
    if (!animate) return;
    let raf = 0;
    const start = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      setShown(Math.round(target * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
      else setShown(null);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [animate, target, ms]);
  if (shown === null || text === null) return <>{children}</>;
  // Same thousands separator as the real value.
  const sep = /\d([^\d])\d{3}$/.exec(text.trim())?.[1] ?? '';
  const ticking = String(shown).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return (
    <>
      <span aria-hidden="true">{ticking}</span>
      <span className="visually-hidden">{children}</span>
    </>
  );
}
