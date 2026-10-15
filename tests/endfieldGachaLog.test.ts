// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { fetchHistory, parseLink } from '../supabase/functions/_shared/endfieldGachaLog';
import { readAccount } from '../src/tools/import/uigf';
import { endfield } from '../src/games/endfield/contract';

const LINK = 'https://ef-webview.gryphline.com/gacha?u8_token=abc123&server_id=terra1&lang=en';

describe('parseLink', () => {
  it('finds the link inside pasted text', () => {
    const r = parseLink(`Found in log:\n${LINK}\nother stuff`);
    if (!r.ok) throw new Error(r.error);
    expect(r.link.host).toBe('ef-webview.gryphline.com');
    expect(r.link.region).toBe('global');
    expect(r.link.token).toBe('abc123');
    expect(r.link.serverId).toBe('terra1');
  });

  it('accepts the CN host', () => {
    const r = parseLink('https://ef-webview.hypergryph.com/gacha?token=xyz&server_id=1');
    if (!r.ok) throw new Error(r.error);
    expect(r.link.region).toBe('cn');
    expect(r.link.token).toBe('xyz');
  });

  it('never contacts other hosts', () => {
    expect(parseLink('https://evil.example.com/gacha?u8_token=abc')).toEqual({ ok: false, error: 'not-a-link' });
    expect(parseLink('no link here')).toEqual({ ok: false, error: 'not-a-link' });
  });

  it('rejects unknown Endfield hosts', () => {
    expect(parseLink('https://ef-webview.unknown.com/gacha?u8_token=abc')).toEqual({ ok: false, error: 'unknown-host' });
  });

  it('needs a token', () => {
    expect(parseLink('https://ef-webview.gryphline.com/gacha?server_id=terra1')).toEqual({ ok: false, error: 'no-token' });
  });
});

interface FakeRecord {
  seqId: string;
  charId?: string;
  charName?: string;
  weaponId?: string;
  weaponName?: string;
  rarity: number;
  gachaTs: string;
  poolType?: string;
  poolId?: string;
  isFree?: boolean;
  kind?: string;
}

function charRecord(id: number, rarity = 4, poolType = 'E_CharacterGachaPoolType_Special'): FakeRecord {
  return {
    seqId: String(1000 + id),
    charId: `char_${id}`,
    charName: `Operator ${id}`,
    rarity,
    gachaTs: '2026-10-01 12:00:00',
    poolType,
  };
}

function weaponRecord(id: number, rarity = 4, poolType = 'special'): FakeRecord {
  return {
    seqId: String(2000 + id),
    weaponId: `wpn_${id}`,
    weaponName: `Weapon ${id}`,
    rarity,
    gachaTs: '2026-10-01 12:00:00',
    poolType,
    poolId: `pool_${poolType}`,
  };
}

function fakeServer(charsByPool: Record<string, FakeRecord[]>, weaponPools: { poolId: string; poolType: string }[], weaponsByPool: Record<string, FakeRecord[]> = {}) {
  const calls: string[] = [];
  const fetchFn = async (url: string) => {
    calls.push(url);
    const u = new URL(url);
    const path = u.pathname;

    if (path === '/api/record/weapon/pool') {
      return { ok: true, status: 200, json: async () => ({ code: 0, data: weaponPools }) };
    }

    if (path === '/api/record/weapon') {
      const poolId = u.searchParams.get('pool_id') ?? '';
      const seqId = u.searchParams.get('seq_id') ?? '';
      const all = (weaponsByPool[poolId] ?? []).slice().sort((a, b) => b.seqId.localeCompare(a.seqId));
      const start = seqId ? all.findIndex((r) => r.seqId === seqId) + 1 : 0;
      const page = all.slice(start, start + 20);
      return { ok: true, status: 200, json: async () => ({ code: 0, data: { list: page, hasMore: start + 20 < all.length } }) };
    }

    if (path === '/api/record/char') {
      const poolType = u.searchParams.get('pool_type') ?? '';
      const seqId = u.searchParams.get('seq_id') ?? '';
      const all = (charsByPool[poolType] ?? []).slice().sort((a, b) => b.seqId.localeCompare(a.seqId));
      const start = seqId ? all.findIndex((r) => r.seqId === seqId) + 1 : 0;
      const page = all.slice(start, start + 20);
      return { ok: true, status: 200, json: async () => ({ code: 0, data: { list: page, hasMore: start + 20 < all.length } }) };
    }

    return { ok: false, status: 404, json: async () => ({ code: 404 }) };
  };
  return { fetchFn, calls };
}

describe('fetchHistory', () => {
  const parsed = parseLink(LINK);
  if (!parsed.ok) throw new Error('bad test link');

  it('reads character pulls from all pool types', async () => {
    const chars: Record<string, FakeRecord[]> = {
      E_CharacterGachaPoolType_Special: Array.from({ length: 3 }, (_, i) => charRecord(i, 5, 'E_CharacterGachaPoolType_Special')),
      E_CharacterGachaPoolType_Standard: [charRecord(10, 4, 'E_CharacterGachaPoolType_Standard')],
    };
    const server = fakeServer(chars, []);
    const r = await fetchHistory(parsed.link, server.fetchFn, { pause: async () => {} });
    if (!r.ok) throw new Error(r.error);
    expect(r.result.list).toHaveLength(4);
    expect(r.result.game).toBe('endfield');
  });

  it('reads weapon pulls from discovered pools', async () => {
    const pools = [{ poolId: 'pool_special', poolType: 'special' }];
    const wpns: Record<string, FakeRecord[]> = {
      pool_special: [weaponRecord(1, 6, 'special'), weaponRecord(2, 5, 'special')],
    };
    const server = fakeServer({}, pools, wpns);
    const r = await fetchHistory(parsed.link, server.fetchFn, { pause: async () => {} });
    if (!r.ok) throw new Error(r.error);
    expect(r.result.list).toHaveLength(2);
    const first = r.result.list[0];
    expect(first && first.gacha_type).toBe('weapon-limited');
  });

  it('stops at known ids', async () => {
    const chars: Record<string, FakeRecord[]> = {
      E_CharacterGachaPoolType_Special: Array.from({ length: 10 }, (_, i) => charRecord(i)),
    };
    const server = fakeServer(chars, []);
    const known = new Set(['1005', '1006', '1007']);
    const r = await fetchHistory(parsed.link, server.fetchFn, { stopAtIds: known, pause: async () => {} });
    if (!r.ok) throw new Error(r.error);
    // Should have pulled only the ones newer than 1005 (seqIds 1008, 1009 — newest-first order, stop when hitting 1007 in known)
    expect(r.result.list.every((p) => !known.has(p.id))).toBe(true);
  });

  it('filters out free pulls and gift items', async () => {
    const chars: Record<string, FakeRecord[]> = {
      E_CharacterGachaPoolType_Special: [
        charRecord(1),
        { ...charRecord(2), isFree: true },
        { ...charRecord(3), kind: 'gift_reward' },
      ],
    };
    const server = fakeServer(chars, []);
    const r = await fetchHistory(parsed.link, server.fetchFn, { pause: async () => {} });
    if (!r.ok) throw new Error(r.error);
    expect(r.result.list).toHaveLength(1);
    const only = r.result.list[0];
    expect(only && only.id).toBe('1001');
  });

  it('says plainly when the token expired', async () => {
    const fetchFn = async () => ({ ok: true, status: 200, json: async () => ({ code: 401 }) });
    const r = await fetchHistory(parsed.link, fetchFn, { pause: async () => {} });
    expect(r).toMatchObject({ ok: false, error: 'expired' });
  });

  it('results sort oldest-first by seqId', async () => {
    const chars: Record<string, FakeRecord[]> = {
      E_CharacterGachaPoolType_Special: [charRecord(5), charRecord(2), charRecord(8)],
    };
    const server = fakeServer(chars, []);
    const r = await fetchHistory(parsed.link, server.fetchFn, { pause: async () => {} });
    if (!r.ok) throw new Error(r.error);
    const ids = r.result.list.map((p) => p.id);
    expect(ids).toEqual(['1002', '1005', '1008']);
  });

  it('maps onto Endfield banners with readAccount', async () => {
    const chars: Record<string, FakeRecord[]> = {
      E_CharacterGachaPoolType_Special: [charRecord(1, 6)],
      E_CharacterGachaPoolType_Standard: [charRecord(2, 5)],
    };
    const pools = [{ poolId: 'pool_special', poolType: 'special' }];
    const wpns: Record<string, FakeRecord[]> = {
      pool_special: [weaponRecord(1, 6)],
    };
    const server = fakeServer(chars, pools, wpns);
    const r = await fetchHistory(parsed.link, server.fetchFn, { pause: async () => {} });
    if (!r.ok || !endfield.historyMapping) throw new Error('setup');
    const acc = readAccount('', r.result.list, 8, endfield.historyMapping);
    const types = acc.records.map((p) => [p.bannerType, p.rarity]);
    expect(types).toContainEqual(['chartered', 'top']);
    expect(types).toContainEqual(['basic', 'mid']);
    expect(types).toContainEqual(['weapon', 'top']);
  });
});
