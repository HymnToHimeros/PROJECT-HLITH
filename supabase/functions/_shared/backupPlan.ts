/**
 * Nightly backup plan: which tables are copied and where each copy goes.
 * Pure functions so they can be tested outside the server.
 */

/** Every table that holds anyone's data or the built-in lists. Copies are read-only snapshots. */
export const BACKUP_TABLES = [
  'profiles',
  'owners',
  'user_settings',
  'user_game_data',
  'catalog_items',
  'user_items',
  'roster',
  'progress',
  'bank_ledger',
  'pulls',
  'plans',
  'account_deletion_requests',
  'reminder_settings',
  'hoyolab_links',
  'hoyolab_checkins',
  'hoyolab_redemptions',
  'hoyolab_my_codes',
  'hoyolab_codes',
  'scheduler_jobs',
  'scheduler_runs',
  'scheduler_findings',
  'announcements',
  'community_members',
  'community_invites',
] as const;

export const BACKUP_BUCKET = 'backups';
/** Rows read per request, so big tables don't time out. */
export const PAGE_SIZE = 1000;

/** "2026-10-09/pulls.json": one folder per night (UTC date), one file per table. */
export function backupPath(at: Date, table: string): string {
  return `${at.toISOString().slice(0, 10)}/${table}.json`;
}

/** Only the scheduler, holding the project's own service key, may start a backup. */
export function isScheduler(authorization: string | null, serviceKey: string | undefined): boolean {
  if (!serviceKey || !authorization) return false;
  return authorization === `Bearer ${serviceKey}`;
}
