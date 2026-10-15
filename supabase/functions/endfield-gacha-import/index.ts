// Supabase Edge Function: read pull history from an Endfield webview link
// OR from an account_token obtained via web sign-in.
// Signed-in users only (checked here with requireUser). Contacts only Endfield's
// gacha record hosts and auth hosts. Returns raw rows; the app maps them with the
// game's historyMapping and stores them with row-level security, adding only new
// pull ids.
import { fetchHistory, LINK_ERROR_TEXT, parseLink } from '../_shared/endfieldGachaLog.ts';
import { EXCHANGE_ERROR_TEXT, exchangeForU8Token } from '../_shared/endfieldWebSignin.ts';
import { requireUser } from '../_shared/requireUser.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

function extractToken(raw: string): string | null {
  // The user might paste the whole JSON from the token URL, or just the token string.
  try {
    const parsed = JSON.parse(raw);
    const t = parsed?.data?.token ?? parsed?.token;
    if (typeof t === 'string' && t.trim()) return t.trim();
  } catch {
    // Not JSON — treat as a raw token string.
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const user = await requireUser(
    req.headers.get('Authorization'),
    { url: Deno.env.get('SUPABASE_URL'), key: Deno.env.get('SUPABASE_ANON_KEY') },
    (url, init) => fetch(url, init),
  );
  if (!user.ok) return json({ error: 'Sign in to import your history.' }, 401);
  let body: { link?: unknown; accountToken?: unknown; region?: unknown; knownIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Send JSON: { link } or { accountToken, region }' }, 400);
  }

  const known = Array.isArray(body.knownIds) ? new Set(body.knownIds.filter((x): x is string => typeof x === 'string').slice(0, 200_000)) : undefined;
  const pause = () => new Promise<void>((r) => setTimeout(r, 500));

  // Path A: account_token web sign-in
  if (typeof body.accountToken === 'string' && body.accountToken.trim()) {
    const region = body.region === 'cn' ? 'cn' as const : 'global' as const;
    const rawToken = extractToken(body.accountToken.trim());
    if (!rawToken) return json({ error: 'No token found in that text. Copy the whole page from the token URL.' }, 400);
    const exchanged = await exchangeForU8Token(rawToken, region, { fetch: (url, init) => fetch(url, init) });
    if (!exchanged.ok) return json({ error: EXCHANGE_ERROR_TEXT[exchanged.error], code: exchanged.error }, exchanged.error === 'expired' ? 401 : 502);
    const result = await fetchHistory(exchanged.link, (url) => fetch(url), { ...(known ? { stopAtIds: known } : {}), pause });
    if (!result.ok) return json({ error: LINK_ERROR_TEXT[result.error], code: result.error, detail: result.message }, 502);
    return json({ ...result.result, uid: exchanged.uid });
  }

  // Path B: pasted webview link
  const parsed = parseLink(typeof body.link === 'string' ? body.link.slice(0, 20_000) : '');
  if (!parsed.ok) return json({ error: LINK_ERROR_TEXT[parsed.error], code: parsed.error }, 400);
  const result = await fetchHistory(parsed.link, (url) => fetch(url), { ...(known ? { stopAtIds: known } : {}), pause });
  if (!result.ok) return json({ error: LINK_ERROR_TEXT[result.error], code: result.error, detail: result.message }, 502);
  return json(result.result);
});
