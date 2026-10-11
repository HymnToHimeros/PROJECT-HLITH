/**
 * Owner console → Users (T60b): what each moderation action does to the sign-in itself.
 * Pure: shared by the moderate function and the tests. The database (public.moderate,
 * migration 0015) decides who may act and keeps the log; this adds Supabase Auth's own ban,
 * so a banned account can't sign in or refresh its session either.
 */

export const ACTIONS = ['silence', 'lift_silence', 'ban', 'unban', 'remove', 'undo_remove'] as const;
export type Action = (typeof ACTIONS)[number];

/** 24 hours, 7 days, or null: until lifted (silence) / permanent (ban). */
export const HOURS = [24, 168, null] as const;
export type Hours = (typeof HOURS)[number];

/** Supabase Auth has no "forever": a ban of 100 years stands in for permanent. */
export const FOREVER = '876000h';

/** The ban_duration to set on the sign-in, or null when the sign-in isn't touched. */
export function authBan(action: Action, hours: Hours): string | null {
  switch (action) {
    case 'ban':
      return hours === null ? FOREVER : `${hours}h`;
    case 'remove':
      return FOREVER;
    case 'unban':
    case 'undo_remove':
      return 'none';
    default:
      return null;
  }
}

export interface ModerateRequest {
  user_id: string;
  action: Action;
  hours: Hours;
  reason: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Checks the request body; returns the request or what's wrong with it. */
export function readRequest(body: unknown): ModerateRequest | string {
  if (!body || typeof body !== 'object') return 'Send JSON: { user_id, action, hours, reason }';
  const b = body as Record<string, unknown>;
  if (typeof b.user_id !== 'string' || !UUID.test(b.user_id)) return 'Which account? user_id is missing.';
  if (!ACTIONS.includes(b.action as Action)) return `Unknown action. Use ${ACTIONS.join(', ')}.`;
  const hours = b.hours === undefined ? null : b.hours;
  if (!HOURS.includes(hours as Hours)) return 'Pick 24 hours, 7 days or no end.';
  const reason = typeof b.reason === 'string' ? b.reason.trim().slice(0, 300) : '';
  return { user_id: b.user_id, action: b.action as Action, hours: hours as Hours, reason };
}
