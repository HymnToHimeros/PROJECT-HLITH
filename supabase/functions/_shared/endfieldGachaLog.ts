/**
 * Reads pull history from Endfield's gacha record API, given the history link
 * from the game's webview (HGWebview.log on PC) or a u8_token obtained through
 * web sign-in. Pure logic shared by the endfield-gacha-import server function
 * and tests; `fetch` is passed in.
 *
 * Safety: only the hosts below are ever contacted, whatever link is pasted.
 * The token is used for this one import and never stored.
 *
 * Reference: bhaoo/endfield-gacha (MIT, v0.7.0).
 */

export const ALLOWED_HOSTS: Record<string, 'global' | 'cn'> = {
  'ef-webview.gryphline.com': 'global',
  'ef-webview.hypergryph.com': 'cn',
};

const CHAR_POOL_TYPES = [
  'E_CharacterGachaPoolType_Special',
  'E_CharacterGachaPoolType_Rerun',
  'E_CharacterGachaPoolType_Joint',
  'E_CharacterGachaPoolType_Standard',
  'E_CharacterGachaPoolType_Beginner',
] as const;

export type LinkError = 'not-a-link' | 'unknown-host' | 'no-token' | 'expired' | 'blocked' | 'server';

export interface ParsedLink {
  host: string;
  region: 'global' | 'cn';
  token: string;
  serverId: string;
}

export function parseLink(pasted: string): { ok: true; link: ParsedLink } | { ok: false; error: LinkError } {
  const match = pasted.match(/https:\/\/ef-webview\.[^\s"'<>]+/g);
  if (!match) return { ok: false, error: 'not-a-link' };
  for (let i = match.length - 1; i >= 0; i--) {
    let url: URL;
    try {
      const raw = match[i];
      if (!raw) continue;
      url = new URL(raw);
    } catch {
      continue;
    }
    const region = ALLOWED_HOSTS[url.hostname];
    if (!region) continue;
    const token = url.searchParams.get('u8_token') ?? url.searchParams.get('token');
    if (!token) return { ok: false, error: 'no-token' };
    const serverId = url.searchParams.get('server_id') ?? url.searchParams.get('serverId') ?? url.searchParams.get('server') ?? (region === 'cn' ? '1' : '');
    if (!serverId) return { ok: false, error: 'no-token' };
    return { ok: true, link: { host: url.hostname, region, token, serverId } };
  }
  return { ok: false, error: 'unknown-host' };
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
  game: 'endfield';
  uid: string;
  timezone: number | null;
  list: RawPull[];
}

type Fetch = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

interface ApiResponse {
  code?: number;
  msg?: string;
  data?: { list?: EndFieldRecord[]; hasMore?: boolean } | null;
}

interface EndFieldRecord {
  seqId?: string;
  charId?: string;
  charName?: string;
  weaponId?: string;
  weaponName?: string;
  rarity?: number;
  gachaTs?: string;
  isFree?: boolean;
  kind?: string;
  poolId?: string;
  poolName?: string;
  poolType?: string;
}

interface WeaponPool {
  poolId: string;
  poolName?: string;
  poolType?: string;
  online?: boolean;
}

function rarityString(r: number | undefined): string {
  if (r === 6) return '6';
  if (r === 5) return '5';
  if (r === 4) return '4';
  if (r === 3) return '3';
  return String(r ?? 0);
}

// Weapon pool types ('special', 'constant', 'rerun') from bhaoo/endfield-gacha; not yet verified against a live account.
function poolTypeToGachaType(poolType: string): string {
  if (poolType === 'E_CharacterGachaPoolType_Special') return 'chartered';
  if (poolType === 'E_CharacterGachaPoolType_Rerun') return 'rerun';
  if (poolType === 'E_CharacterGachaPoolType_Joint') return 'joint';
  if (poolType === 'E_CharacterGachaPoolType_Standard') return 'basic';
  if (poolType === 'E_CharacterGachaPoolType_Beginner') return 'beginner';
  if (poolType === 'special') return 'weapon-limited';
  if (poolType === 'constant') return 'weapon-constant';
  if (poolType === 'rerun') return 'weapon-rerun';
  return poolType;
}

function toRawPull(r: EndFieldRecord, gachaType: string): RawPull | null {
  const id = r.seqId;
  if (!id) return null;
  if (r.isFree || r.kind?.startsWith('gift')) return null;
  const itemId = r.charId ?? r.weaponId ?? '';
  const name = r.charName ?? r.weaponName ?? '';
  if (!name) return null;
  return {
    id,
    gacha_type: gachaType,
    item_id: itemId,
    name,
    rank_type: rarityString(r.rarity),
    time: r.gachaTs ?? '',
  };
}

export async function fetchHistory(
  link: ParsedLink,
  fetchFn: Fetch,
  opts: { stopAtIds?: ReadonlySet<string>; pause?: () => Promise<void>; maxPages?: number } = {},
): Promise<{ ok: true; result: LinkResult } | { ok: false; error: LinkError; message?: string }> {
  const list: RawPull[] = [];
  const seen = new Set<string>();
  const maxPages = opts.maxPages ?? 500;

  const base = `https://${link.host}`;
  const q = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ token: link.token, server_id: link.serverId, lang: 'en' });
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    return p.toString();
  };

  const fetchPage = async (path: string, extra: Record<string, string>): Promise<ApiResponse | { error: LinkError; message?: string }> => {
    let res: Awaited<ReturnType<Fetch>>;
    try {
      res = await fetchFn(`${base}${path}?${q(extra)}`);
    } catch {
      return { error: 'server', message: 'could not reach the Endfield history server' };
    }
    if (!res.ok) return { error: res.status === 429 ? 'blocked' : 'server' };
    let body: ApiResponse;
    try {
      body = (await res.json()) as ApiResponse;
    } catch {
      return { error: 'server', message: "the history server sent something that isn't JSON" };
    }
    if (body.code === 401 || body.code === -1) return { error: 'expired' };
    if (body.code !== 0 && body.code !== undefined) return { error: 'server', message: body.msg ?? `code ${String(body.code)}` };
    return body;
  };

  // --- Character pools ---
  for (const poolType of CHAR_POOL_TYPES) {
    let seqId = '';
    for (let page = 0; page < maxPages; page++) {
      const extra: Record<string, string> = { pool_type: poolType };
      if (seqId) extra.seq_id = seqId;
      const resp = await fetchPage('/api/record/char', extra);
      if ('error' in resp) return { ok: false, ...resp };
      const rows = resp.data?.list ?? [];
      let reachedKnown = false;
      for (const r of rows) {
        const pull = toRawPull(r, poolTypeToGachaType(poolType));
        if (!pull) continue;
        if (opts.stopAtIds?.has(pull.id) || seen.has(pull.id)) {
          reachedKnown = true;
          break;
        }
        seen.add(pull.id);
        list.push(pull);
      }
      if (reachedKnown || !resp.data?.hasMore || rows.length === 0) break;
      seqId = rows[rows.length - 1]?.seqId ?? '';
      if (!seqId) break;
      await opts.pause?.();
    }
  }

  // --- Weapon pools ---
  const wpResp = await fetchPage('/api/record/weapon/pool', {});
  if ('error' in wpResp) return { ok: false, ...wpResp };
  const weaponPools: WeaponPool[] = Array.isArray(wpResp.data) ? (wpResp.data as WeaponPool[]) : [];
  for (const wp of weaponPools) {
    if (!wp.poolId) continue;
    const gachaType = poolTypeToGachaType(wp.poolType ?? 'weapon');
    let seqId = '';
    for (let page = 0; page < maxPages; page++) {
      const extra: Record<string, string> = { pool_id: wp.poolId };
      if (seqId) extra.seq_id = seqId;
      const resp = await fetchPage('/api/record/weapon', extra);
      if ('error' in resp) return { ok: false, ...resp };
      const rows = resp.data?.list ?? [];
      let reachedKnown = false;
      for (const r of rows) {
        const pull = toRawPull(r, gachaType);
        if (!pull) continue;
        if (opts.stopAtIds?.has(pull.id) || seen.has(pull.id)) {
          reachedKnown = true;
          break;
        }
        seen.add(pull.id);
        list.push(pull);
      }
      if (reachedKnown || !resp.data?.hasMore || rows.length === 0) break;
      seqId = rows[rows.length - 1]?.seqId ?? '';
      if (!seqId) break;
      await opts.pause?.();
    }
  }

  // Sort by seqId (numeric string comparison) so oldest is first
  list.sort((a, b) => {
    if (a.id.length !== b.id.length) return a.id.length - b.id.length;
    return a.id.localeCompare(b.id);
  });

  return { ok: true, result: { game: 'endfield', uid: '', timezone: null, list } };
}

export const LINK_ERROR_TEXT: Record<LinkError, string> = {
  'not-a-link': 'No Endfield history link found. Paste the whole URL from HGWebview.log.',
  'unknown-host': "That link isn't an Endfield webview URL.",
  'no-token': "That link is missing its token. Open your pull history in the game and copy the link from HGWebview.log again.",
  expired: "That token has expired (they last about a day). Open your pull history in the game again and copy a fresh link.",
  blocked: 'The Endfield server is limiting requests right now. Try again in a few minutes.',
  server: 'The Endfield history server returned an error. Try again later.',
};
