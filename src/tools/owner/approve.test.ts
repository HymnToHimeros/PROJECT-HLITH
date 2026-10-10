import { describe, expect, it } from 'vitest';
import type { GameContract } from '../../core/contract';
import { planApproval, slugId, type FindingLike } from './approve';

const game = {
  id: 'hsr',
  terms: { rarity: { top: '5★', mid: '4★' } },
  elements: [{ id: 'ice', label: 'Ice' }],
  roles: [{ id: 'harmony', label: 'Harmony' }],
  currencies: [{ id: 'jade', name: 'Stellar Jade', perPull: 160 }],
  bannerTypes: [{ id: 'character', label: 'Character event warp' }],
} as unknown as GameContract;

const f = (kind: string, payload: Record<string, unknown>, extra: Partial<FindingLike> = {}): FindingLike => ({
  id: 'f1',
  game_id: 'hsr',
  kind,
  title: 'Something found',
  payload,
  source_name: 'nanoka.cc',
  ...extra,
});

describe('approving a finding', () => {
  it('a complete event becomes an event item with a stable id', () => {
    const plan = planApproval(f('event', { title: 'Moon Festival', kind: 'event', start: '2026-10-12T04:00:00Z', end: '2026-10-26T04:00:00Z' }), game);
    expect(plan).toEqual({
      ok: true,
      draft: expect.objectContaining({
        list: 'events',
        missing: [],
        item: { id: 'moon-festival-2026-10-12', title: 'Moon Festival', kind: 'event', start: '2026-10-12T04:00:00.000Z', end: '2026-10-26T04:00:00.000Z', reward: null, currency: 'jade' },
      }),
    });
  });

  it('a banner matches its type by label; an id in the payload is kept', () => {
    const plan = planApproval(f('banner', { id: 'b-38-1', title: 'Phase 1', type: 'Character event warp', start: '2026-10-12', end: '2026-11-01', featured: ['1001'] }), game);
    expect(plan.ok && plan.draft.item).toMatchObject({ id: 'b-38-1', type: 'character', featured: ['1001'] });
    expect(plan.ok && plan.draft.missing).toEqual([]);
  });

  it('a character with every field is complete; labels and rarity words are matched', () => {
    const plan = planApproval(f('character', { name: 'Example', rarity: '5★', element: 'Ice', role: 'Harmony' }), game);
    expect(plan.ok && plan.draft).toMatchObject({ list: 'characters', missing: [], item: { id: 'example', name: 'Example', rarity: 'top', element: 'ice', role: 'harmony', source: 'nanoka.cc' } });
  });

  it('a leak is marked with its source; the docs example (character, element, version) still needs rarity and role', () => {
    const plan = planApproval(f('leak', { character: 'Example', element: 'Ice', version: '3.8' }), game);
    expect(plan.ok && plan.draft).toMatchObject({ list: 'characters', missing: ['rarity', 'role'], item: { name: 'Example', element: 'ice', leak: { source: 'nanoka.cc' } } });
  });

  it('missing fields are named; an unknown element is not guessed', () => {
    const plan = planApproval(f('character', { name: 'X', element: 'Plasma' }), game);
    expect(plan.ok && plan.draft.missing).toEqual(['rarity', 'element', 'role']);
  });

  it('info findings and findings with no game go into no list', () => {
    expect(planApproval(f('info', {}), game).ok).toBe(false);
    expect(planApproval(f('event', {}, { game_id: null }), game).ok).toBe(false);
  });

  it('slug ids are plain and stable', () => {
    expect(slugId('Hlíð — Version 3.8: Login!')).toBe('hlid-version-3-8-login');
  });
});
