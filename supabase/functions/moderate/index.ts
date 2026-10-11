// Supabase Edge Function: Owner console → Users (T60b). Owner only.
//   POST { user_id, action, hours, reason }
//     action: silence | lift_silence | ban | unban | remove | undo_remove
//     hours: 24 | 168 | null (until lifted / permanent)
// The database function public.moderate (migration 0015) runs as the caller, so it checks
// the owner, refuses the owner's own account and other owners, applies the action and logs
// it. Then this sets Supabase Auth's ban on the sign-in (ban_duration), so a banned account
// can't sign in or refresh its session; RLS already refuses its data either way.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { authBan, readRequest } from '../_shared/moderationPlan.ts';
import { requireUser } from '../_shared/requireUser.ts';

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
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = req.headers.get('Authorization');
  const user = await requireUser(authorization, { url, key: anonKey }, (u, init) => fetch(u, init));
  if (!user.ok) return json({ error: 'Sign in as the owner.' }, 401);
  if (!url || !anonKey || !serviceKey) return json({ error: 'The server is missing its settings.' }, 500);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const request = readRequest(body);
  if (typeof request === 'string') return json({ error: request }, 400);

  // As the caller: the database checks the owner and every rule, and writes the log.
  const asCaller = createClient(url, anonKey, { auth: { persistSession: false }, global: { headers: { Authorization: authorization ?? '' } } });
  const { data, error } = await asCaller.rpc('moderate', { p_user: request.user_id, p_action: request.action, p_hours: request.hours, p_reason: request.reason });
  if (error) return json({ error: error.message }, error.code === '42501' ? 403 : 400);

  const ban = authBan(request.action, request.hours);
  if (ban) {
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { error: banError } = await admin.auth.admin.updateUserById(request.user_id, { ban_duration: ban });
    if (banError) return json({ error: `Saved, but the sign-in ban couldn't be set: ${banError.message}. Try again.`, result: data }, 502);
  }
  return json({ result: data });
});
