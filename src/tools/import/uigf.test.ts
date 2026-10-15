import { describe, expect, it } from 'vitest';
import type { HistoryMapping } from '../../core/contract';
import { mergePulls, parseHistoryFile, serverTimeToUtc } from './uigf';

const mapping: HistoryMapping = {
  uigfKey: 'hkrpg',
  gachaTypes: { '1': 'standard', '11': 'character', '12': 'weapon' },
  rarity: { '5': 'top', '4': 'mid', '3': 'low' },
};
const row = (id: string, type: string, rank: string, time: string, item = '1001') => ({
  id,
  gacha_type: type,
  gacha_id: '2001',
  item_id: item,
  count: '1',
  name: `Item ${id}`,
  item_type: 'Character',
  rank_type: rank,
  time,
});

const uigf = {
  info: { export_timestamp: 1791537310, export_app: 'test', export_app_version: '1.0', version: 'v4.0' },
  hkrpg: [
    {
      uid: '800000001',
      timezone: 8,
      lang: 'en-us',
      list: [
        row('1700000000000000002', '11', '5', '2026-10-01 12:00:01', '1308'),
        row('1700000000000000001', '11', '3', '2026-10-01 12:00:00'),
        row('1700000000000000003', '21', '4', '2026-10-01 12:00:02'), // collab: unknown type
        { id: '17', gacha_type: '11', rank_type: '9', time: 'yesterday' }, // broken row
      ],
    },
  ],
};

describe('UIGF v4', () => {
  it('reads the game section, converts server time to UTC and sorts oldest first', () => {
    const r = parseHistoryFile(JSON.stringify(uigf), mapping);
    if (!r.ok) throw new Error(r.error);
    expect(r.format).toBe('uigf-v4');
    const acc = r.accounts[0];
    expect(acc?.uid).toBe('800000001');
    expect(acc?.records.map((p) => [p.id, p.bannerType, p.rarity, p.time])).toEqual([
      ['1700000000000000001', 'character', 'low', '2026-10-01T04:00:00.000Z'],
      ['1700000000000000002', 'character', 'top', '2026-10-01T04:00:01.000Z'],
    ]);
  });
  it('counts unknown banner types and broken rows instead of hiding them', () => {
    const r = parseHistoryFile(JSON.stringify(uigf), mapping);
    if (!r.ok) throw new Error(r.error);
    expect(r.accounts[0]?.skipped).toEqual({ '21': 1 });
    expect(r.accounts[0]?.invalid).toBe(1);
  });
  it('leaves the 50/50 result unknown unless the game lists its standard pool', () => {
    const r = parseHistoryFile(JSON.stringify(uigf), mapping);
    if (!r.ok) throw new Error(r.error);
    expect(r.accounts[0]?.records[1]?.featured).toBeUndefined();
    const withPool = parseHistoryFile(JSON.stringify(uigf), { ...mapping, standardTop: ['1308'] });
    if (!withPool.ok) throw new Error(withPool.error);
    expect(withPool.accounts[0]?.records[1]?.featured).toBe(false);
  });
  it('says so when the file has nothing for this game', () => {
    expect(parseHistoryFile(JSON.stringify({ ...uigf, hkrpg: [] }), mapping)).toEqual({ ok: false, error: 'This file has no history for this game.' });
  });
});

describe('SRGF v1', () => {
  it('reads the single-account format', () => {
    const srgf = {
      info: { srgf_version: 'v1.0', uid: '800000002', lang: 'en-us', region_time_zone: -5 },
      list: [row('1700000000000000010', '12', '4', '2026-10-01 00:00:00')],
    };
    const r = parseHistoryFile(JSON.stringify(srgf), mapping);
    if (!r.ok) throw new Error(r.error);
    expect(r.format).toBe('srgf-v1');
    expect(r.accounts[0]?.records[0]).toMatchObject({ bannerType: 'weapon', rarity: 'mid', time: '2026-10-01T05:00:00.000Z' });
  });
});

describe('bad files get a plain explanation', () => {
  it('not JSON', () => {
    expect(parseHistoryFile('hello', mapping)).toMatchObject({ ok: false, error: expect.stringMatching(/valid JSON/) });
  });
  it('not a history export', () => {
    expect(parseHistoryFile('{"a":1}', mapping)).toMatchObject({ ok: false, error: expect.stringMatching(/UIGF.*SRGF/) });
  });
  it('unsupported version', () => {
    expect(parseHistoryFile('{"info":{"version":"v3.0"}}', mapping)).toMatchObject({ ok: false, error: expect.stringMatching(/v3\.0/) });
  });
});

describe('re-imports never lose or duplicate pulls', () => {
  const a = { id: '1', bannerType: 'character', itemId: 'x', name: 'A', rarity: 'low' as const, time: '2026-01-01T00:00:00Z' };
  const b = { ...a, id: '2', time: '2026-01-02T00:00:00Z' };
  const c = { ...a, id: '3', time: '2026-01-03T00:00:00Z' };
  it('adds only new ids and keeps what was stored', () => {
    const first = mergePulls([], [a, b]);
    const again = mergePulls(first.merged, [b, c, { ...a, name: 'changed' }]);
    expect(again.added).toBe(1);
    expect(again.merged.map((p) => p.id)).toEqual(['1', '2', '3']);
    expect(again.merged[0]?.name).toBe('A');
  });
});

it('converts server time with negative offsets', () => {
  expect(serverTimeToUtc('2026-10-01 23:30:00', -5)).toBe('2026-10-02T04:30:00.000Z');
});
