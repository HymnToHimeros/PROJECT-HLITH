import { describe, expect, it } from 'vitest';
import { zzz } from './contract';

describe('zzz currencies', () => {
  it('Monochrome turns 1:1 into Polychrome, so it makes pulls at the same rate (160 a pull)', () => {
    const of = (cid: string) => zzz.currencies.find((c) => c.id === cid);
    expect(of('monochrome')).toMatchObject({ paid: true, perPull: 160 });
    expect(of('monochrome')?.perPull).toBe(of('polychrome')?.perPull);
    // The premium currency is still the free one.
    expect(zzz.currencies.find((c) => c.perPull && !c.paid)?.id).toBe('polychrome');
  });
});
