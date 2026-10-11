// Supabase Edge Function: Delete my account (R57).
// Signed-in users only. "User data is never wiped" on a whim: this records a
// deletion request with a 30-day grace period instead of removing rows. During
// the grace period the person can export everything and cancel ("Keep my account").
// After it, the owner completes the deletion with the service role, outside this function.
//   POST { action: 'status' }                       → the current request, if any
//   POST { action: 'request', confirm: 'DELETE' }   → start (or restart) the grace period
//   POST { action: 'cancel' }                       → keep the account
import { createClient } from 'npm:@supabase/supabase-js@2';
import { CONFIRM_WORD, deletionRequest } from '../_shared/accountPlan.ts';
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
  // Saying no stays possible before the first-run steps are done (T62).
  const user = await requireUser(req.headers.get('Authorization'), { url, key: Deno.env.get('SUPABASE_ANON_KEY') }, (u, init) => fetch(u, init), { allowUnaccepted: true });
  if (!user.ok) return json({ error: 'Sign in to manage your account.' }, 401);
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'The server is missing its settings.' }, 500);

  let body: { action?: unknown; confirm?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Send JSON: { action }' }, 400);
  }
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const table = db.from('account_deletion_requests');

  if (body.action === 'status') {
    const { data, error } = await table.select('*').eq('user_id', user.userId).maybeSingle();
    if (error) return json({ error: error.message }, 500);
    return json({ request: data });
  }
  if (body.action === 'request') {
    if (body.confirm !== CONFIRM_WORD) return json({ error: `Type ${CONFIRM_WORD} to confirm.` }, 400);
    const row = deletionRequest(user.userId, Date.now(), typeof body.reason === 'string' ? body.reason : undefined);
    const { data, error } = await table.upsert(row).select('*').single();
    if (error) return json({ error: error.message }, 500);
    return json({ request: data });
  }
  if (body.action === 'cancel') {
    const { data, error } = await table.update({ cancelled_at: new Date().toISOString() }).eq('user_id', user.userId).is('completed_at', null).select('*').maybeSingle();
    if (error) return json({ error: error.message }, 500);
    return json({ request: data });
  }
  return json({ error: 'Unknown action. Use status, request or cancel.' }, 400);
});
