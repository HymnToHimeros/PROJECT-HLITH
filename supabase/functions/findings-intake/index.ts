// Supabase Edge Function: findings intake. The external routine (a scheduled Claude Code
// chat that looks for leaks, events and new game data) delivers what it found here.
// It sends its own narrow key in the x-intake-key header, checked against the Vault secret
// findings_intake_key: that key can add findings and nothing else (never the service key).
// Request format: docs/ROUTINES.md. Checked all-or-nothing; repeats within 30 days skipped;
// every delivery is recorded as a run of its job ("Delivered N findings").
import { createClient } from 'npm:@supabase/supabase-js@2';
import { deliver, INTAKE_HEADER, INTAKE_LIMITS, MIN_KEY_LENGTH, readIntake, type DeliveryDb } from '../_shared/findings.ts';
import { findJob } from '../_shared/jobs.ts';
import { effectiveCadence, nextSlot } from '../_shared/scheduler.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'The server is missing its settings.' }, 500);

  const key = req.headers.get(INTAKE_HEADER) ?? '';
  if (key.length < MIN_KEY_LENGTH) return json({ error: 'Not allowed.' }, 401);
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const ok = await db.rpc('findings_intake_key_ok', { p_key: key });
  if (ok.error || ok.data !== true) return json({ error: 'Not allowed.' }, 401);

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

  // Expected next delivery, from the job's cadence (the owner's override is not read here: the
  // Owner console works it out again from the row).
  const nextDue = (jobId: string, at: number) => {
    const job = findJob(jobId);
    return job ? new Date(nextSlot(effectiveCadence(job, undefined).cadence, at)).toISOString() : null;
  };
  try {
    const saved = await deliver(db as unknown as DeliveryDb, intake.byJob, now, nextDue);
    return json({ ok: true, saved });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Saving failed.' }, 500);
  }
});
