import { describe, expect, it } from 'vitest';
import { duplicateIds, mergeList, type CatalogRow } from './catalog';

const row = (id: string, data: Record<string, unknown>, status: 'active' | 'retired' = 'active'): CatalogRow => ({
  game_id: 'g',
  kind: 'character',
  id,
  data,
  status,
  source: 'official',
  updated_at: '2026-10-09T00:00:00Z',
});

const seed = [
  { id: 'a', name: 'Alpha', rarity: 'top' },
  { id: 'b', name: 'Beta', rarity: 'mid' },
];

describe('built-in lists never lose an item', () => {
  it('keeps seed items when the owner has no updates', () => {
    expect(mergeList(seed, []).map((i) => [i.id, i.retired, i.updatedBy])).toEqual([
      ['a', false, 'seed'],
      ['b', false, 'seed'],
    ]);
  });

  it('owner rows change fields but never the id', () => {
    const out = mergeList(seed, [row('a', { name: 'Alpha (fixed)', id: 'zzz' })]);
    expect(out[0]).toMatchObject({ id: 'a', name: 'Alpha (fixed)', rarity: 'top', updatedBy: 'owner' });
  });

  it('a retired item stays in the list, flagged', () => {
    const out = mergeList(seed, [row('b', {}, 'retired')]);
    expect(out.map((i) => i.id)).toEqual(['a', 'b']);
    expect(out[1]?.retired).toBe(true);
  });

  it('new owner items are added at the end', () => {
    expect(mergeList(seed, [row('c', { name: 'Gamma', rarity: 'top' })]).map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('finds duplicate ids', () => {
    expect(duplicateIds([{ id: 'a' }, { id: 'b' }, { id: 'a' }])).toEqual(['a']);
  });
});
