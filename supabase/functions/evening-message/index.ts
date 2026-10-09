// Supabase Edge Function: the evening message (R51).
// POST (signed in) → builds tonight's message for the caller from the schedule
// snapshot and choices the app saved in reminder_settings, and returns it (the app
// shows it as a preview and as a test notification).
// Sending it to a phone every evening also needs Web Push keys (VAPID) and a
// nightly schedule. Those are not set up yet, so this function says so instead of
// pretending: { push: 'not-set-up' }.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildEveningMessage, readChoices } from '../_shared/evening.ts';
import { requireUser } from '../_shared/requireUser.ts';
import { readSchedule } from '../_shared/schedule.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const user = await requireUser(req.headers.get('Authorization'), { url, key: Deno.env.get('SUPABASE_ANON_KEY') }, (u, init) => fetch(u, init));
  if (!user.ok) return json({ error: 'Sign in to build your evening message.' }, 401);
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'The server is missing its settings.' }, 500);

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await db.from('reminder_settings').select('notify, schedule').eq('user_id', user.userId).maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!data) return json({ error: 'Nothing saved yet. Turn on the evening message in Account → Notifications first.' }, 404);

  const message = buildEveningMessage(readSchedule(data.schedule), readChoices(data.notify), Date.now());
  const pushReady = Boolean(Deno.env.get('VAPID_PUBLIC_KEY') && Deno.env.get('VAPID_PRIVATE_KEY'));
  return json({ message, push: pushReady ? 'ready' : 'not-set-up' });
});
