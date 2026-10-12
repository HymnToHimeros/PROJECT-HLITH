import { lazy, Suspense } from 'react';

/**
 * The owner's look (T64), loaded only when it shows. Until the drawings arrive, the plain
 * version shows in their place (the original badge, the normal frame, the plain name).
 */
const art = () => import('./OwnerArt');
const LazyBadge = lazy(() => art().then((m) => ({ default: m.OwnerBadge })));
const LazyFrame = lazy(() => art().then((m) => ({ default: m.OwnerFrame })));
const LazyName = lazy(() => art().then((m) => ({ default: m.OwnerName })));

export function OwnerBadgeArt(props: { n: number; size: number; title?: string | undefined; fallback: React.ReactNode }) {
  const { fallback, ...rest } = props;
  return (
    <Suspense fallback={fallback}>
      <LazyBadge {...rest} />
    </Suspense>
  );
}

export function OwnerFrameArt(props: { n: number; variant?: number; src: string | null; letter: string; size: number; fallback: React.ReactNode }) {
  const { fallback, ...rest } = props;
  return (
    <Suspense fallback={fallback}>
      <LazyFrame {...rest} />
    </Suspense>
  );
}

export function OwnerNameArt({ n, text }: { n: number; text: string }) {
  return (
    <Suspense fallback={text}>
      <LazyName n={n} text={text} />
    </Suspense>
  );
}
