// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { fetchHistory, parseLink, type RawPull } from '../supabase/functions/_shared/hoyoGachaLog';
import { readAccount } from '../src/tools/import/uigf';
import { hsr } from '../src/games/hsr/contract';

const LINK =
  'https://public-operation-hkrpg-sg.hoyoverse.com/common/gacha_record/api/getGachaLog?authkey_ver=1&sign_type=2&auth_appid=webview_gacha&lang=en&game_biz=hkrpg_global&authkey=SECRET%2Bkey&gacha_type=11&page=1&end_id=0&evil=1';

describe('parseLink', () => {
  it('finds the link inside pasted text and keeps only safe parameters', () => {
    const r = parseLink(`Copied to clipboard:\n${LINK}\n`);
    if (!r.ok) throw new Error(r.error);
    expect(r.link.host).toBe('public-operation-hkrpg-sg.hoyoverse.com');
    expect(r.link.game).toBe('hsr');
    expect(r.link.params.get('authkey')).toBe('SECRET+key');
    expect(r.link.params.has('evil')).toBe(false);
    expect(r.link.params.has('gacha_type')).toBe(false);
  });
  it('maps a webview link to the right history host by game_biz', () => {
    const r = parseLink('https://gs.hoyoverse.com/nap/event/e20230424gacha/index.html?authkey=abc&game_biz=nap_global&lang=en');
    expect(r.ok && r.link.host).toBe('public-operation-nap-sg.hoyoverse.com');
  });
  it('never contacts other hosts', () => {
    expect(parseLink('https://evil.example.com/getGachaLog?authkey=abc')).toEqual({ ok: false, error: 'unknown-host' });
    expect(parseLink('no link here')).toEqual({ ok: false, error: 'not-a-link' });
  });
  it('needs the authkey', () => {
    expect(parseLink('https://public-operation-hkrpg-sg.hoyoverse.com/common/gacha_record/api/getGachaLog?lang=en')).toEqual({ ok: false, error: 'no-authkey' });
  });
});

const pull = (id: number, type: string, rank = '3'): RawPull & { uid: string } => ({
  uid: '800000001',
  id: `17000000000000${String(id).padStart(5, '0')}`,
  gacha_type: type,
  item_id: '20000',
  name: `Item ${id}`,
  rank_type: rank,
  time: '2026-10-01 12:00:00',
});

function fakeServer(byType: Record<string, ReturnType<typeof pull>[]>, retcode = 0) {
  const calls: string[] = [];
  const fetchFn = async (url: string) => {
    calls.push(url);
    const u = new URL(url);
    const type = u.searchParams.get('gacha_type') ?? '';
    const endId = u.searchParams.get('end_id') ?? '0';
    const all = (byType[type] ?? []).slice().sort((a, b) => b.id.localeCompare(a.id)); // newest first
    const start = endId === '0' ? 0 : all.findIndex((p) => p.id === endId) + 1;
    return { ok: true, status: 200, json: async () => ({ retcode, message: 'x', data: { list: all.slice(start, start + 20), region_time_zone: 1 } }) };
  };
  return { fetchFn, calls };
}

describe('fetchHistory', () => {
  const parsed = parseLink(LINK);
  if (!parsed.ok) throw new Error('bad test link');

  it('reads every page of every banner type', async () => {
    const server = fakeServer({ '11': Array.from({ length: 45 }, (_, i) => pull(i, '11')), '1': [pull(100, '1', '5')] });
    const r = await fetchHistory(parsed.link, server.fetchFn);
    if (!r.ok) throw new Error(r.error);
    expect(r.result.list).toHaveLength(46);
    expect(r.result.uid).toBe('800000001');
    expect(r.result.timezone).toBe(1);
    expect(server.calls.every((c) => c.startsWith('https://public-operation-hkrpg-sg.hoyoverse.com/'))).toBe(true);
  });

  it('stops at pulls already stored, so re-imports only fetch what is new', async () => {
    const rows = Array.from({ length: 45 }, (_, i) => pull(i, '11'));
    const server = fakeServer({ '11': rows });
    const known = new Set(rows.slice(0, 40).map((p) => p.id)); // oldest 40 stored
    const r = await fetchHistory(parsed.link, server.fetchFn, { stopAtIds: known });
    if (!r.ok) throw new Error(r.error);
    expect(r.result.list.map((p) => p.id)).toEqual(rows.slice(40).reverse().map((p) => p.id));
    expect(server.calls.filter((c) => c.includes('gacha_type=11'))).toHaveLength(1);
  });

  it('stops if the server repeats a page instead of looping', async () => {
    const stuck = async () => ({ ok: true, status: 200, json: async () => ({ retcode: 0, data: { list: Array.from({ length: 20 }, (_, i) => pull(i, '11')) } }) });
    const r = await fetchHistory(parsed.link, stuck);
    if (!r.ok) throw new Error(r.error);
    // Pull ids are unique across a game's banners, so the 20 repeated pulls are read once.
    expect(r.result.list).toHaveLength(20);
  });

  it('says plainly when the link expired', async () => {
    const r = await fetchHistory(parsed.link, fakeServer({}, -101).fetchFn);
    expect(r).toEqual({ ok: false, error: 'expired' });
  });

  it('the rows map onto HSR banners with the same reader as files', async () => {
    const server = fakeServer({ '11': [pull(1, '11', '5')], '12': [pull(2, '12', '4')] });
    const r = await fetchHistory(parsed.link, server.fetchFn);
    if (!r.ok || !hsr.historyMapping) throw new Error('setup');
    const acc = readAccount(r.result.uid, r.result.list, r.result.timezone ?? 8, hsr.historyMapping);
    expect(acc.records.map((p) => [p.bannerType, p.rarity, p.time])).toEqual([
      ['character', 'top', '2026-10-01T11:00:00.000Z'],
      ['light-cone', 'mid', '2026-10-01T11:00:00.000Z'],
    ]);
  });
});
