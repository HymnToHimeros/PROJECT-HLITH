/**
 * After a new release, a tab still open from the old one asks for screen files that no longer
 * exist. The host answers a missing file with the app page (single-page fallback), so the import
 * fails ("Expected a JavaScript module… text/html") and the screen never draws. Vite reports every
 * such failure as `vite:preloadError`: reload once to get the new release. Guarded, so a file that
 * is really broken can't make the page reload forever; then LazyArea shows a card with a Reload button.
 */
const KEY = 'hlith.reloaded-for-update';
const WAIT = 60_000;

export interface StaleChunkDeps {
  now: () => number;
  read: () => string | null;
  write: (v: string) => void;
  reload: () => void;
}

/** Handles one failed load: reloads (and swallows the error) unless it already did so in the last minute. */
export function onStaleChunk(e: Event, deps: StaleChunkDeps): boolean {
  const last = Number(deps.read() ?? 0);
  if (Number.isFinite(last) && deps.now() - last < WAIT) return false; // reloaded just now: let LazyArea show the card
  deps.write(String(deps.now()));
  e.preventDefault();
  deps.reload();
  return true;
}

export function watchStaleChunks(): void {
  const deps: StaleChunkDeps = {
    now: () => Date.now(),
    read: () => {
      try {
        return sessionStorage.getItem(KEY);
      } catch {
        return String(Date.now()); // storage blocked: don't risk a reload loop
      }
    },
    write: (v) => {
      try {
        sessionStorage.setItem(KEY, v);
      } catch {
        /* blocked */
      }
    },
    reload: () => window.location.reload(),
  };
  window.addEventListener('vite:preloadError', (e) => void onStaleChunk(e, deps));
}
