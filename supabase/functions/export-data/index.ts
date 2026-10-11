// Supabase Edge Function: Export my data (R56).
// Signed-in users only (checked here with requireUser). Returns every row the
// caller owns, table by table, as one JSON file. Reads only; never changes a row.
// Secrets (calendar link token, push address) are left out.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { redact, USER_TABLES } from '../_shared/accountPlan.ts';
import { requireUser } from '../_shared/requireUser.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const PAGE = 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  // A banned or removed account may still download its own data (T60b): read-only, its rows only.
  const user = await requireUser(req.headers.get('Authorization'), { url, key: Deno.env.get('SUPABASE_ANON_KEY') }, (u, init) => fetch(u, init), { allowBanned: true });
  if (!user.ok) return json({ error: 'Sign in to export your data.' }, 401);
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'The server is missing its settings.' }, 500);

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const tables: Record<string, unknown[]> = {};
  for (const table of USER_TABLES) {
    const rows: Record<string, unknown>[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db.from(table).select('*').eq('user_id', user.userId).range(from, from + PAGE - 1);
      if (error) return json({ error: `Reading ${table} failed: ${error.message}` }, 500);
      rows.push(...(data as Record<string, unknown>[]));
      if (data.length < PAGE) break;
    }
    tables[table] = redact(table, rows);
  }
  return json({ app: 'PROJECT-HLITH', kind: 'server-export', version: 1, exportedAt: new Date().toISOString(), userId: user.userId, tables });
});
