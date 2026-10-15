import { describe, expect, it } from 'vitest';
import { buildHlithFile, isHlithFile, parseHlithFile } from '../src/tools/import/hlith';
import type { HistoryMapping, PullRecord } from '../src/core/contract';

const mapping: HistoryMapping = {
  gachaTypes: {
    chartered: 'chartered',
    basic: 'basic',
    'weapon-limited': 'weapon',
  },
  rarity: { '6': 'top', '5': 'mid', '4': 'low' },
};

const pulls: PullRecord[] = [
  { id: '1001', bannerType: 'chartered', itemId: 'c1', name: 'Alice', rarity: 'top', time: '2026-10-01T00:00:00.000Z' },
  { id: '1002', bannerType: 'basic', itemId: 'c2', name: 'Bob', rarity: 'mid', time: '2026-10-02T00:00:00.000Z' },
  { id: '1003', bannerType: 'weapon', itemId: 'w1', name: 'Sword', rarity: 'low', time: '2026-10-03T00:00:00.000Z' },
];

describe('HLITH pull history file', () => {
  it('round-trips through build and parse', () => {
    const file = buildHlithFile('endfield', pulls, mapping);
    expect(isHlithFile(file)).toBe(true);
    expect(file.app).toBe('PROJECT-HLITH');
    expect(file.kind).toBe('pull-history');
    expect(file.version).toBe(1);
    expect(file.game).toBe('endfield');
    expect(file.list).toHaveLength(3);

    const first = file.list[0];
    expect(first).toBeDefined();
    expect(first!.gacha_type).toBe('chartered');
    expect(first!.rank_type).toBe('6');

    const parsed = parseHlithFile(file, 'endfield');
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.list).toHaveLength(3);
    }
  });

  it('rejects wrong game', () => {
    const file = buildHlithFile('endfield', pulls, mapping);
    const result = parseHlithFile(file, 'hsr');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('endfield');
    }
  });

  it('isHlithFile rejects non-HLITH data', () => {
    expect(isHlithFile(null)).toBe(false);
    expect(isHlithFile({ info: { version: 'v4.0' } })).toBe(false);
    expect(isHlithFile({ app: 'OTHER', kind: 'pull-history', version: 1 })).toBe(false);
  });

  it('reverse-maps gacha types and rarities', () => {
    const file = buildHlithFile('endfield', pulls, mapping);
    const weapon = file.list.find((p) => p.name === 'Sword');
    expect(weapon).toBeDefined();
    expect(weapon!.gacha_type).toBe('weapon-limited');
    expect(weapon!.rank_type).toBe('4');
  });
});
