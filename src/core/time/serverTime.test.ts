import { describe, expect, it } from 'vitest';
import { atServer, listAtServer, serverOffset } from './serverTime';

const banner = { start: '2026-10-15T04:00:00.000Z', end: '2026-11-04T06:59:00.000Z', serverTime: { base: 8, end: true } };

describe('server time', () => {
  it('moves only the flagged times to the chosen server', () => {
    const eu = atServer(banner, 1);
    expect(eu.start).toBe(banner.start); // the start is the same moment everywhere
    expect(eu.end).toBe('2026-11-04T13:59:00.000Z'); // 7 h later in Europe
    expect(atServer(banner, -5).end).toBe('2026-11-04T19:59:00.000Z'); // 13 h later in America
  });
  it('without a chosen server or a flag nothing changes', () => {
    expect(atServer(banner, undefined)).toBe(banner);
    const plain = { start: banner.start, end: banner.end };
    expect(listAtServer([plain], 1)[0]).toBe(plain);
  });
  it('finds the offset of the chosen server', () => {
    const game = { id: 'hsr', servers: [{ id: 'europe', utcOffset: 1 }] };
    expect(serverOffset(game, { hsr: 'europe' })).toBe(1);
    expect(serverOffset(game, {})).toBeUndefined();
  });
});
