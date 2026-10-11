import { useSyncExternalStore } from 'react';

/**
 * The installable app (T45), app side: registers the service worker (/sw.js, written at build time
 * by config/appShell.ts), and tells screens whether the device is offline, whether a new version is
 * waiting ("Update ready"), whether the app is already installed, and holds the browser's install
 * offer (Android / desktop Chrome) for the "Install app" button.
 */
export interface AppShellState {
  online: boolean;
  /** A new version is downloaded and waits for a reload. */
  updateReady: boolean;
  /** Opened from the home screen / as an installed app, not in a browser tab. */
  installed: boolean;
  /** The browser offers its own install dialog (Chrome, Edge); not on iPhone. */
  canPrompt: boolean;
}

/** The browser's install offer (not in the DOM typings yet). */
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const standalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

let state: AppShellState = {
  online: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  updateReady: false,
  installed: standalone(),
  canPrompt: false,
};
let waiting: ServiceWorker | null = null;
let offer: InstallPrompt | null = null;
const listeners = new Set<() => void>();

function set(patch: Partial<AppShellState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export const appShellState = () => state;
export const subscribeAppShell = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const useAppShell = () => useSyncExternalStore(subscribeAppShell, appShellState, appShellState);

/** Tap "Reload" on "Update ready": the waiting version takes over and the page reloads once. */
export function applyUpdate(): void {
  if (waiting) waiting.postMessage('skip-waiting');
  else window.location.reload();
}

/** Opens the browser's own install dialog, where there is one. True when the app was installed. */
export async function promptInstall(): Promise<boolean> {
  if (!offer) return false;
  const p = offer;
  offer = null;
  set({ canPrompt: false });
  await p.prompt();
  return (await p.userChoice).outcome === 'accepted';
}

/** For tests: start again from a given state. */
export function resetAppShell(patch: Partial<AppShellState> = {}): void {
  waiting = null;
  offer = null;
  state = { online: true, updateReady: false, installed: false, canPrompt: false, ...patch };
  listeners.forEach((l) => l());
}

let started = false;

/**
 * Called once at start-up. Online/offline and the install offer are watched everywhere; the
 * service worker is registered only in the built app (never in development or tests).
 */
export function startAppShell(opts: { register: boolean } = { register: import.meta.env.PROD }): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('online', () => set({ online: true }));
  window.addEventListener('offline', () => set({ online: false }));
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // our own button and steps (Account → Install app) instead of the mini bar
    offer = e as InstallPrompt;
    set({ canPrompt: true });
  });
  window.addEventListener('appinstalled', () => {
    offer = null;
    set({ installed: true, canPrompt: false });
  });
  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', () => set({ installed: standalone() }));

  if (!opts.register || !('serviceWorker' in navigator)) return;
  const sw = navigator.serviceWorker;
  // The new version took over (after "Reload"): load the page once with it.
  let reloading = false;
  const hadController = Boolean(sw.controller);
  sw.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return; // first install: nothing to reload
    reloading = true;
    window.location.reload();
  });
  void sw
    .register('/sw.js')
    .then((reg) => {
      const offerUpdate = (w: ServiceWorker | null) => {
        if (!w || !sw.controller) return; // no old version running: this is the first install
        waiting = w;
        set({ updateReady: true });
      };
      offerUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed') offerUpdate(w);
        });
      });
      // Look for a new version when the app comes back to the front, and every hour while open.
      const check = () => void reg.update().catch(() => undefined);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
      window.setInterval(check, 60 * 60 * 1000);
    })
    .catch(() => undefined); // no worker (private mode, old browser): the site still works as before
}
