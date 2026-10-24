// Supabase Edge Function: findings intake. The external routine (a scheduled Claude Code
// chat that looks for leaks, events and new game data) delivers what it found here.
// It sends its own narrow key in the x-intake-key header (or Authorization: Bearer), checked against the Vault secret
// findings_intake_key: that key can add findings and nothing else (never the service key).
// Request format: docs/ROUTINES.md. Checked all-or-nothing; repeats within 30 days skipped;
// every delivery is recorded as a run of its job ("Delivered N findings", or an error run with
// the routine's message for a job it reports as failed), and the job is expected next at the
// time the routine gives (next_at, self-adjusting), else on its fallback cadence.
import { createHash } from 'node:crypto';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { checkIntakeKey, deliver, INTAKE_LIMITS, intakeKeyFrom, readIntake, type DeliveryDb } from '../_shared/findings.ts';
import type { GameBiz } from '../_shared/hoyolab.ts';
import { redeemFreshCodes, saveCodeList, type Db } from '../_shared/hoyolabStore.ts';
import { findJob } from '../_shared/jobs.ts';
import type { NewFinding } from '../_shared/scheduler.ts';
import { effectiveCadence, nextSlot } from '../_shared/scheduler.ts';

const GAME_TO_BIZ: Record<string, GameBiz> = { hsr: 'hkrpg_global', zzz: 'nap_global' };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const redeemDeps = {
  fetch: (url: string, init: { method: 'GET' | 'POST'; headers: Record<string, string>; body?: string }) => fetch(url, { ...init, redirect: 'error' }),
  md5: (s: string) => createHash('md5').update(s).digest('hex'),
  now: () => Date.now(),
  random6: () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => LETTERS[b % LETTERS.length]).join(''),
  uuid: () => crypto.randomUUID(),
  sleep: (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'The server is missing its settings.' }, 500);

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const check = await checkIntakeKey(intakeKeyFrom(req.headers), {
    ready: () => db.rpc('findings_intake_key_ready'),
    keyOk: (key) => db.rpc('findings_intake_key_ok', { p_key: key }),
  });
  if (!check.ok) return json({ error: check.error }, check.status);

  const text = await req.text();
  if (new TextEncoder().encode(text).length > INTAKE_LIMITS.bodyBytes) return json({ error: `Larger than ${INTAKE_LIMITS.bodyBytes} bytes; split the delivery.` }, 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: 'Not JSON.' }, 400);
  }
  const now = Date.now();
  const intake = readIntake(body, now);
  if (!intake.ok) return json({ error: 'Nothing saved.', problems: intake.problems }, 400);

  // Expected next delivery when the routine gives no next_at: the job's fallback cadence (the
  // owner's override is not read here).
  const nextDue = (jobId: string, at: number) => {
    const job = findJob(jobId);
    return job ? new Date(nextSlot(effectiveCadence(job, undefined).cadence, at)).toISOString() : null;
  };
  try {
    const { saved, addedIds } = await deliver(db as unknown as DeliveryDb, intake.byJob, now, nextDue, intake.failed, intake.nextAt);
    let autoApproved = 0;
    let autoApproveError: string | undefined;
    let notesCreated = 0;
    let notesError: string | undefined;
    if (addedIds.length > 0) {
      const aa = await db.rpc('findings_auto_approve', { p_finding_ids: addedIds });
      if (aa.error) autoApproveError = aa.error.message;
      else if (typeof aa.data === 'number') autoApproved = aa.data;
      // Server-side note creation: Intel notes for every approved finding with a game_id.
      const nn = await db.rpc('findings_create_notes', { p_finding_ids: addedIds });
      if (nn.error) notesError = nn.error.message;
      else if (typeof nn.data === 'number') notesCreated = nn.data;
    }
    let decided = 0;
    let decideError: string | undefined;
    const decisions = readDecisions(body);
    if (decisions.length > 0) {
      const dd = await db.rpc('findings_decide', { p_decisions: decisions });
      if (dd.error) decideError = dd.error.message;
      else if (typeof dd.data === 'number') decided = dd.data;
    }
    const codeResult = await extractCodes(db as unknown as Db, intake.byJob);
    let codesRedeemed: { redemptions: number; stoppedEarly: boolean } | undefined;
    if (codeResult.fresh > 0) {
      try {
        const summary = await redeemFreshCodes(db as unknown as Db, redeemDeps, Date.now() + 120_000);
        if (summary) codesRedeemed = { redemptions: summary.redemptions, stoppedEarly: summary.stoppedEarly };
      } catch { /* redemption failure is non-fatal for the intake */ }
    }
    return json({ ok: true, saved, autoApproved, notesCreated, ...(autoApproveError ? { autoApproveError } : {}), ...(notesError ? { notesError } : {}), ...(decided ? { decided } : {}), ...(decideError ? { decideError } : {}), codesSaved: codeResult.total, freshCodes: codeResult.fresh, ...(codesRedeemed ? { codesRedeemed } : {}) });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Saving failed.' }, 500);
  }
});

/** Read decisions the routine sends to correct earlier findings: [{ id, status, reason?, topic? }]. */
function readDecisions(body: unknown): { id: string; status: string; reason?: string; topic?: string }[] {
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  if (!Array.isArray(b.decisions)) return [];
  const validTopics = ['characters', 'story', 'weapons-items', 'events-modes', 'systems', 'codes', 'other'];
  return b.decisions
    .filter((d): d is Record<string, unknown> => d !== null && typeof d === 'object' && !Array.isArray(d))
    .filter((d) => typeof d.id === 'string' && /^[0-9a-f-]{36}$/.test(d.id) && typeof d.status === 'string' && ['approved', 'dismissed'].includes(d.status))
    .map((d) => ({
      id: d.id as string,
      status: d.status as string,
      ...(typeof d.reason === 'string' && d.reason ? { reason: d.reason } : {}),
      ...(typeof d.topic === 'string' && validTopics.includes(d.topic) ? { topic: d.topic } : {}),
    }));
}

/** Pull redeem codes out of findings' payloads and save them to hoyolab_codes. */
async function extractCodes(db: Db, byJob: Map<string, NewFinding[]>): Promise<{ total: number; fresh: number }> {
  const nowIso = new Date().toISOString();
  let total = 0;
  let fresh = 0;
  for (const findings of byJob.values()) {
    for (const f of findings) {
      const biz = f.game_id ? GAME_TO_BIZ[f.game_id] : undefined;
      if (!biz) continue;
      const p = f.payload as Record<string, unknown>;
      const raw = Array.isArray(p?.codes) ? p.codes : typeof p?.code === 'string' && p.code ? [p.code] : [];
      if (raw.length === 0) continue;
      const list = raw
        .filter((c): c is string => typeof c === 'string' && c.length > 0)
        .map((code) => ({ code, rewards: null }));
      if (list.length > 0) {
        const saved = await saveCodeList(db, biz, list, 'finding', nowIso);
        total += saved.total;
        fresh += saved.fresh;
      }
    }
  }
  return { total, fresh };
}
