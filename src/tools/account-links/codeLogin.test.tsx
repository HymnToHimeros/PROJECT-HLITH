import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { LinkedAccount, RedemptionRow, ServerState } from './accounts';
import { fakeGame } from './fakeGame';

const invoke = vi.fn();
vi.mock('../../core/data/backend', () => ({ backend: { functions: { invoke: (...a: unknown[]) => invoke(...a) }, from: () => ({}) } }));

const account: LinkedAccount = { id: 'link-1', label: 'Main', where: 'server', hoyolabId: '123456789', games: [{ gameId: 'aa', uid: '700000001' }], autoCheckin: true, autoRedeem: true, hasRedeemLogin: true };
const refused: RedemptionRow = {
  link_id: 'link-1',
  game_biz: 'hkrpg_global',
  game_uid: '700000001',
  code: 'STARRAILGIFT',
  ran_at: new Date().toISOString(),
  status: 'login',
  message: 'HoYoverse didn’t accept the code login. (HoYoverse answer -1071)',
};
const server: ServerState = { accounts: [account], checkins: [], redemptions: [refused], publicCodes: {} };
vi.mock('./useAccounts', () => ({
  useAccounts: () => ({ signedIn: true, blocker: null, accounts: [account], server, loadError: null, refresh: () => {} }),
  linkBlocker: () => null,
}));

const { LinkAccounts } = await import('./LinkAccount');
const game = fakeGame({ accountLinks: [{ provider: 'hoyolab', supports: ['stamina', 'checkin'], config: { gameBiz: 'hkrpg_global' } }] });
const BOX = 'Paste account_id_v2, account_mid_v2 and cookie_token_v2';

describe('code login refused by HoYoverse', () => {
  it('explains what to copy, and “Replace code login” leads straight to the paste box', () => {
    render(<LinkAccounts games={[game]} />);
    const card = screen.getByRole('region', { name: 'HoYoLAB account Main' });
    const alert = within(card)
      .getAllByRole('alert')
      .find((a) => a.textContent?.includes('Codes are stopped')) as HTMLElement;
    expect(alert).toHaveTextContent('HoYoverse didn’t accept the code login');
    expect(alert).toHaveTextContent('1234•••89');
    fireEvent.click(within(alert).getByRole('button', { name: 'Replace code login' }));
    expect(within(card).getByLabelText(BOX)).toHaveFocus();
    expect(within(card).getByText(/Close the tab without pressing/)).toBeInTheDocument();
  });

  it('refuses values from another account before sending anything', () => {
    render(<LinkAccounts games={[game]} />);
    const card = screen.getByRole('region', { name: 'HoYoLAB account Main' });
    fireEvent.click(within(card).getAllByRole('button', { name: 'Replace code login' })[0] as HTMLElement);
    fireEvent.change(within(card).getByLabelText(BOX), { target: { value: 'account_id_v2=987654321\naccount_mid_v2=abc12_hy\ncookie_token_v2=v2_ABCDEFGHIJKLMNOP' } });
    fireEvent.click(within(card).getByRole('button', { name: 'Save the code login' }));
    expect(within(card).getByText(/isn’t this account’s number/)).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();
  });
});
