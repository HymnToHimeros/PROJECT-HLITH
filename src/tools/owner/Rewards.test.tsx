import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ClaimRow, GrantRow, OwnerItem } from '../account/rewards/model';
import type { OwnerRewardsApi } from '../account/rewards/rewardsData';
import { Rewards } from './Rewards';
import type { UsersApi } from './usersData';

const NOW = Date.parse('2026-10-12T12:00:00Z');
const ITEM: OwnerItem = { id: 'i1', kind: 'badge', art: 'r-badge-lantern', name: 'Lantern', exclusive: true, event_name: 'Launch week', event_date: '2026-10-20', created_at: '2026-10-12T00:00:00Z', holders: 1 };
const GRANT: GrantRow = { id: 'g1', user_id: 'u1', name: 'Mira', source: 'direct', granted_at: '2026-10-12T00:00:00Z', revoked_at: null };
const CLAIM: ClaimRow = { id: 'c1', item_id: 'i1', note: 'stream', max_uses: 5, uses: 2, expires_at: null, created_at: '2026-10-12T00:00:00Z', cancelled_at: null };

function fake(): OwnerRewardsApi & Record<string, ReturnType<typeof vi.fn>> {
  return {
    items: vi.fn(async () => [ITEM]),
    addItem: vi.fn(async () => 'i2'),
    grants: vi.fn(async () => [GRANT]),
    grant: vi.fn(async () => 'granted' as const),
    revoke: vi.fn(async () => true),
    claims: vi.fn(async () => [CLAIM]),
    createClaim: vi.fn(async () => ({ id: 'c2', code: 'ABCDEFGHJKLMNPQR' })),
    cancelClaim: vi.fn(async () => true),
  };
}
const users = { users: vi.fn(async () => [{ user_id: 'u1', name: 'Mira', username: 'Mira' }]) } as unknown as UsersApi;

describe('Owner console → Rewards (T67)', () => {
  it('adds an item from the pool with its event, never anything outside the pool', async () => {
    const api = fake();
    render(<Rewards api={api} users={users} origin="https://x.dev" now={NOW} />);
    await screen.findByRole('listitem', { name: 'Lantern' });
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Kind' })).getByRole('radio', { name: 'Frame' }));
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Picture' })).getByRole('radio', { name: /Ember Crown/ }));
    fireEvent.change(screen.getByLabelText(/^Event \(optional\)/), { target: { value: 'Launch week' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
    });
    expect(api.addItem).toHaveBeenCalledWith({ kind: 'frame', art: 'r-frame-ember', name: 'Ember Crown', exclusive: true, eventName: 'Launch week', eventDate: null });
  });

  it('gives an item by username, revokes with a reason, and shows a new code and link once', async () => {
    const api = fake();
    render(<Rewards api={api} users={users} origin="https://x.dev" now={NOW} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Manage: Lantern' }));
    fireEvent.change(await screen.findByLabelText('Give to (username)'), { target: { value: 'mira' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Give' }));
    });
    expect(api.grant).toHaveBeenCalledWith('i1', 'mira', '');
    fireEvent.click(await screen.findByRole('button', { name: 'Revoke from Mira' }));
    fireEvent.change(screen.getByLabelText('Reason for revoking'), { target: { value: 'mistake' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Yes, revoke' }));
    });
    expect(api.revoke).toHaveBeenCalledWith('g1', 'mistake');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Make code' }));
    });
    expect(api.createClaim).toHaveBeenCalledWith('i1', 1, null, '');
    expect(screen.getByLabelText('Claim code')).toHaveValue('ABCD-EFGH-JKLM-NPQR');
    expect(screen.getByLabelText('Claim link')).toHaveValue('https://x.dev/account/profile#claim=ABCDEFGHJKLMNPQR');
  });

  it('lists claim codes with their uses and cancels an open one', async () => {
    const api = fake();
    render(<Rewards api={api} users={users} origin="https://x.dev" now={NOW} />);
    const code = await screen.findByRole('listitem', { name: 'stream' });
    expect(within(code).getByText('OPEN')).toBeInTheDocument();
    expect(within(code).getByText(/Used 2 of 5/)).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(within(code).getByRole('button', { name: 'Cancel code: stream' }));
    });
    expect(api.cancelClaim).toHaveBeenCalledWith('c1');
  });

  it('without a server it says so', () => {
    render(<Rewards api={null} users={null} now={NOW} />);
    expect(screen.getByText(/runs without a server/)).toBeInTheDocument();
  });
});
