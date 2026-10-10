// Supabase Edge Function: the caller's own HoYoLAB data and saved HoYoLAB accounts.
// Signed-in users only (checked here with requireUser). Contacts only the HoYoLAB /
// HoYoverse hosts listed in _shared/hoyolab.ts and _shared/hoyolabAuto.ts.
//
// Plain reading (live stamina, check-in, characters, endgame): the login arrives in
// the request body over HTTPS and is used for this one request, or the request names
// a saved account (linkId) and the server reads that login from Vault.
// Actions (body.action): save a login on the server, add/clear the code login, run
// the check-in and codes now, add pasted codes. See _shared/hoyolabLinks.ts.
//
// Login values are never logged, never sent back, and stored only in Vault
// (migration 0003). Nothing in this file may print the request body or the headers.
// Pull history is not read here (CLAUDE.md Override 2).
import { createHash } from 'node:crypto';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { checkLogin, ERROR_TEXT, findAccounts, parseRequest, readHoyolab, type FoundAccount, type GameBiz } from '../_shared/hoyolab.ts';
import { checkinRecord, codeLoginMismatch, runLinks } from '../_shared/hoyolabAuto.ts';
import { ACTION_ERROR_TEXT, parseAction, storedGames } from '../_shared/hoyolabLinks.ts';
import { activeLinks, dbStore, type Db } from '../_shared/hoyolabStore.ts';
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
const deps = {
  fetch: (url: string, init: { method: 'GET' | 'POST'; headers: Record<string, string>; body?: string }) => fetch(url, { ...init, redirect: 'error' }),
  md5: (s: string) => createHash('md5').update(s).digest('hex'),
  now: () => Date.now(),
  random6,
  uuid: () => crypto.randomUUID(),
  sleep: (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const user = await requireUser(req.headers.get('Authorization'), { url, key: Deno.env.get('SUPABASE_ANON_KEY') }, (u, init) => fetch(u, init));
  if (!user.ok) return json({ error: 'Sign in to use the HoYoLAB link.' }, 401);
  const userId = user.userId;

  let body: Record<string, unknown>;
  try {
    const text = await req.text();
    if (text.length > 10_000) return json({ error: ERROR_TEXT['bad-request'], code: 'bad-request' }, 400);
    const parsed: unknown = JSON.parse(text);
    body = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return json({ error: 'Send JSON: { gameBiz, login, want }', code: 'bad-request' }, 400);
  }

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const db = url && serviceKey ? (createClient(url, serviceKey, { auth: { persistSession: false } }) as unknown as Db) : null;
  const store = db ? dbStore(db) : null;

  /** The saved login of one of the caller's accounts, or null. */
  const savedLogin = async (linkId: string) => {
    if (!db) return null;
    const a = await db.rpc('hoyolab_link_secret', { p_link: linkId });
    const o = a.data && typeof a.data === 'object' ? (a.data as Record<string, unknown>) : null;
    if (a.error || !o || o.user_id !== userId || typeof o.login !== 'string') return null;
    try {
      return checkLogin(JSON.parse(o.login));
    } catch {
      return null;
    }
  };

  // ── Actions on saved accounts ──
  const act = parseAction(body);
  if (act) {
    if (!act.ok) return json({ error: ACTION_ERROR_TEXT[act.error], code: act.error }, 400);
    if (!db || !store) return json({ error: 'The server is missing its settings.' }, 500);
    const a = act.action;

    if (a.action === 'save') {
      const found: Partial<Record<GameBiz, FoundAccount[]>> = {};
      for (const g of a.games) {
        const r = await findAccounts(a.login, g, deps);
        if (!r.ok) return json({ error: ERROR_TEXT[r.error], code: r.error }, r.error === 'login' ? 400 : 502);
        found[g] = r.accounts;
      }
      const games = storedGames(found);
      if (!games.length) return json({ error: ERROR_TEXT['no-account'], code: 'no-account' }, 400);
      const saved = await db.rpc('hoyolab_link_save', {
        p_user: userId,
        p_link: a.linkId,
        p_label: a.label,
        p_hoyolab_id: a.login.ltuid_v2,
        p_games: games,
        p_login: JSON.stringify(a.login),
      });
      if (saved.error) return json({ error: 'Saving failed. Nothing was stored. Try again.' }, 500);
      return json({ linkId: saved.data, games });
    }

    if (a.action === 'redeem-login') {
      // A code login from another account would only ever be refused by HoYoverse: stop it here.
      if (a.redeem && codeLoginMismatch(await savedLogin(a.linkId), a.redeem)) return json({ error: ACTION_ERROR_TEXT['redeem-other-account'], code: 'redeem-other-account' }, 400);
      const r = await db.rpc('hoyolab_link_set_redeem', { p_user: userId, p_link: a.linkId, p_redeem: a.redeem ? JSON.stringify(a.redeem) : null });
      if (r.error) return json({ error: 'Saving failed. Nothing was stored. Try again.' }, 500);
      return json({ ok: true });
    }

    if (a.action === 'add-codes') {
      const r = await db
        .from('hoyolab_my_codes')
        .upsert(
          a.codes.map((code) => ({ user_id: userId, game_biz: a.gameBiz, code })),
          { onConflict: 'user_id,game_biz,code', ignoreDuplicates: true },
        );
      if (r.error) return json({ error: 'Saving the codes failed. Try again.' }, 500);
      return json({ ok: true, codes: a.codes });
    }

    // run: the same work as the daily schedule, for this player only, right now.
    const links = (await activeLinks(db, userId)).filter((l) => !a.linkId || l.id === a.linkId);
    const summary = await runLinks(links, store, deps, {
      startedBy: 'manual',
      deadline: Date.now() + 100_000,
      maxRedemptions: 12,
      jobs: () => ({ checkin: a.checkin, redeem: a.redeem }),
    });
    return json({ ok: true, ...summary });
  }

  // ── Plain reading (pasted login, or a saved account by linkId) ──
  let linkId: string | null = null;
  if (typeof body.linkId === 'string') {
    linkId = body.linkId;
    const login = await savedLogin(linkId);
    if (!login) return json({ error: 'This saved account can’t be used: it was forgotten, or it isn’t yours. Add the login again.', code: 'login' }, 400);
    body = { ...body, login };
  }
  const parsed = parseRequest(body);
  if (!parsed.ok) return json({ error: ERROR_TEXT[parsed.error], code: parsed.error }, 400);

  const result = await readHoyolab(parsed.request, deps);
  // A check-in claimed with a saved account is recorded like the automatic one.
  if (linkId && store && parsed.request.claim && parsed.request.want.includes('checkin')) {
    await store.recordCheckin({ user_id: userId, link_id: linkId, game_biz: parsed.request.gameBiz, started_by: 'manual', ...checkinRecord(result) }).catch(() => undefined);
  }
  if (!result.ok) {
    const status = result.error === 'pick-uid' ? 409 : result.error === 'login' || result.error === 'private' || result.error === 'no-account' ? 400 : 502;
    return json({ error: ERROR_TEXT[result.error], code: result.error, ...(result.accounts ? { accounts: result.accounts } : {}) }, status);
  }
  return json(result.answer);
});
