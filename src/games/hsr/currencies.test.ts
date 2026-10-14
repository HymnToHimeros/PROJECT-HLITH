import { describe, expect, it } from 'vitest';
import { hsr } from './contract';

describe('hsr currencies', () => {
  it('Oneiric Shard turns 1:1 into Stellar Jade, so it makes pulls at the same rate (160 a pull)', () => {
    const of = (cid: string) => hsr.currencies.find((c) => c.id === cid);
    expect(of('oneiric-shard')).toMatchObject({ paid: true, perPull: 160 });
    expect(of('oneiric-shard')?.perPull).toBe(of('stellar-jade')?.perPull);
    // The premium currency is still the free one.
    expect(hsr.currencies.find((c) => c.perPull && !c.paid)?.id).toBe('stellar-jade');
  });
});
