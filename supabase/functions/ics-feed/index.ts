// Supabase Edge Function: calendar feed (R52).
// GET /ics-feed?token=… returns an .ics calendar: your daily and weekly resets
// (for the servers you chose) plus the real banner, event and endgame dates the
// app saved, and your plans. Calendar apps can't sign in, so the long random token
// in the link is the key; "New link" in Account → Notifications replaces it and
// "Switch off" stops it. Reads only.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { isFeedToken } from '../_shared/accountPlan.ts';
import { bannedAmong } from '../_shared/moderation.ts';
import { buildIcs } from '../_shared/ics.ts';
import { readSchedule } from '../_shared/schedule.ts';

const text = (body: string, status: number) => new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

Deno.serve(async (req) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return text('GET only', 405);
  const token = new URL(req.url).searchParams.get('token');
  if (!isFeedToken(token)) return text('This calendar link is not valid.', 404);
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return text('The server is missing its settings.', 500);

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await db.from('reminder_settings').select('user_id, schedule, feed_enabled').eq('feed_token', token).maybeSingle();
  if (error) return text('Could not read the calendar right now.', 500);
  if (!data || !data.feed_enabled) return text('This calendar link was switched off or replaced.', 404);
  // The link is the key, so it never passes requireUser: a suspended account's feed stops here (T60b).
  try {
    if ((await bannedAmong(db, [String(data.user_id)])).size) return text('This calendar is paused.', 403);
  } catch {
    return text('Could not read the calendar right now.', 500);
  }

  const ics = buildIcs(readSchedule(data.schedule), Date.now());
  return new Response(req.method === 'HEAD' ? null : ics, {
    status: 200,
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="HLITH.ics"', 'Cache-Control': 'private, max-age=3600' },
  });
});
