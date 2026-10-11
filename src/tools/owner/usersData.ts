import { backend } from '../../core/data/backend';
import { readUntil } from '../../core/auth/standing';
import { AVATAR_BUCKET } from '../account/useProfile';

/*
 * Owner console → Users (T60b): the server calls. owner_users and owner_moderation_log
 * (migration 0015) refuse anyone but the owner and never return email addresses; actions go
 * through the owner-only moderate server function, which also bans the sign-in itself.
 */

export type Action = 'silence' | 'lift_silence' | 'ban' | 'unban' | 'remove' | 'undo_remove';
export type Hours = 24 | 168 | null;

export interface UserRow {
  user_id: string;
  name: string | null;
  avatar_path: string | null;
  methods: string[];
  joined_at: string;
  last_active_at: string | null;
  tester: boolean;
  owner: boolean;
  silenced_until: string | null;
  banned_until: string | null;
  deleting_after: string | null;
  removed_by_owner: boolean | null;
}

export interface LogRow {
  id: string;
  user_id: string;
  name: string | null;
  action: Action;
  reason: string;
  until: string | null;
  by_name: string | null;
  created_at: string;
}

export interface UsersApi {
  users(): Promise<UserRow[]>;
  log(): Promise<LogRow[]>;
  act(req: { user_id: string; action: Action; hours: Hours; reason: string }): Promise<void>;
  avatarUrl(path: string | null): string | null;
}

const client = backend;

async function rpc<T>(fn: string): Promise<T> {
  if (!client) throw new Error('This site runs without a server.');
  const { data, error } = await client.rpc(fn);
  if (error) throw new Error(error.message);
  return data as T;
}

export const serverUsers: UsersApi | null = client
  ? {
      users: async () => (await rpc<UserRow[] | null>('owner_users')) ?? [],
      log: async () => (await rpc<LogRow[] | null>('owner_moderation_log')) ?? [],
      act: async (req) => {
        const { data, error } = await client.functions.invoke('moderate', { body: req });
        const said = data && typeof data === 'object' && 'error' in data ? String((data as { error: unknown }).error) : null;
        if (error || said) {
          // The function's own message says what went wrong, when there is one.
          let msg = said;
          const ctx = (error as { context?: { json?: () => Promise<unknown> } } | null)?.context;
          if (!msg && ctx?.json) msg = await ctx.json().then((b) => (b && typeof b === 'object' && 'error' in b ? String((b as { error: unknown }).error) : null), () => null);
          throw new Error(msg ?? error?.message ?? 'That didn’t work.');
        }
      },
      avatarUrl: (path) => (path ? client.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl : null),
    }
  : null;

export type Status =
  | { kind: 'active' }
  | { kind: 'silenced'; until: number }
  | { kind: 'banned'; until: number }
  | { kind: 'removing'; after: number }
  | { kind: 'deleting'; after: number };

/** The account's state right now; a ban that ran out reads as active again. */
export function statusOf(u: UserRow, now: number): Status {
  const after = readUntil(u.deleting_after);
  if (after !== null && u.removed_by_owner) return { kind: 'removing', after };
  const banned = readUntil(u.banned_until);
  if (banned !== null && banned > now) return { kind: 'banned', until: banned };
  if (after !== null) return { kind: 'deleting', after };
  const silenced = readUntil(u.silenced_until);
  if (silenced !== null && silenced > now) return { kind: 'silenced', until: silenced };
  return { kind: 'active' };
}

export const METHOD_LABEL: Record<string, string> = { discord: 'Discord', google: 'Google', email: 'Email' };
