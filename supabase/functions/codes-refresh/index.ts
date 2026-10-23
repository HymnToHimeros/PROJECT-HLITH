// Supabase Edge Function: refresh the public code list more often than the daily job.
// Fetches hoyo-codes for each game and saves the list to hoyolab_codes. Does NOT do
// check-ins or redemptions (that stays in hoyolab-daily). Started by the scheduler on
// a shorter cadence so new codes are picked up faster.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { isScheduler } from '../_shared/backupPlan.ts';
import type { GameBiz } from '../_shared/hoyolab.ts';
import { CODE_SOURCE, parseCodeList } from '../_shared/hoyolabAuto.ts';
import { saveCodeList, type Db } from '../_shared/hoyolabStore.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!isScheduler(req.headers.get('Authorization'), serviceKey) || !url || !serviceKey) return json({ error: 'Not allowed.' }, 401);
  const db = createClient(url, serviceKey, { auth: { persistSession: false } }) as unknown as Db;

  const codes: Record<string, number | string> = {};
  for (const gameBiz of ['hkrpg_global', 'nap_global'] as GameBiz[]) {
    try {
      const res = await fetch(CODE_SOURCE.url(gameBiz), { redirect: 'error', headers: { Accept: 'application/json' } });
      codes[gameBiz] = res.ok ? await saveCodeList(db, gameBiz, parseCodeList(await res.json()), CODE_SOURCE.name, new Date().toISOString()) : `list answered ${res.status}`;
    } catch {
      codes[gameBiz] = 'list unreachable';
    }
  }
  return json({ ok: true, at: new Date().toISOString(), codes });
});
