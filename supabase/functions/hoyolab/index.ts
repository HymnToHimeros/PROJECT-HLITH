// Supabase Edge Function: read the caller's own HoYoLAB data (live stamina,
// daily check-in, characters for roster import, endgame records).
// Signed-in users only (checked here with requireUser). Contacts only the
// HoYoLAB hosts listed in _shared/hoyolab.ts.
//
// The player's HoYoLAB login values arrive in the request body over HTTPS, are
// used for this one request, and are never logged, stored or sent back.
// Nothing in this file may print the request body or the headers.
//
// Pull history is not read here (CLAUDE.md Override 2).
import { createHash } from 'node:crypto';
import { ERROR_TEXT, parseRequest, readHoyolab } from '../_shared/hoyolab.ts';
import { requireUser } from '../_shared/requireUser.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const random6 = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => LETTERS[b % LETTERS.length]).join('');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const user = await requireUser(
    req.headers.get('Authorization'),
    { url: Deno.env.get('SUPABASE_URL'), key: Deno.env.get('SUPABASE_ANON_KEY') },
    (url, init) => fetch(url, init),
  );
  if (!user.ok) return json({ error: 'Sign in to use the HoYoLAB link.' }, 401);

  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > 10_000) return json({ error: ERROR_TEXT['bad-request'], code: 'bad-request' }, 400);
    body = JSON.parse(text);
  } catch {
    return json({ error: 'Send JSON: { gameBiz, login, want }', code: 'bad-request' }, 400);
  }
  const parsed = parseRequest(body);
  if (!parsed.ok) return json({ error: ERROR_TEXT[parsed.error], code: parsed.error }, 400);

  const result = await readHoyolab(parsed.request, {
    fetch: (url, init) => fetch(url, { ...init, redirect: 'error' }),
    md5: (s) => createHash('md5').update(s).digest('hex'),
    now: () => Date.now(),
    random6,
  });
  if (!result.ok) {
    const status = result.error === 'pick-uid' ? 409 : result.error === 'login' || result.error === 'private' || result.error === 'no-account' ? 400 : 502;
    return json({ error: ERROR_TEXT[result.error], code: result.error, ...(result.accounts ? { accounts: result.accounts } : {}) }, status);
  }
  return json(result.answer);
});
