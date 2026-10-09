// Supabase Edge Function: the scheduler. One entry point for every fixed job.
// Started every 15 minutes by ONE database cron job (supabase/migrations/0005_scheduler.sql),
// which sends the key kept in Vault as scheduler_key (checked by scheduler_key_ok, 0006). Each run reads the job list
// (_shared/jobs.ts), runs the jobs that are due inside a time budget, never two copies
// of the same job (lock row), and records every run in scheduler_runs.
// An owner can also start one job now from the Owner console: { job: "<id>" }.
// Anyone else gets 401.
//   POST {}                 (cron)   → runs every due job
//   POST { job: "backup" }  (owner)  → runs that job now
// The answer comes at once (202); the work carries on in the background and its result
// appears in the run log.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { saveFindings, type FindingsDb } from '../_shared/findings.ts';
import { findJob } from '../_shared/jobs.ts';
import { callJobFunction, ownerByToken, runScheduler, whoCalls, type JobRow, type SchedulerStore } from '../_shared/scheduler.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

/** Supabase's runtime keeps a function alive for work handed to waitUntil after the answer is sent. */
const runtime = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !serviceKey) return json({ error: 'The server is missing its settings.' }, 500);

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const caller = await whoCalls(
    req.headers.get('Authorization'),
    serviceKey,
    (token) => ownerByToken(token, { url, anonKey }, (u, init) => fetch(u, init)),
    async (token) => {
      const ok = await db.rpc('scheduler_key_ok', { p_key: token });
      return !ok.error && ok.data === true;
    },
  );
  if (caller === 'nobody') return json({ error: 'Not allowed.' }, 401);

  let body: { job?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // cron may send an empty body
  }
  const only = typeof body.job === 'string' ? body.job : undefined;
  if (caller === 'owner' && !only) return json({ error: 'Send { job: "<id>" } to run one job now.' }, 400);
  if (only && !findJob(only)) return json({ error: `No job called “${only}”.` }, 400);

  const store: SchedulerStore = {
    async register(ids) {
      const { error } = await db.from('scheduler_jobs').upsert(
        ids.map((id) => ({ id })),
        { onConflict: 'id', ignoreDuplicates: true },
      );
      if (error) throw new Error(`Registering jobs failed: ${error.message}`);
    },
    async rows() {
      const { data, error } = await db.from('scheduler_jobs').select('id,enabled,cadence,last_run_at');
      if (error) throw new Error(`Reading jobs failed: ${error.message}`);
      return (data ?? []) as JobRow[];
    },
    async takeLock(id, now, until, notRunSince) {
      const { data, error } = await db.rpc('scheduler_take_lock', { p_job: id, p_now: now, p_until: until, p_not_run_since: notRunSince });
      if (error) throw new Error(`Taking the lock failed: ${error.message}`);
      return data === 'taken' || data === 'busy' ? data : 'already-ran';
    },
    async finish(id, patch) {
      const { error } = await db
        .from('scheduler_jobs')
        .update({ ...patch, lock_until: null })
        .eq('id', id);
      if (error) throw new Error(`Saving the result failed: ${error.message}`);
    },
    async recordRun(run) {
      const { error } = await db.from('scheduler_runs').insert(run);
      if (error) throw new Error(`Recording the run failed: ${error.message}`);
    },
    async addFindings(jobId, findings) {
      return (await saveFindings(db as unknown as FindingsDb, jobId, findings, 'scheduler', Date.now())).added;
    },
  };

  const work = runScheduler(
    { store, now: () => Date.now(), runJob: (job, timeoutMs) => (job.target.kind === 'function' ? callJobFunction((u, init) => fetch(u, init), url, serviceKey, job.target.name, timeoutMs) : Promise.reject(new Error('Nothing to call.'))) },
    { startedBy: caller, ...(only ? { only } : {}) },
  ).catch((e: unknown) => ({ error: e instanceof Error ? e.message : 'Run failed.' }));

  if (runtime) {
    runtime.waitUntil(work);
    return json({ started: true, by: caller, job: only ?? null }, 202);
  }
  return json(await work);
});
