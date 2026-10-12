import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Users } from './Users';
import { statusOf, type LogRow, type UserRow, type UsersApi } from './usersData';

const day = 86_400_000;
const NOW = Date.now();
const iso = (t: number) => new Date(t).toISOString();
const row = (over: Partial<UserRow>): UserRow => ({
  user_id: 'u',
  name: 'Someone',
  avatar_path: null,
  methods: ['discord'],
  joined_at: iso(NOW - 10 * day),
  last_active_at: iso(NOW - day),
  tester: false,
  owner: false,
  silenced_until: null,
  banned_until: null,
  deleting_after: null,
  removed_by_owner: null,
  ...over,
});

const OWNER = row({ user_id: 'me', name: 'The Owner', owner: true, methods: ['email'], joined_at: iso(NOW - 40 * day) });
const MIRA = row({ user_id: 'mira', name: 'Mira', tester: true, joined_at: iso(NOW - 2 * day) });
const KAEL = row({ user_id: 'kael', name: 'Kael', methods: ['google', 'discord'], joined_at: iso(NOW - 5 * day), banned_until: iso(NOW + 3 * day) });
const GONE = row({ user_id: 'gone', name: 'Gone', deleting_after: iso(NOW + 20 * day), removed_by_owner: true, banned_until: 'infinity' });

function fakeApi(users: UserRow[], log: LogRow[] = []): UsersApi & { act: ReturnType<typeof vi.fn> } {
  return { users: vi.fn(async () => users), log: vi.fn(async () => log), act: vi.fn(async () => undefined), avatarUrl: () => null };
}

describe('Owner console → Users (T60b)', () => {
  it('lists everyone newest first, with sign-in methods, tester and status, and never an email address', async () => {
    render(<Users api={fakeApi([OWNER, KAEL, MIRA, GONE])} selfId="me" />);
    await screen.findByRole('listitem', { name: 'Mira' });
    const items = within(screen.getByRole('region', { name: /^Users/ })).getAllByRole('listitem');
    expect(items.map((li) => li.getAttribute('aria-label'))).toEqual(['Mira', 'Kael', 'Gone', 'The Owner']);
    expect(within(items[0] as HTMLElement).getByText('TESTER')).toBeInTheDocument();
    expect(items[1]).toHaveTextContent(/Google · Discord · joined/);
    expect(items[1]).toHaveTextContent('BANNED');
    expect(items[2]).toHaveTextContent('REMOVING');
    expect(document.body.textContent).not.toMatch(/@/);
  });

  it('never offers actions on your own account or another owner; a removed account only offers Undo', async () => {
    const other = row({ user_id: 'o2', name: 'Co-owner', owner: true });
    render(<Users api={fakeApi([OWNER, other, GONE, KAEL])} selfId="me" />);
    const me = await screen.findByRole('listitem', { name: 'The Owner' });
    expect(within(me).getByText('YOU')).toBeInTheDocument();
    expect(within(me).queryAllByRole('button')).toHaveLength(0);
    expect(within(screen.getByRole('listitem', { name: 'Co-owner' })).queryAllByRole('button')).toHaveLength(0);
    expect(within(screen.getByRole('listitem', { name: 'Gone' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['Undo remove']);
    expect(within(screen.getByRole('listitem', { name: 'Kael' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['Silence', 'Unban', 'Remove']);
  });

  it('asks once more, with a duration and an optional reason, before acting', async () => {
    const api = fakeApi([MIRA]);
    render(<Users api={api} selfId="me" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ban: Mira' }));
    const form = screen.getByRole('form', { name: 'Ban Mira?' });
    expect(api.act).not.toHaveBeenCalled();
    fireEvent.click(within(form).getByLabelText('7 days'));
    fireEvent.change(within(form).getByLabelText(/Reason/), { target: { value: ' spam links ' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Ban' }));
    expect(await screen.findByText('Banned Mira.')).toBeInTheDocument();
    expect(api.act).toHaveBeenCalledWith({ user_id: 'mira', action: 'ban', hours: 168, reason: 'spam links' });
  });

  it('Remove has no duration: it is the 30-day deletion', async () => {
    const api = fakeApi([MIRA]);
    render(<Users api={api} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Remove: Mira' }));
    const form = screen.getByRole('form', { name: 'Remove Mira?' });
    expect(within(form).queryByRole('radio')).toBeNull();
    expect(form).toHaveTextContent(/deleted for good in 30 days/);
    fireEvent.click(within(form).getByRole('button', { name: 'Remove' }));
    await screen.findByText('Removed Mira.');
    expect(api.act).toHaveBeenCalledWith({ user_id: 'mira', action: 'remove', hours: null, reason: '' });
  });

  it('shows the server’s refusal instead of pretending it worked', async () => {
    const api = fakeApi([MIRA]);
    api.act.mockRejectedValueOnce(new Error('owner only'));
    render(<Users api={api} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Silence: Mira' }));
    fireEvent.click(within(screen.getByRole('form', { name: 'Silence Mira?' })).getByRole('button', { name: 'Silence' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('owner only');
  });

  it('search by name and sort by last active', async () => {
    render(<Users api={fakeApi([OWNER, MIRA, KAEL])} />);
    await screen.findByRole('listitem', { name: 'Mira' });
    fireEvent.change(screen.getByLabelText('Search by name'), { target: { value: 'kae' } });
    const names = () => within(screen.getByRole('region', { name: /^Users/ })).queryAllByRole('listitem').map((li) => li.getAttribute('aria-label'));
    expect(names()).toEqual(['Kael']);
    fireEvent.change(screen.getByLabelText('Search by name'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'name' } });
    expect(names()).toEqual(['Kael', 'Mira', 'The Owner']);
  });

  it('the log says who, what, when, until and why', async () => {
    const log: LogRow[] = [{ id: 'l1', user_id: 'kael', name: 'Kael', action: 'ban', reason: 'spam', until: iso(NOW + 3 * day), by_name: 'The Owner', created_at: iso(NOW - 4 * day) }];
    render(<Users api={fakeApi([KAEL], log)} />);
    const entry = await screen.findByRole('listitem', { name: 'Banned Kael' });
    expect(entry).toHaveTextContent(/Banned Kael · until/);
    expect(entry).toHaveTextContent('“spam”');
    expect(entry).toHaveTextContent('by The Owner');
  });
});

describe('an account’s status', () => {
  it('a timed ban or silence ends on its own', () => {
    expect(statusOf(row({ banned_until: iso(NOW - 1000) }), NOW)).toEqual({ kind: 'active' });
    expect(statusOf(row({ silenced_until: iso(NOW + day) }), NOW)).toEqual({ kind: 'silenced', until: NOW + day });
    expect(statusOf(row({ silenced_until: 'infinity' }), NOW)).toEqual({ kind: 'silenced', until: Infinity });
    expect(statusOf(row({ silenced_until: iso(NOW - 1) }), NOW + 5)).toEqual({ kind: 'active' });
  });

  it('reward entries (T67) read in plain words in the same log', async () => {
    const log: LogRow[] = [
      { id: 'l1', user_id: 'mira', name: 'Mira', action: 'reward_grant', reason: 'thanks', until: null, by_name: 'The Owner', created_at: iso(NOW - day), item: 'Lantern' },
      { id: 'l2', user_id: 'mira', name: 'Mira', action: 'reward_claim', reason: '', until: null, by_name: null, created_at: iso(NOW - 2 * day), item: 'Aurora' },
    ];
    render(<Users api={fakeApi([OWNER, MIRA], log)} selfId="me" />);
    expect(await screen.findByRole('listitem', { name: 'Gave Lantern to Mira' })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'Mira claimed Aurora' })).toBeInTheDocument();
  });
});
