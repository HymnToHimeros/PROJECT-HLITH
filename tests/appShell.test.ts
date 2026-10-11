import { describe, expect, it, vi } from 'vitest';
import { shellFiles, swSource } from '../config/appShell';

const ORIGIN = 'https://hlith.example';

/** Runs the generated service worker against fake caches and network; returns its handlers. */
function boot(files: string[], opts: { old?: Record<string, Record<string, string>>; network?: (url: string) => Response | Promise<Response> } = {}) {
  const stores = new Map<string, Map<string, Response>>(Object.entries(opts.old ?? {}).map(([name, entries]) => [name, new Map(Object.entries(entries).map(([k, v]) => [k, new Response(v)]))]));
  const store = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name) as Map<string, Response>;
    return {
      match: async (key: string) => m.get(key)?.clone(),
      put: async (key: string, res: Response) => void m.set(key, res),
    };
  };
  const caches = {
    open: async (name: string) => store(name),
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async (key: string) => {
      for (const m of stores.values()) if (m.has(key)) return m.get(key)?.clone();
      return undefined;
    },
  };
  const fetched: string[] = [];
  const fetchFn = vi.fn(async (req: string | Request) => {
    const url = typeof req === 'string' ? req : req.url;
    fetched.push(url);
    if (opts.network) return opts.network(url);
    return new Response(`net:${url}`);
  });
  const handlers: Record<string, (e: unknown) => void> = {};
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, fn: (e: unknown) => void) => (handlers[type] = fn),
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn(async () => undefined) },
  };
  new Function('self', 'caches', 'fetch', 'Response', swSource('v2', files))(self, caches, fetchFn, Response);
  const run = async (type: string, extra: object = {}) => {
    let waited: Promise<unknown> | undefined;
    let responded: Promise<Response> | undefined;
    handlers[type]?.({ waitUntil: (p: Promise<unknown>) => (waited = p), respondWith: (p: Promise<Response>) => (responded = p), ...extra });
    await waited;
    return responded;
  };
  return { run, stores, fetched, self };
}

describe('installable app: the service worker (T45)', () => {
  it('keeps only the page and the built files, never maps or the worker itself', () => {
    expect(shellFiles(['index.html', 'assets/index-a1.js', 'assets/index-a1.js.map', 'assets/x.css', 'assets/font.woff2', 'icons/icon-192.png', 'manifest.webmanifest', 'sw.js', 'robots.txt'])).toEqual([
      '/',
      '/assets/font.woff2',
      '/assets/index-a1.js',
      '/assets/x.css',
      '/icons/icon-192.png',
      '/manifest.webmanifest',
    ]);
  });

  it('install: copies unchanged built files from the last version, fetches the rest fresh', async () => {
    const sw = boot(['/', '/assets/a-1.js', '/assets/b-2.js', '/icons/icon-192.png'], { old: { 'hlith-shell-v1': { '/assets/a-1.js': 'old a', '/icons/icon-192.png': 'old icon', '/': 'old page' } } });
    await sw.run('install');
    expect(sw.fetched.sort()).toEqual(['/', '/assets/b-2.js', '/icons/icon-192.png']); // the page and icons always fresh
    expect(await sw.stores.get('hlith-shell-v2')?.get('/assets/a-1.js')?.text()).toBe('old a');
    expect(sw.self.skipWaiting).not.toHaveBeenCalled(); // waits for "Reload"
  });

  it('activate: removes older versions only, never other caches', async () => {
    const sw = boot(['/'], { old: { 'hlith-shell-v1': {}, 'hlith-shell-v2': {}, 'someone-else': {} } });
    await sw.run('activate');
    expect([...sw.stores.keys()].sort()).toEqual(['hlith-shell-v2', 'someone-else']);
  });

  it('takes over only when the app asks (Reload on "Update ready")', async () => {
    const sw = boot(['/']);
    await sw.run('message', { data: 'hello' });
    expect(sw.self.skipWaiting).not.toHaveBeenCalled();
    await sw.run('message', { data: 'skip-waiting' });
    expect(sw.self.skipWaiting).toHaveBeenCalledOnce();
  });

  it('never answers for other sites (Supabase, art) or for anything but GET', async () => {
    const sw = boot(['/', '/assets/a-1.js']);
    const req = (url: string, init: { method?: string; mode?: string } = {}) => ({ request: { url, method: init.method ?? 'GET', mode: init.mode ?? 'cors' } });
    expect(await sw.run('fetch', req('https://qywvnvwfsknfcxgpbivo.supabase.co/rest/v1/user_game_data'))).toBeUndefined();
    expect(await sw.run('fetch', req('https://static.nanoka.cc/hsr/a.webp'))).toBeUndefined();
    expect(await sw.run('fetch', req(`${ORIGIN}/assets/a-1.js`, { method: 'POST' }))).toBeUndefined();
    // Not one of the app's own files: left to the network too.
    expect(await sw.run('fetch', req(`${ORIGIN}/data/other.json`))).toBeUndefined();
  });

  it('pages come from the network; offline, every address opens the kept app', async () => {
    let online = true;
    const sw = boot(['/', '/assets/a-1.js'], { network: (url) => (online ? new Response(`fresh ${url}`) : Promise.reject(new TypeError('offline'))) });
    await sw.run('install');
    const nav = { request: { url: `${ORIGIN}/hsr/roster`, method: 'GET', mode: 'navigate' } };
    expect(await (await sw.run('fetch', nav))?.text()).toBe(`fresh ${ORIGIN}/hsr/roster`);
    online = false;
    expect(await (await sw.run('fetch', nav))?.text()).toBe('fresh /');
    // Built files come from the kept copy, also offline.
    expect(await (await sw.run('fetch', { request: { url: `${ORIGIN}/assets/a-1.js`, method: 'GET', mode: 'cors' } }))?.text()).toBe('fresh /assets/a-1.js');
  });
});
