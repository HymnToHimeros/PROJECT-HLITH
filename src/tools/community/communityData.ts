import { backend } from '../../core/data/backend';

/*
 * The community groundwork's server calls (migration 0014, T60). Every one is checked on the
 * server: owner-only calls refuse everyone else, community_home() refuses non-members.
 * Screens take a CommunityApi so tests can hand them a fake one.
 */

export type InviteStatus = 'open' | 'used' | 'yours' | 'cancelled' | 'unknown';

export interface CommunityHome {
  members: number;
  role: 'tester' | 'owner';
  joined_at: string | null;
}

export interface InviteRow {
  id: string;
  note: string;
  created_at: string;
  used_at: string | null;
  used_by: string | null;
  used_by_name: string | null;
  cancelled_at: string | null;
}

export interface MemberRow {
  user_id: string;
  name: string | null;
  role: 'tester';
  joined_at: string;
  invite_note: string | null;
}

export interface CommunityApi {
  home(): Promise<CommunityHome>;
  inviteStatus(token: string): Promise<InviteStatus>;
  accept(token: string): Promise<'joined' | 'already'>;
  createInvite(note: string): Promise<{ id: string; token: string }>;
  cancelInvite(id: string): Promise<boolean>;
  invites(): Promise<InviteRow[]>;
  members(): Promise<MemberRow[]>;
  removeMember(userId: string): Promise<boolean>;
}

const client = backend;

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  if (!client) throw new Error('This site runs without a server.');
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

/** The real server, or null when this site runs without one. */
export const serverCommunity: CommunityApi | null = client
  ? {
      home: () => call<CommunityHome>('community_home'),
      inviteStatus: (token) => call<InviteStatus>('invite_status', { p_token: token }),
      accept: (token) => call<'joined' | 'already'>('accept_invite', { p_token: token }),
      createInvite: (note) => call<{ id: string; token: string }>('create_invite', { p_note: note }),
      cancelInvite: (id) => call<boolean>('cancel_invite', { p_id: id }),
      invites: async () => (await call<InviteRow[] | null>('owner_invites')) ?? [],
      members: async () => (await call<MemberRow[] | null>('owner_members')) ?? [],
      removeMember: (userId) => call<boolean>('remove_member', { p_user: userId }),
    }
  : null;

/** What an invite's state reads as in the owner's list. */
export function inviteState(i: InviteRow): 'unused' | 'used' | 'cancelled' {
  if (i.cancelled_at) return 'cancelled';
  return i.used_at ? 'used' : 'unused';
}
