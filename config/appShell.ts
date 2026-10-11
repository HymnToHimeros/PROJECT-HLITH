import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';

/**
 * Installable app (T45): writes /sw.js into the build, the service worker that keeps the app's
 * own files (the page, scripts, styles, fonts, icons) so the app opens without a connection.
 *
 * Only this site's own built files are kept. Requests to anything else (Supabase, HoYoLAB, the
 * game art sites) are never touched, so no account's data is ever stored by it; your saved data
 * stays where it already is (this device's storage, synced to your account).
 *
 * Updates: a new deploy gives a new sw.js (its version is a hash of the file list). It installs in
 * the background and waits; the app shows "Update ready" and reloads when you tap it. It never
 * takes over on its own, and the page itself always comes from the network when there is one,
 * so the app can't get stuck on an old version.
 */
export function swSource(version: string, files: string[]): string {
  return `// HLITH service worker (generated at build time by config/appShell.ts; do not edit).
const VERSION = ${JSON.stringify(version)};
const CACHE = 'hlith-shell-' + VERSION;
const SHELL = ${JSON.stringify(files)};
const KEEP = new Set(SHELL);

self.addEventListener('install', (event) => {
  // Built files (/assets/…) have a hash in their name and never change: copy them from the last
  // version instead of downloading them again. Everything else is fetched fresh.
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        SHELL.map(async (path) => {
          const old = path.startsWith('/assets/') ? await caches.match(path) : undefined;
          if (old) return cache.put(path, old);
          const res = await fetch(path, { cache: 'reload' });
          if (!res.ok) throw new Error(path + ' answered ' + res.status);
          return cache.put(path, res);
        }),
      ),
    ),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('hlith-shell-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// The app asks for this when you tap "Reload" on "Update ready".
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Anything not from this site (Supabase, art, HoYoLAB) goes straight to the network.
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // Every address is the app's one page: fresh from the network, the kept copy when offline.
    event.respondWith(fetch(req).catch(() => caches.open(CACHE).then((c) => c.match('/')).then((r) => r || Response.error())));
    return;
  }
  if (KEEP.has(url.pathname)) {
    event.respondWith(caches.open(CACHE).then((c) => c.match(url.pathname)).then((r) => r || fetch(req)));
  }
});
`;
}

/** Which built files the worker keeps: the page and everything it loads, never maps or the worker itself. */
export const shellFiles = (names: string[]): string[] =>
  ['/', ...names.filter((n) => /\.(js|css|woff2|png|svg|webmanifest)$/.test(n) && !n.endsWith('.map') && n !== 'sw.js').map((n) => `/${n}`)].sort();

export function appShell(): Plugin {
  let publicFiles: string[] = [];
  let publicHash = '';
  return {
    name: 'hlith-app-shell',
    apply: 'build',
    async configResolved(config) {
      // Files from public/ (icons, manifest) are copied as they are; list them too.
      const { readdirSync, readFileSync, statSync } = await import('node:fs');
      const { join, relative } = await import('node:path');
      const walk = (dir: string): string[] =>
        readdirSync(dir).flatMap((n) => {
          const p = join(dir, n);
          return statSync(p).isDirectory() ? walk(p) : [relative(config.publicDir, p).split('\\').join('/')];
        });
      try {
        publicFiles = config.publicDir ? walk(config.publicDir) : [];
        // Their names don't change with their content, so their content goes into the version.
        const h = createHash('sha256');
        for (const n of publicFiles.sort()) h.update(n).update(readFileSync(join(config.publicDir, n)));
        publicHash = h.digest('hex');
      } catch {
        publicFiles = [];
      }
    },
    generateBundle(_options, bundle) {
      const files = shellFiles([...Object.keys(bundle), ...publicFiles]);
      const version = createHash('sha256').update(files.join('\n')).update(publicHash).digest('hex').slice(0, 12);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: swSource(version, files) });
    },
  };
}
