/**
 * Finishing account deletions (T11): once a deletion request's 30-day grace period is over
 * and it wasn't cancelled, everything of that account is removed for good. Pure: shared by
 * the purge-accounts function and the tests.
 *
 * Order matters: rows that point at other rows go first (check-ins and redemptions point at
 * HoYoLAB links), and the sign-in account itself goes last (every table points at it).
 * The saved HoYoLAB logins in Vault are overwritten before their rows go (same as "Forget").
 */
import { USER_TABLES } from './accountPlan.ts';

/** Every table with the account's rows, in the order they're removed. */
export const PURGE_TABLES = [
  'skport_checkins',
  'skport_links',
  'hoyolab_checkins',
  'hoyolab_redemptions',
  'hoyolab_my_codes',
  'hoyolab_links',
  'reminder_settings',
  'user_items',
  'roster',
  'progress',
  'bank_ledger',
  'pulls',
  'plans',
  'user_game_data',
  'user_settings',
  'profiles',
  'community_members',
  'reward_grants',
  'reward_log',
  'moderation_actions',
  'account_restrictions',
  'account_identity',
  'owners',
  'account_deletion_requests',
] as const;

/**
 * Tables where the account appears under another column than user_id: the invite links
 * it used or made (T60). Removed before the rows above.
 */
export const PURGE_BY_COLUMN = [
  { table: 'community_invites', column: 'used_by' },
  { table: 'community_invites', column: 'created_by' },
  { table: 'moderation_actions', column: 'created_by' },
  { table: 'reward_log', column: 'created_by' },
] as const;

/** Storage buckets where each account has its own folder (<user id>/…). */
export const USER_FOLDERS = ['avatars', 'backgrounds'] as const;

/** Nightly backups older than this many days are removed, so a deleted account leaves every copy within 30 days. */
export const BACKUP_KEEP_DAYS = 30;

export interface DeletionRow {
  user_id: string;
  purge_after: string;
  cancelled_at: string | null;
  completed_at: string | null;
}

/** Requests whose grace period is over and that weren't cancelled or already finished. */
export function duePurges(rows: DeletionRow[], now: number): string[] {
  return rows.filter((r) => !r.cancelled_at && !r.completed_at && Date.parse(r.purge_after) <= now).map((r) => r.user_id);
}

/** Nightly backup folders ("2026-10-09") older than BACKUP_KEEP_DAYS. Anything not a date is left alone. */
export function oldBackupFolders(folders: string[], now: number, keepDays = BACKUP_KEEP_DAYS): string[] {
  const cutoff = new Date(now - keepDays * 86_400_000).toISOString().slice(0, 10);
  return folders.filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f) && f < cutoff);
}

/** Every table the export covers is purged too (and owners): checked by the tests. */
export const coversExport = () => USER_TABLES.every((t) => (PURGE_TABLES as readonly string[]).includes(t));

export interface PurgeClient {
  wipeHoyolabLogins(userId: string): Promise<void>;
  wipeSkportTokens(userId: string): Promise<void>;
  /** Removes the account's rows; `column` defaults to user_id. */
  deleteRows(table: string, userId: string, column?: string): Promise<number>;
  listFolder(bucket: string, userId: string): Promise<string[]>;
  removeFiles(bucket: string, paths: string[]): Promise<void>;
  deleteSignIn(userId: string): Promise<void>;
}

/** Removes one account completely. Stops at the first error (nothing half-done is hidden): the request stays and the next run tries again. */
export async function purgeAccount(c: PurgeClient, userId: string): Promise<{ rows: number; files: number }> {
  await c.wipeHoyolabLogins(userId);
  await c.wipeSkportTokens(userId);
  let files = 0;
  for (const bucket of USER_FOLDERS) {
    const names = await c.listFolder(bucket, userId);
    if (names.length) await c.removeFiles(bucket, names.map((n) => `${userId}/${n}`));
    files += names.length;
  }
  let rows = 0;
  for (const { table, column } of PURGE_BY_COLUMN) rows += await c.deleteRows(table, userId, column);
  for (const table of PURGE_TABLES) rows += await c.deleteRows(table, userId);
  await c.deleteSignIn(userId);
  return { rows, files };
}
