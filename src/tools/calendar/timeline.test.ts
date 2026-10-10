import { describe, expect, it } from 'vitest';
import { foldRows, nextChange, packRows } from './timeline';

const span = (id: string, start: number, end: number) => ({ id, start, end });

describe('timeline rows', () => {
  it('nextChange: the start if not started, else the end; over = last', () => {
    expect(nextChange(span('a', 5, 9), 0)).toBe(5);
    expect(nextChange(span('a', -5, 9), 0)).toBe(9);
    expect(nextChange(span('a', -5, -1), 0)).toBe(Number.POSITIVE_INFINITY);
  });

  it('packRows: bars that do not overlap share a row, in date order', () => {
    const rows = packRows([span('c', 10, 20), span('a', 0, 10), span('b', 0, 5), span('d', 6, 8)]);
    // Shortest first on a tie: b (0–5), then d (6–8) and c (10–20) fit after it; a (0–10) needs a second row.
    expect(rows.map((r) => r.map((s) => s.id))).toEqual([['b', 'd', 'c'], ['a']]);
  });

  it('foldRows: keeps the soonest changes within the row limit, and drops nothing', () => {
    const all = [span('late', 0, 50), span('soon', 0, 10), span('mid', 0, 20), span('after', 12, 30)];
    const { shown, hidden } = foldRows(all, 1, 1);
    expect(shown.map((s) => s.id)).toEqual(['soon', 'after']);
    expect(hidden.map((s) => s.id)).toEqual(['mid', 'late']);
    expect([...shown, ...hidden]).toHaveLength(all.length);
    expect(packRows(foldRows(all, 1, 2).shown)).toHaveLength(2);
  });
});
