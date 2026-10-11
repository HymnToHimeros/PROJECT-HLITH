/**
 * Reads pull history from HoYoverse's gacha log API, given the history link a
 * player copies from the game. Pure logic shared by the gacha-import server
 * function and the tests; `fetch` is passed in.
 *
 * Safety: only the hosts below are ever contacted, whatever link is pasted.
 * The authkey is used for this one import and never stored.
 */
export const ALLOWED_HOSTS: Record<string, { game: 'hsr' | 'zzz'; typeParam: 'gacha_type' | 'real_gacha_type'; types: string[] }> = {
  'public-operation-hkrpg-sg.hoyoverse.com': { game: 'hsr', typeParam: 'gacha_type', types: ['11', '12', '1', '2'] },
  'public-operation-hkrpg.mihoyo.com': { game: 'hsr', typeParam: 'gacha_type', types: ['11', '12', '1', '2'] },
  'public-operation-nap-sg.hoyoverse.com': { game: 'zzz', typeParam: 'real_gacha_type', types: ['2', '3', '1', '5'] },
  'public-operation-nap.mihoyo.com': { game: 'zzz', typeParam: 'real_gacha_type', types: ['2', '3', '1', '5'] },
};

const PATH = '/common/gacha_record/api/getGachaLog';
// Query parameters copied from the pasted link; nothing else is forwarded.
const KEEP = ['authkey', 'authkey_ver', 'sign_type', 'auth_appid', 'lang', 'game_biz', 'region', 'plat_type'];

export type LinkError = 'not-a-link' | 'unknown-host' | 'no-authkey' | 'expired' | 'blocked' | 'server';

export interface ParsedLink {
  host: string;
  game: 'hsr' | 'zzz';
  params: URLSearchParams;
}

/** Find the history link inside whatever was pasted (often a long line of text). */
export function parseLink(pasted: string): { ok: true; link: ParsedLink } | { ok: false; error: LinkError } {
  const match = pasted.match(/https:\/\/[^\s"'<>]+/g);
  if (!match) return { ok: false, error: 'not-a-link' };
  for (const candidate of match.reverse()) {
    let url: URL;
    try {
      url = new URL(candidate);
    } catch {
      continue;
    }
    const known = ALLOWED_HOSTS[url.hostname];
    // The in-game page link lives on a webview host; its query carries the same authkey.
    const host = known ? url.hostname : hostForGameBiz(url.searchParams.get('game_biz'));
    if (!host) continue;
    const authkey = url.searchParams.get('authkey');
    if (!authkey) return { ok: false, error: 'no-authkey' };
    const params = new URLSearchParams();
    for (const k of KEEP) {
      const v = url.searchParams.get(k);
      if (v !== null) params.set(k, v);
    }
    const game = ALLOWED_HOSTS[host]?.game;
    if (!game) continue;
    return { ok: true, link: { host, game, params } };
  }
  return { ok: false, error: 'unknown-host' };
}

function hostForGameBiz(biz: string | null): string | null {
  if (biz === 'hkrpg_global') return 'public-operation-hkrpg-sg.hoyoverse.com';
  if (biz === 'hkrpg_cn') return 'public-operation-hkrpg.mihoyo.com';
  if (biz === 'nap_global') return 'public-operation-nap-sg.hoyoverse.com';
  if (biz === 'nap_cn') return 'public-operation-nap.mihoyo.com';
  return null;
}

export interface RawPull {
  id: string;
  gacha_type: string;
  item_id: string;
  name: string;
  rank_type: string;
  time: string;
}

export interface LinkResult {
  game: 'hsr' | 'zzz';
  uid: string;
  timezone: number | null;
  list: RawPull[];
}

type Fetch = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

interface ApiPage {
  retcode?: number;
  message?: string;
  data?: { list?: (RawPull & { uid?: string })[]; region_time_zone?: number } | null;
}

/**
 * Read every page of every banner type, newest first, stopping at ids already
 * stored (`stopAtIds`) so re-imports only fetch what's new.
 */
export async function fetchHistory(
  link: ParsedLink,
  fetchFn: Fetch,
  opts: { stopAtIds?: ReadonlySet<string>; pause?: () => Promise<void>; maxPages?: number } = {},
): Promise<{ ok: true; result: LinkResult } | { ok: false; error: LinkError; message?: string }> {
  const cfg = ALLOWED_HOSTS[link.host];
  if (!cfg) return { ok: false, error: 'unknown-host' };
  const list: RawPull[] = [];
  let uid = '';
  let timezone: number | null = null;
  const maxPages = opts.maxPages ?? 500;
  const seen = new Set<string>();

  for (const type of cfg.types) {
    let endId = '0';
    for (let page = 1; page <= maxPages; page++) {
      const q = new URLSearchParams(link.params);
      q.set(cfg.typeParam, type);
      if (cfg.typeParam === 'real_gacha_type') q.set('gacha_type', type);
      q.set('page', String(page));
      q.set('size', '20');
      q.set('end_id', endId);
      // HoYoverse down, or a page that isn't JSON (an error page): a plain "server" error, never a crash.
      let res: Awaited<ReturnType<Fetch>>;
      try {
        res = await fetchFn(`https://${link.host}${PATH}?${q.toString()}`);
      } catch {
        return { ok: false, error: 'server', message: 'could not reach the history server' };
      }
      if (!res.ok) return { ok: false, error: res.status === 429 ? 'blocked' : 'server' };
      let body: ApiPage;
      try {
        body = (await res.json()) as ApiPage;
      } catch {
        return { ok: false, error: 'server', message: 'the history server sent something that isn’t JSON' };
      }
      if (body.retcode === -101 || body.retcode === -100) return { ok: false, error: 'expired' };
      if (body.retcode !== 0) return { ok: false, error: 'server', message: body.message ?? `retcode ${String(body.retcode)}` };
      const rows = body.data?.list ?? [];
      if (body.data?.region_time_zone !== undefined) timezone = body.data.region_time_zone;
      let reachedKnown = false;
      for (const r of rows) {
        // Stop at pulls already stored, or at a pull this import already read
        // (the server repeated itself): never loop, never duplicate.
        if (opts.stopAtIds?.has(r.id) || seen.has(r.id)) {
          reachedKnown = true;
          break;
        }
        seen.add(r.id);
        if (r.uid) uid = r.uid;
        list.push({ id: r.id, gacha_type: r.gacha_type, item_id: r.item_id, name: r.name, rank_type: r.rank_type, time: r.time });
      }
      if (reachedKnown || rows.length < 20) break;
      endId = rows[rows.length - 1]?.id ?? endId;
      await opts.pause?.();
    }
  }
  return { ok: true, result: { game: cfg.game, uid, timezone, list } };
}

export const LINK_ERROR_TEXT: Record<LinkError, string> = {
  'not-a-link': 'No link found. Paste the whole history link from the game.',
  'unknown-host': 'That link isn’t a HoYoverse pull history link.',
  'no-authkey': 'That link is missing its key. Open your pull history in the game again and copy a fresh link.',
  expired: 'That link has expired (they last about a day). Open your pull history in the game again and copy a fresh link.',
  blocked: 'HoYoverse is limiting requests right now. Try again in a few minutes.',
  server: 'HoYoverse’s history server returned an error. Try again later.',
};
