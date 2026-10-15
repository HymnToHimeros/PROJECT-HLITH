import { Component, Suspense, type ReactNode } from 'react';
import s from './shell.module.css';

/**
 * A screen or panel loaded on demand: "Loading…" while it comes, and a plain card instead of a
 * blank page when it fails (usually a new release came out while this tab was open). Changing
 * `resetKey` (another screen) tries again.
 */
export function LazyArea({ resetKey, children }: { resetKey?: string; children: ReactNode }) {
  return (
    <LoadBoundary key={resetKey}>
      <Suspense fallback={<p className={s.note}>Loading…</p>}>{children}</Suspense>
    </LoadBoundary>
  );
}

class LoadBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className={s.placeholder} role="alert">
        <strong>This part of HLITH didn’t load.</strong>
        <p>Usually a new version just came out. Reload to get it; nothing you saved is lost.</p>
        <button type="button" className={s.sheetRow} onClick={() => window.location.reload()}>
          Reload
        </button>
      </section>
    );
  }
}
