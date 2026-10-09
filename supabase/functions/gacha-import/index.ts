// Supabase Edge Function: read pull history from an in-game history link.
// Signed-in users only (checked here with requireUser). Contacts only HoYoverse's gacha log hosts.
// Returns raw rows; the app maps them with the game's historyMapping and stores
// them with row-level security, adding only new pull ids.
import { fetchHistory, LINK_ERROR_TEXT, parseLink } from '../_shared/hoyoGachaLog.ts';
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
  const user = await requireUser(
    req.headers.get('Authorization'),
    { url: Deno.env.get('SUPABASE_URL'), key: Deno.env.get('SUPABASE_ANON_KEY') },
    (url, init) => fetch(url, init),
  );
  if (!user.ok) return json({ error: 'Sign in to import your history.' }, 401);
  let body: { link?: unknown; knownIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Send JSON: { link }' }, 400);
  }
  const parsed = parseLink(typeof body.link === 'string' ? body.link.slice(0, 20_000) : '');
  if (!parsed.ok) return json({ error: LINK_ERROR_TEXT[parsed.error], code: parsed.error }, 400);
  const known = Array.isArray(body.knownIds) ? new Set(body.knownIds.filter((x): x is string => typeof x === 'string').slice(0, 200_000)) : undefined;
  const result = await fetchHistory(parsed.link, (url) => fetch(url), {
    ...(known ? { stopAtIds: known } : {}),
    pause: () => new Promise((r) => setTimeout(r, 300)),
  });
  if (!result.ok) return json({ error: LINK_ERROR_TEXT[result.error], code: result.error, detail: result.message }, 502);
  return json(result.result);
});
