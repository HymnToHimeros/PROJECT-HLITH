import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProfileCard } from '../ProfileCard';
import { cardRewards } from '../cardData';
import { claimFromHash, claimLink } from './claimLink';
import { cleanWorn, codeKey, rewardTag, serverRewards, showCode, wornItems, type HeldReward } from './model';
import { REWARD_BADGES, REWARD_FRAMES, REWARD_NAMES, REWARD_POOL } from './pool';
import { ClaimBox, RewardsEditor } from './RewardsEditor';
import type { RewardsApi } from './rewardsData';

const ID1 = '11111111-1111-4111-8111-111111111111';
const ID2 = '22222222-2222-4222-8222-222222222222';
const held = (over: Partial<HeldReward>): HeldReward => ({
  id: ID1,
  kind: 'badge',
  art: 'r-badge-lantern',
  name: 'Lantern',
  exclusive: true,
  event_name: 'Launch week',
  event_date: '2026-10-20',
  grant_id: 'g1',
  source: 'direct',
  granted_at: '2026-10-12T00:00:00Z',
  ...over,
});
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

describe('rewards: the pool and the rules (T67)', () => {
  it('every pool entry has a drawing of its kind, and no key looks like the owner’s own looks', () => {
    for (const p of REWARD_POOL) {
      if (p.kind === 'badge') expect(REWARD_BADGES[p.art], p.art).toBeDefined();
      if (p.kind === 'frame') expect(REWARD_FRAMES[p.art], p.art).toBeDefined();
      if (p.kind === 'name') expect(REWARD_NAMES).toContain(p.art);
      expect(p.art).not.toMatch(/owner/);
    }
    expect(REWARD_POOL.filter((p) => p.kind === 'badge')).toHaveLength(3);
    expect(REWARD_POOL.filter((p) => p.kind === 'frame')).toHaveLength(3);
    expect(REWARD_POOL.filter((p) => p.kind === 'name')).toHaveLength(3);
  });

  it('the tag reads “Exclusive · event · date”', () => {
    expect(rewardTag(held({}), day)).toBe('Exclusive · Launch week · 2026-10-20');
    expect(rewardTag(held({ exclusive: false, event_name: null, event_date: null }), day)).toBe('Reward');
  });

  it('a worn reward counts only while you hold it, and only in its own kind', () => {
    const list = [held({}), held({ id: ID2, kind: 'frame', art: 'r-frame-aurora', name: 'Aurora' })];
    expect(Object.keys(wornItems({ badge: ID1, frame: ID2, name: ID1 }, list))).toEqual(['badge', 'frame']);
    expect(wornItems({ badge: ID2, frame: null, name: null }, list)).toEqual({});
    expect(cleanWorn({ badge: 'not-an-id', frame: ID2, name: 3 })).toEqual({ badge: null, frame: ID2, name: null });
  });

  it('the server’s card rewards are checked: wrong kind or shape is dropped', () => {
    const out = serverRewards({ badge: { id: ID1, art: 'r-badge-lantern', name: 'Lantern', exclusive: true, event_name: null, event_date: '2026-10-20' }, frame: { id: ID2, art: 'r-badge-lantern', name: 'x' }, name: 'nope' });
    expect(Object.keys(out)).toEqual(['badge']);
    expect(out.badge?.event_date).toBe('2026-10-20');
  });

  it('codes are typed loosely and shown in groups; links carry the code after “#”', () => {
    expect(codeKey('abcd-efgh jklm')).toBe('ABCDEFGHJKLM');
    expect(showCode('ABCDEFGHJKLMNPQR')).toBe('ABCD-EFGH-JKLM-NPQR');
    const link = claimLink('https://x.dev', 'abcd-efgh-jklm-npqr');
    expect(link).toBe('https://x.dev/account/profile#claim=ABCDEFGHJKLMNPQR');
    expect(claimFromHash(new URL(link).hash)).toBe('ABCDEFGHJKLMNPQR');
    expect(claimFromHash('#claim=<script>')).toBeNull();
  });
});

describe('rewards on the card and in Customise (T67)', () => {
  const base = { name: 'Mira', title: null, avatarUrl: null, bannerUrl: null, bannerFallback: 'none', frame: 'none' as const, nameColor: 'ink' as const, vent: '#fff', badge: 'seated' as const, featured: [], stats: null };

  it('the card wears a held reward badge with its tag; the owner’s own look wins', () => {
    const rewards = cardRewards({ badge: held({}) });
    const { rerender } = render(<ProfileCard {...base} rewards={rewards} />);
    expect(screen.getByRole('img', { name: 'Lantern' })).toBeInTheDocument();
    expect(screen.getByText(/^Exclusive · Launch week/)).toBeInTheDocument();
    rerender(<ProfileCard {...base} badge="owner" rewards={rewards} />);
    expect(screen.queryByRole('img', { name: 'Lantern' })).not.toBeInTheDocument();
  });

  it('Exclusive lists what you hold with tags, wears one per kind, and needs an account', () => {
    const onWear = vi.fn();
    const api: RewardsApi = { mine: vi.fn(async () => []), claim: vi.fn() };
    const { rerender } = render(<RewardsEditor held={[held({})]} worn={{ badge: null, frame: null, name: null }} onWear={onWear} signedIn api={api} onClaimed={() => {}} name="Mira" />);
    const group = screen.getByRole('radiogroup', { name: 'Exclusive badge' });
    expect(within(group).getByText(/^Exclusive · Launch week/)).toBeInTheDocument();
    fireEvent.click(within(group).getByRole('radio', { name: /Lantern/ }));
    expect(onWear).toHaveBeenCalledWith({ badge: ID1, frame: null, name: null });
    rerender(<RewardsEditor held={[]} worn={{ badge: null, frame: null, name: null }} onWear={onWear} signedIn={false} api={api} onClaimed={() => {}} name="Mira" />);
    expect(screen.getByText(/Needs an account/)).toBeInTheDocument();
  });

  it('claiming a code says what you got; a bad code shows the server’s reason', async () => {
    const claim = vi
      .fn()
      .mockResolvedValueOnce({ status: 'claimed', item: held({}) })
      .mockRejectedValueOnce(new Error('that code has been used up'));
    const onClaimed = vi.fn();
    render(<ClaimBox api={{ mine: vi.fn(), claim }} onClaimed={onClaimed} />);
    const box = screen.getByLabelText('Have a code?');
    fireEvent.change(box, { target: { value: 'abcd-efgh-jklm-npqr' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Claim' }));
    });
    expect(claim).toHaveBeenCalledWith('abcd-efgh-jklm-npqr');
    expect(await screen.findByRole('status')).toHaveTextContent('Lantern is yours');
    expect(onClaimed).toHaveBeenCalled();
    fireEvent.change(box, { target: { value: 'ZZZZ-ZZZZ' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Claim' }));
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('That code has been used up.');
  });
});
