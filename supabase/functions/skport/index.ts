// Supabase Edge Function: the caller's own SKPort data (sanity/stamina, check-in,
// account level) for Arknights: Endfield. Signed-in users only (checked with requireUser).
// Contacts only the hosts in _shared/skport.ts (zonai.skport.com, as.gryphline.com).
//
// The player's ACCOUNT_TOKEN is used for one request (or the request names a saved
// account and the server reads the token from Vault). Token values are never logged,
// never sent back, and stored only in Vault (migration 0022). Nothing in this file
// may print the request body or the headers.
import { createHash, createHmac } from 'node:crypto';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { ERROR_TEXT, parseRequest, readSkport, type BoundRole, type SkportError } from '../_shared/skport.ts';
import { requireUser } from '../_shared/requireUser.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

interface Db {
  rpc(fn: string, params: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
}

const deps = {
  fetch: (url: string, init: { method: string; headers: Record<string, string>; body?: string }) =>
    fetch(url, { ...init, redirect: 'error' }),
  hmacSha256: async (key: string, data: string): Promise<string> => {
    return createHmac('sha256', key).update(data).digest('hex');
  },
  md5: (s: string) => createHash('md5').update(s).digest('hex'),
  now: () => Date.now(),
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const user = await requireUser(req.headers.get('Authorization'), { url, key: Deno.env.get('SUPABASE_ANON_KEY') }, (u, init) => fetch(u, init));
  if (!user.ok) return json({ error: 'Sign in to use the SKPort link.' }, 401);
  const userId = user.userId;

  let body: Record<string, unknown>;
  try {
    const text = await req.text();
    if (text.length > 10_000) return json({ error: ERROR_TEXT['bad-request'], code: 'bad-request' }, 400);
    const parsed: unknown = JSON.parse(text);
    body = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return json({ error: 'Send JSON: { accountToken, want }', code: 'bad-request' }, 400);
  }

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const db: Db | null = url && serviceKey ? (createClient(url, serviceKey, { auth: { persistSession: false } }) as unknown as Db) : null;

  // ── Actions on saved accounts ──
  if (typeof body.action === 'string') {
    if (!db) return json({ error: 'The server is missing its settings.' }, 500);
    const action = body.action;

    if (action === 'save') {
      const accountToken = typeof body.accountToken === 'string' ? body.accountToken.trim() : '';
      if (!accountToken) return json({ error: ERROR_TEXT['bad-request'], code: 'bad-request' }, 400);
      const label = typeof body.label === 'string' ? body.label.trim() || 'Main' : 'Main';
      const linkId = typeof body.linkId === 'string' ? body.linkId : null;
      const uid = typeof body.uid === 'string' ? body.uid : undefined;

      const result = await readSkport({ accountToken, want: ['account'], uid }, deps);
      if (!result.ok) {
        const roles = 'roles' in result ? (result as { roles?: BoundRole[] }).roles : undefined;
        return json({ error: ERROR_TEXT[result.error], code: result.error, ...(roles ? { roles } : {}) }, errorStatus(result.error));
      }
      const account = result.answer.account;

      const saved = await db.rpc('skport_link_save', {
        p_user: userId,
        p_link: linkId,
        p_label: label,
        p_skport_uid: account.uid,
        p_server: account.server,
        p_nickname: account.nickname,
        p_token: accountToken,
      });
      if (saved.error) return json({ error: 'Saving failed. Nothing was stored. Try again.' }, 500);
      return json({ linkId: saved.data, account });
    }

    if (action === 'forget') {
      const linkId = typeof body.linkId === 'string' ? body.linkId : '';
      if (!linkId) return json({ error: ERROR_TEXT['bad-request'], code: 'bad-request' }, 400);
      const r = await db.rpc('skport_link_forget', { p_link: linkId });
      if (r.error) return json({ error: 'Could not forget the account. Try again.' }, 500);
      return json({ ok: true });
    }

    return json({ error: `Unknown action: ${String(action)}`, code: 'bad-request' }, 400);
  }

  // ── Plain reading (pasted token, or a saved account by linkId) ──
  if (typeof body.linkId === 'string') {
    if (!db) return json({ error: 'The server is missing its settings.' }, 500);
    const linkId = body.linkId;
    const a = await db.rpc('skport_link_secret', { p_link: linkId });
    const o = a.data && typeof a.data === 'object' ? (a.data as Record<string, unknown>) : null;
    if (a.error || !o || o.user_id !== userId || typeof o.token !== 'string') {
      return json({ error: 'This saved account can\'t be used: it was forgotten, or it isn\'t yours. Add the token again.', code: 'login' }, 400);
    }
    body = { ...body, accountToken: o.token };
  }

  const parsed = parseRequest(body);
  if (!parsed.ok) return json({ error: ERROR_TEXT[parsed.error], code: parsed.error }, 400);

  const result = await readSkport(parsed.request, deps);
  if (!result.ok) {
    const roles = 'roles' in result ? (result as { roles?: BoundRole[] }).roles : undefined;
    return json({ error: ERROR_TEXT[result.error], code: result.error, ...(roles ? { roles } : {}) }, errorStatus(result.error));
  }
  return json(result.answer);
});

function errorStatus(error: SkportError): number {
  if (error === 'pick-role') return 409;
  if (error === 'bad-request') return 400;
  if (error === 'login' || error === 'expired' || error === 'no-account') return 400;
  if (error === 'busy') return 429;
  return 502;
}
