/**
 * Export my data (R56) and Delete my account (R57): which tables hold a user's
 * rows, what is left out of an export, and what a deletion request looks like.
 * Pure: shared by the export-data and delete-account functions and the tests.
 */

/** Every table with a user_id column: your rows, and only yours, go into an export. */
export const USER_TABLES = [
  'profiles',
  'user_settings',
  'user_game_data',
  'user_items',
  'roster',
  'progress',
  'bank_ledger',
  'pulls',
  'plans',
  'reminder_settings',
  'account_deletion_requests',
  'hoyolab_links',
  'hoyolab_checkins',
  'hoyolab_redemptions',
  'hoyolab_my_codes',
] as const;

/**
 * Secrets are never exported: the calendar link token, the phone's push address, and
 * the ids of saved HoYoLAB logins in Vault (the logins themselves never leave Vault).
 */
const SECRET_COLUMNS: Record<string, string[]> = { reminder_settings: ['feed_token', 'push_subscription'], hoyolab_links: ['login_secret', 'redeem_secret'] };

export function redact(table: string, rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const secret = SECRET_COLUMNS[table];
  if (!secret) return rows;
  return rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, secret.includes(k) && v !== null ? '(left out: secret)' : v])));
}

export const GRACE_DAYS = 30;

/** The row the delete-account function writes. Nothing is removed now. */
export function deletionRequest(userId: string, now: number, reason?: string) {
  return {
    user_id: userId,
    requested_at: new Date(now).toISOString(),
    purge_after: new Date(now + GRACE_DAYS * 86_400_000).toISOString(),
    cancelled_at: null,
    completed_at: null,
    reason: reason ? reason.slice(0, 500) : null,
  };
}

/** The confirmation word the person types, so a stray tap can't start a deletion. */
export const CONFIRM_WORD = 'DELETE';

/** Calendar link tokens: long, random, URL-safe. */
export const isFeedToken = (t: string | null): t is string => typeof t === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(t);
