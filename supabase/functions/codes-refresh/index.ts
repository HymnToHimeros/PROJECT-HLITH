// Supabase Edge Function: refresh the public code list more often than the daily job.
// Fetches hoyo-codes for each game and saves the list to hoyolab_codes. When new codes
// are found, runs a redeem-only pass for accounts with auto_redeem on. Started by the
// scheduler on a shorter cadence so new codes are picked up and tried faster.
import { createHash } from 'node:crypto';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { isScheduler } from '../_shared/backupPlan.ts';
import type { GameBiz } from '../_shared/hoyolab.ts';
import { CODE_SOURCE, parseCodeList } from '../_shared/hoyolabAuto.ts';
import { redeemFreshCodes, saveCodeList, type Db } from '../_shared/hoyolabStore.ts';

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

  const codes: Record<string, number | string> = {};
  let anyFresh = 0;
  for (const gameBiz of ['hkrpg_global', 'nap_global'] as GameBiz[]) {
    try {
      const res = await fetch(CODE_SOURCE.url(gameBiz), { redirect: 'error', headers: { Accept: 'application/json' } });
      if (res.ok) {
        const saved = await saveCodeList(db, gameBiz, parseCodeList(await res.json()), CODE_SOURCE.name, new Date().toISOString());
        codes[gameBiz] = saved.total;
        anyFresh += saved.fresh;
      } else {
        codes[gameBiz] = `list answered ${res.status}`;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      codes[gameBiz] = msg.includes('codes failed') || msg.includes('known codes') ? `save error: ${msg}` : 'list unreachable';
    }
  }

  const saveErrors = Object.entries(codes).filter(([, v]) => typeof v === 'string' && v.startsWith('save error:'));

  let redeemed: { redemptions: number; stoppedEarly: boolean } | undefined;
  if (anyFresh > 0) {
    try {
      const summary = await redeemFreshCodes(db, deps, started + 120_000);
      if (summary) redeemed = { redemptions: summary.redemptions, stoppedEarly: summary.stoppedEarly };
    } catch { /* redemption failure is non-fatal for the code list refresh */ }
  }
  return json({ ok: saveErrors.length === 0, at: new Date().toISOString(), codes, freshCodes: anyFresh, ...(redeemed ? { redeemed } : {}), ...(saveErrors.length > 0 ? { error: saveErrors.map(([g, m]) => `${g}: ${m}`).join('; ') } : {}) });
});
