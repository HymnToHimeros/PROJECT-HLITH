import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { INVITE_KEY, inviteFromHash, inviteLink, ROLES_CHANGED } from '../../core/auth/invite';
import type { PanelProps } from '../../core/registry/panels';
import { Members } from '../owner/Members';
import type { CommunityApi, InviteRow, MemberRow } from './communityData';
import CommunityPage from './CommunityPage';

const TOKEN = 'a'.repeat(64);

function fakeApi(over: Partial<CommunityApi> = {}): CommunityApi {
  return {
    home: vi.fn(async () => ({ members: 3, role: 'tester' as const, joined_at: '2026-10-11T12:00:00Z' })),
    inviteStatus: vi.fn(async () => 'open' as const),
    accept: vi.fn(async () => 'joined' as const),
    createInvite: vi.fn(async () => ({ id: 'i1', token: TOKEN })),
    cancelInvite: vi.fn(async () => true),
    invites: vi.fn(async () => [] as InviteRow[]),
    members: vi.fn(async () => [] as MemberRow[]),
    removeMember: vi.fn(async () => true),
    ...over,
  };
}

const account = { email: 't@example.com', id: 'u1', onSignOut: () => {} };
const props = (api: CommunityApi | null, signedIn = true) =>
  ({ games: [], allGames: [], scope: 'all', servers: {}, account: signedIn ? account : null, close: () => {}, open: () => {}, editLayout: () => {}, api }) as PanelProps & {
    api: CommunityApi | null;
  };

describe('invite links (T60)', () => {
  it('carry the secret after the #, so it never reaches the server; only well-formed secrets count', () => {
    expect(inviteLink('https://x.dev', TOKEN)).toBe(`https://x.dev/community#invite=${TOKEN}`);
    expect(inviteFromHash(`#invite=${TOKEN}`)).toBe(TOKEN);
    expect(inviteFromHash(`#invite=${TOKEN.toUpperCase()}`)).toBe(TOKEN);
    expect(inviteFromHash('#invite=short')).toBeNull();
    expect(inviteFromHash('#team=abc')).toBeNull();
  });
});

describe('Community page (T60)', () => {
  beforeEach(() => localStorage.clear());

  it('members see the frame: the welcome, real numbers from the server, and the empty place for the Discord', async () => {
    render(<CommunityPage {...props(fakeApi())} />);
    expect(await screen.findByRole('heading', { name: 'The community is being built.' })).toBeInTheDocument();
    expect(screen.getByText('You’re one of the first.')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Tester')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Community space (coming later)' })).toHaveTextContent('The HLIÐSKJÁLF Discord will open right here.');
    // No embed, bot or chat yet.
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('anyone the server refuses sees that it is invite-only, and nothing else', async () => {
    render(<CommunityPage {...props(fakeApi({ home: vi.fn(async () => Promise.reject(new Error('members only'))) }))} />);
    expect(await screen.findByRole('heading', { name: 'The community is invite-only for now' })).toBeInTheDocument();
    expect(screen.queryByText('You’re one of the first.')).toBeNull();
  });

  it('an open invite asks first; accepting uses it, tells the app the role changed, and shows the community', async () => {
    localStorage.setItem(INVITE_KEY, TOKEN);
    const api = fakeApi();
    const changed = vi.fn();
    window.addEventListener(ROLES_CHANGED, changed);
    render(<CommunityPage {...props(api)} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Accept the invite' }));
    expect(await screen.findByRole('heading', { name: 'The community is being built.' })).toBeInTheDocument();
    expect(api.accept).toHaveBeenCalledWith(TOKEN);
    expect(changed).toHaveBeenCalled();
    expect(localStorage.getItem(INVITE_KEY)).toBeNull();
    window.removeEventListener(ROLES_CHANGED, changed);
  });

  it('a used, cancelled or broken link says so and is forgotten', async () => {
    localStorage.setItem(INVITE_KEY, TOKEN);
    render(<CommunityPage {...props(fakeApi({ inviteStatus: vi.fn(async () => 'cancelled' as const) }))} />);
    expect(await screen.findByText(/This invite link was cancelled\. Ask the owner for a new one\./)).toBeInTheDocument();
    expect(localStorage.getItem(INVITE_KEY)).toBeNull();
  });

  it('signed out, or without a server, it asks nothing', () => {
    const api = fakeApi();
    const { unmount } = render(<CommunityPage {...props(api, false)} />);
    expect(screen.getByText(/Sign in to see the community/)).toBeInTheDocument();
    expect(api.home).not.toHaveBeenCalled();
    unmount();
    render(<CommunityPage {...props(null)} />);
    expect(screen.getByText(/runs without a server/)).toBeInTheDocument();
  });
});

describe('Owner console → Members (T60)', () => {
  it('makes a one-time link, shown once to copy', async () => {
    const api = fakeApi();
    render(<Members api={api} origin="https://hlith.example" />);
    fireEvent.change(await screen.findByLabelText(/Note for you/), { target: { value: 'For Tess' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create invite' }));
    expect(await screen.findByLabelText('Invite link')).toHaveValue(`https://hlith.example/community#invite=${TOKEN}`);
    expect(api.createInvite).toHaveBeenCalledWith('For Tess');
    expect(screen.getByText(/can’t be shown again/)).toBeInTheDocument();
  });

  it('lists invites with their state; only unused ones can be cancelled', async () => {
    const invites: InviteRow[] = [
      { id: 'a', note: 'spare', created_at: '2026-10-11T10:00:00Z', used_at: null, used_by: null, used_by_name: null, cancelled_at: null },
      { id: 'b', note: 'for Tess', created_at: '2026-10-10T10:00:00Z', used_at: '2026-10-10T12:00:00Z', used_by: 'u2', used_by_name: 'Tess', cancelled_at: null },
      { id: 'c', note: 'old', created_at: '2026-10-09T10:00:00Z', used_at: null, used_by: null, used_by_name: null, cancelled_at: '2026-10-09T11:00:00Z' },
    ];
    const api = fakeApi({ invites: vi.fn(async () => invites) });
    render(<Members api={api} />);
    expect(await screen.findByRole('listitem', { name: 'for Tess' })).toHaveTextContent(/USED.*used by Tess/);
    expect(screen.getByRole('listitem', { name: 'old' })).toHaveTextContent('CANCELLED');
    expect(screen.getAllByRole('button', { name: /Cancel invite/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel invite: spare' }));
    expect(await screen.findByText(/Its link no longer works/)).toBeInTheDocument();
    expect(api.cancelInvite).toHaveBeenCalledWith('a');
  });

  it('removing a tester asks once more first', async () => {
    const members: MemberRow[] = [{ user_id: 'u2', name: 'Tess', role: 'tester', joined_at: '2026-10-10T12:00:00Z', invite_note: 'for Tess' }];
    const api = fakeApi({ members: vi.fn(async () => members) });
    render(<Members api={api} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Remove Tess' }));
    expect(api.removeMember).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove Tess' }));
    expect(await screen.findByText(/Removed Tess/)).toBeInTheDocument();
    expect(api.removeMember).toHaveBeenCalledWith('u2');
  });
});
