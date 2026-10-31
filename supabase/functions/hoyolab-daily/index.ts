// Supabase Edge Function: automatic HoYoLAB jobs, once a day.
// 1. Copies today's public code list (hoyo-codes, see _shared/hoyolabAuto.ts) into hoyolab_codes.
// 2. For every saved HoYoLAB account whose owner switched it on: claims the daily
//    check-in for each game it covers, and tries codes it hasn't finished yet.
// Every result (time, ok / error text, reward when HoYoLAB says) goes into
// hoyolab_checkins / hoyolab_redemptions, where the player sees it.
// Started by a daily schedule that sends the project's service key (docs/SETUP.md);
// anyone else gets 401. Login values are read from Vault for the call only and are
// never logged or returned.
import { createHash } from 'node:crypto';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { isScheduler } from '../_shared/backupPlan.ts';
import type { GameBiz } from '../_shared/hoyolab.ts';
import { CODE_SOURCE, parseCodeList, runLinks } from '../_shared/hoyolabAuto.ts';
import { activeLinks, dbStore, saveCodeList, type Db } from '../_shared/hoyolabStore.ts';
import { withoutBanned } from '../_shared/moderation.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const deps = {
  fetch: (url: string, init: { method: 'GET' | 'POST'; headers: Record<string, string>; body?: string }) => fetch(url, { ...init, redirect: 'error' }),
  md5: (s: string) => createHash('md5').update(s).digest('hex'),
  now: () => Date.now(),
  random6: () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => LETTERS[b % LETTERS.length]).join(''),
  uuid: () => crypto.randomUUID(),
  sleep: (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
};

Deno.serve(async (req) => {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!isScheduler(req.headers.get('Authorization'), serviceKey) || !url || !serviceKey) return json({ error: 'Not allowed.' }, 401);
  const started = Date.now();
  const db = createClient(url, serviceKey, { auth: { persistSession: false } }) as unknown as Db;

  // 1. Public code list. A failure here only means no new codes today; check-ins still run.
  const codes: Record<string, number | string> = {};
  for (const gameBiz of ['hkrpg_global', 'nap_global'] as GameBiz[]) {
    try {
      const res = await fetch(CODE_SOURCE.url(gameBiz), { redirect: 'error', headers: { Accept: 'application/json' } });
      if (res.ok) {
        const saved = await saveCodeList(db, gameBiz, parseCodeList(await res.json()), CODE_SOURCE.name, new Date().toISOString());
        codes[gameBiz] = saved.total;
      } else {
        codes[gameBiz] = `list answered ${res.status}`;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      codes[gameBiz] = msg.includes('codes failed') || msg.includes('known codes') ? `save error: ${msg}` : 'list unreachable';
    }
  }

  const saveErrors = Object.entries(codes).filter(([, v]) => typeof v === 'string' && v.startsWith('save error:'));

  // 2. Saved accounts with a switch on. Free-plan functions stop after 150 s, so new work
  // stops at 120 s; whatever is left is picked up by the next run.
  try {
    // A suspended account's saved logins aren't used (T60b).
    const links = await withoutBanned(db, await activeLinks(db));
    const summary = await runLinks(links, dbStore(db), deps, {
      startedBy: 'auto',
      deadline: started + 120_000,
      maxRedemptions: 15,
      jobs: (l) => ({ checkin: l.auto_checkin, redeem: l.auto_redeem }),
    });
    return json({ ok: saveErrors.length === 0, at: new Date(started).toISOString(), accounts: links.length, codes, ...summary, ...(saveErrors.length > 0 ? { error: saveErrors.map(([g, m]) => `${g}: ${m}`).join('; ') } : {}) });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Run failed.', codes }, 500);
  }
});
