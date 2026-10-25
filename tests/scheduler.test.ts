// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { checkIntakeKey, deliver, INTAKE_NOT_READY, intakeKeyFrom, isDecisionsOnly, readDecisions, readIntake, saveFindings, type DeliveryDb } from '../supabase/functions/_shared/findings.ts';
import { EXTERNAL_JOB_IDS, FRAME_MESSAGE, JOBS, runnerOf, SELF_ADJUSTING, type JobDef } from '../supabase/functions/_shared/jobs.ts';
import {
  callJobFunction,
  dedupeKey,
  describeCadence,
  dueJobs,
  effectiveCadence,
  externalNext,
  lastSlot,
  lockFree,
  nextSlot,
  ownerByToken,
  parseCadence,
  readFindings,
  runnable,
  runScheduler,
  whoCalls,
  type JobResult,
  type JobRow,
  type NewFinding,
  type RunRecord,
  type SchedulerStore,
} from '../supabase/functions/_shared/scheduler.ts';

const at = (s: string) => Date.parse(s);
function must<T>(x: T | null | undefined): T {
  if (x === null || x === undefined) throw new Error('missing');
  return x;
}
// Friday 9 Oct 2026.
const FRI_1700 = at('2026-10-09T17:00:00Z');

describe('cadence', () => {
  it('reads the three forms and refuses anything else', () => {
    expect(parseCadence('daily 16:10')).toEqual({ kind: 'daily', minute: 970 });
    expect(parseCadence('Mon,Wed,Fri 06:00')).toEqual({ kind: 'weekly', days: [1, 3, 5], minute: 360 });
    expect(parseCadence('every 6h')).toEqual({ kind: 'every', hours: 6 });
    for (const bad of ['', 'daily', 'daily 25:00', 'daily 10:61', 'funday 06:00', 'every 0h', '*/15 * * * *']) expect(parseCadence(bad)).toBeNull();
  });

  it('says it in plain English', () => {
    expect(describeCadence(must(parseCadence('daily 16:10')))).toBe('Daily at 16:10 UTC');
    expect(describeCadence(must(parseCadence('fri,mon,wed 06:00')))).toBe('Mon, Wed, Fri at 06:00 UTC');
    expect(describeCadence(must(parseCadence('every 1h')))).toBe('Every hour');
  });

  it('finds the latest and next slot', () => {
    const daily = must(parseCadence('daily 16:10'));
    expect(lastSlot(daily, FRI_1700)).toBe(at('2026-10-09T16:10:00Z'));
    expect(lastSlot(daily, at('2026-10-09T16:00:00Z'))).toBe(at('2026-10-08T16:10:00Z'));
    expect(nextSlot(daily, FRI_1700)).toBe(at('2026-10-10T16:10:00Z'));
    expect(nextSlot(daily, at('2026-10-09T16:10:00Z'))).toBe(at('2026-10-10T16:10:00Z')); // strictly after
    const mwf = must(parseCadence('mon,wed,fri 06:00'));
    expect(lastSlot(mwf, at('2026-10-11T12:00:00Z'))).toBe(at('2026-10-09T06:00:00Z')); // Sunday → Friday
    expect(nextSlot(mwf, FRI_1700)).toBe(at('2026-10-12T06:00:00Z')); // → Monday
    const six = must(parseCadence('every 6h'));
    expect(lastSlot(six, FRI_1700)).toBe(at('2026-10-09T12:00:00Z'));
    expect(nextSlot(six, FRI_1700)).toBe(at('2026-10-09T18:00:00Z'));
  });

  it('every job in the list has a cadence that reads (self-adjusting ones: their fallback reads)', () => {
    for (const j of JOBS) {
      if (j.cadence === SELF_ADJUSTING) {
        expect(j.target.kind, j.id).toBe('external');
        expect(parseCadence(j.fallbackCadence ?? ''), `${j.id} fallback`).not.toBeNull();
      } else expect(parseCadence(j.cadence), j.id).not.toBeNull();
    }
  });

  it('a broken owner override falls back to the default and says so', () => {
    const job = must(JOBS.find((j) => j.id === 'backup'));
    expect(effectiveCadence(job, { cadence: 'every 12h' })).toMatchObject({ overridden: true, text: 'every 12h' });
    expect(effectiveCadence(job, { cadence: 'whenever' })).toMatchObject({ overridden: false, badOverride: true, text: job.cadence });
  });
});

const job = (id: string, over: Partial<JobDef> = {}): JobDef => ({
  id,
  label: id,
  does: id,
  cadence: 'daily 16:10',
  target: { kind: 'function', name: id },
  logicOwner: 'TEST',
  status: 'live',
  maxSeconds: 30,
  ...over,
});
const row = (id: string, last: string | null, over: Partial<JobRow> = {}): JobRow => ({ id, enabled: true, cadence: null, last_run_at: last, ...over });

describe('which jobs are due', () => {
  const daily = job('daily');
  it('due once its slot has passed and it has not started since', () => {
    expect(dueJobs([daily], [row('daily', '2026-10-08T16:15:00Z')], FRI_1700).map((d) => d.job.id)).toEqual(['daily']);
    expect(dueJobs([daily], [row('daily', '2026-10-09T16:15:00Z')], FRI_1700)).toEqual([]);
    expect(dueJobs([daily], [row('daily', '2026-10-08T16:15:00Z')], at('2026-10-09T16:00:00Z'))).toEqual([]);
  });

  it('a new job (no row, or never run) is due straight away', () => {
    expect(dueJobs([daily], [], FRI_1700)).toHaveLength(1);
    expect(dueJobs([daily], [row('daily', null)], FRI_1700)).toHaveLength(1);
  });

  it('after missed runs it catches up ONCE, not once per missed day', () => {
    const rows = [row('daily', '2026-10-01T16:15:00Z')]; // eight days missed
    const due = dueJobs([daily], rows, FRI_1700);
    expect(due).toHaveLength(1);
    expect(due[0]?.slot).toBe(at('2026-10-09T16:10:00Z'));
    // Once it has started after that slot, it is not due again until the next one.
    expect(dueJobs([daily], [row('daily', '2026-10-09T17:00:00Z')], at('2026-10-10T16:09:00Z'))).toEqual([]);
    expect(dueJobs([daily], [row('daily', '2026-10-09T17:00:00Z')], at('2026-10-10T16:10:00Z'))).toHaveLength(1);
  });

  it('switched-off, external-routine and included jobs never run here', () => {
    const ext = job('ext', { target: { kind: 'external' }, status: 'frame' });
    const inc = job('inc', { target: { kind: 'included', in: 'daily' } });
    expect(dueJobs([daily, ext, inc], [row('daily', null, { enabled: false })], FRI_1700)).toEqual([]);
  });

  it('most overdue first', () => {
    const weekly = job('weekly', { cadence: 'mon 06:00' });
    expect(dueJobs([daily, weekly], [], FRI_1700).map((d) => d.job.id)).toEqual(['weekly', 'daily']);
  });

  it('the owner’s cadence override is used', () => {
    expect(dueJobs([daily], [row('daily', '2026-10-09T16:15:00Z', { cadence: 'every 0h' })], FRI_1700)).toEqual([]);
    expect(dueJobs([daily], [row('daily', '2026-10-09T16:15:00Z', { cadence: 'every 1h' })], FRI_1700)).toHaveLength(1);
  });
});

/** In memory, with the same rules as scheduler_take_lock in 0005_scheduler.sql. */
function memoryStore(initial: JobRow[] = []) {
  const jobs = new Map<string, JobRow & { lock_until: string | null; last_status?: string; next_due_at?: string | null }>(initial.map((r) => [r.id, { ...r, lock_until: null }]));
  const runs: RunRecord[] = [];
  const findings: { job: string; f: NewFinding }[] = [];
  const store: SchedulerStore = {
    async register(ids) {
      for (const id of ids) if (!jobs.has(id)) jobs.set(id, { id, enabled: true, cadence: null, last_run_at: null, lock_until: null });
    },
    async rows() {
      return [...jobs.values()].map((r) => ({ ...r }));
    },
    async takeLock(id, now, until, notRunSince) {
      const r = must(jobs.get(id));
      const t = Date.parse(now);
      if (lockFree(r.lock_until, t) && (!notRunSince || !r.last_run_at || Date.parse(r.last_run_at) < Date.parse(notRunSince))) {
        r.lock_until = until;
        r.last_run_at = now;
        return 'taken';
      }
      return r.lock_until && Date.parse(r.lock_until) >= t ? 'busy' : 'already-ran';
    },
    async finish(id, patch) {
      Object.assign(must(jobs.get(id)), patch, { lock_until: null });
    },
    async recordRun(run) {
      runs.push(run);
    },
    async addFindings(id, list) {
      findings.push(...list.map((f) => ({ job: id, f })));
      return list.length;
    },
  };
  return { store, jobs, runs, findings };
}

const finding: NewFinding = { game_id: 'hsr', kind: 'leak', title: 'New character', payload: {}, source_name: 'nanoka.cc', source_url: null };

describe('a scheduler run', () => {
  it('jobs register themselves, run, are recorded, and get a next due time', async () => {
    const m = memoryStore();
    const runJob = vi.fn(async (): Promise<JobResult> => ({ status: 'ok', message: 'Done.', counts: { rows: 3 } }));
    const out = await runScheduler({ store: m.store, runJob, now: () => FRI_1700 }, { startedBy: 'cron', jobs: [job('a')] });
    expect(out.ran).toEqual([{ id: 'a', status: 'ok', message: 'Done.' }]);
    expect(m.runs[0]).toMatchObject({ job_id: 'a', status: 'ok', counts: { rows: 3 }, started_by: 'cron' });
    expect(m.jobs.get('a')).toMatchObject({ last_status: 'ok', lock_until: null, next_due_at: '2026-10-10T16:10:00.000Z' });
    // A second run straight after: nothing due, nothing runs.
    await runScheduler({ store: m.store, runJob, now: () => FRI_1700 + 60_000 }, { startedBy: 'cron', jobs: [job('a')] });
    expect(runJob).toHaveBeenCalledTimes(1);
  });

  it('frame jobs record “frame”, call nothing and never write findings', async () => {
    const m = memoryStore();
    const runJob = vi.fn(async (): Promise<JobResult> => ({ status: 'ok', message: 'x', findings: [finding] }));
    await runScheduler({ store: m.store, runJob, now: () => FRI_1700 }, { startedBy: 'cron', jobs: [job('f', { target: { kind: 'frame' }, status: 'frame' })] });
    expect(runJob).not.toHaveBeenCalled();
    expect(m.runs[0]).toMatchObject({ status: 'frame', message: FRAME_MESSAGE });
    expect(m.findings).toEqual([]);
  });

  it('a live job’s findings go to the inbox; an error never stops the run', async () => {
    const m = memoryStore();
    const runJob = vi.fn(async (j: JobDef): Promise<JobResult> => {
      if (j.id === 'bad') throw new Error('boom');
      return { status: 'ok', message: 'Found one.', findings: [finding] };
    });
    await runScheduler({ store: m.store, runJob, now: () => FRI_1700 }, { startedBy: 'cron', jobs: [job('bad'), job('good')] });
    expect(m.runs.map((r) => [r.job_id, r.status])).toEqual([
      ['bad', 'error'],
      ['good', 'ok'],
    ]);
    expect(m.runs[0]?.message).toBe('boom');
    expect(m.runs[1]?.counts).toMatchObject({ findings_new: 1 });
    expect(m.findings).toHaveLength(1);
  });

  it('never runs a job that is already running (lock), and records the skipped start', async () => {
    const m = memoryStore([row('a', null)]);
    must(m.jobs.get('a')).lock_until = new Date(FRI_1700 + 60_000).toISOString();
    const runJob = vi.fn(async (): Promise<JobResult> => ({ status: 'ok', message: 'x' }));
    const out = await runScheduler({ store: m.store, runJob, now: () => FRI_1700 }, { startedBy: 'owner', only: 'a', jobs: [job('a')] });
    expect(runJob).not.toHaveBeenCalled();
    expect(out.ran[0]?.status).toBe('skipped');
    expect(m.runs[0]).toMatchObject({ status: 'skipped', started_by: 'owner' });
  });

  it('an expired lock (crashed run) is free again', async () => {
    const m = memoryStore([row('a', null)]);
    must(m.jobs.get('a')).lock_until = new Date(FRI_1700 - 1).toISOString();
    const runJob = vi.fn(async (): Promise<JobResult> => ({ status: 'ok', message: 'x' }));
    await runScheduler({ store: m.store, runJob, now: () => FRI_1700 }, { startedBy: 'cron', jobs: [job('a')] });
    expect(runJob).toHaveBeenCalledTimes(1);
  });

  it('two runs racing never both start a due job', async () => {
    const m = memoryStore([row('a', '2026-10-08T16:15:00Z')]);
    const stale = await m.store.rows(); // both runs read the list before either started the job
    const runJob = vi.fn(async (): Promise<JobResult> => ({ status: 'ok', message: 'x' }));
    await runScheduler({ store: m.store, runJob, now: () => FRI_1700 }, { startedBy: 'cron', jobs: [job('a')] });
    const late = { ...m.store, rows: async () => stale };
    await runScheduler({ store: late, runJob, now: () => FRI_1700 + 1000 }, { startedBy: 'cron', jobs: [job('a')] });
    expect(runJob).toHaveBeenCalledTimes(1);
    expect(m.runs).toHaveLength(1); // the late run saw "already ran" and stayed quiet
  });

  it('starts a job only while it fits in the time budget; the rest wait for the next run', async () => {
    const m = memoryStore();
    let t = FRI_1700;
    const runJob = vi.fn(async (j: JobDef): Promise<JobResult> => {
      t += j.maxSeconds * 1000;
      return { status: 'ok', message: 'x' };
    });
    const out = await runScheduler({ store: m.store, runJob, now: () => t }, { startedBy: 'cron', budgetMs: 100_000, jobs: [job('a', { maxSeconds: 60 }), job('b', { maxSeconds: 60 })] });
    expect(out.ran.map((r) => r.id)).toEqual(['a']);
    expect(out.left).toEqual(['b']);
  });

  it('Run now on an external-routine job is refused with a reason, not run', async () => {
    const m = memoryStore();
    const runJob = vi.fn();
    const out = await runScheduler({ store: m.store, runJob, now: () => FRI_1700 }, { startedBy: 'owner', only: 'leaks-scan' });
    expect(runJob).not.toHaveBeenCalled();
    expect(out.ran[0]).toMatchObject({ status: 'skipped', message: expect.stringContaining('external routine') });
  });
});

describe('the job list', () => {
  it('seeds the fixed jobs live and the find jobs as external-routine frames', () => {
    const by = Object.fromEntries(JOBS.map((j) => [j.id, j]));
    expect(by.backup).toMatchObject({ status: 'live', target: { kind: 'function', name: 'backup' } });
    expect(by['hoyolab-daily']).toMatchObject({ status: 'live', cadence: 'daily 16:10' });
    expect(by['codes-refresh']).toMatchObject({ status: 'live', cadence: 'every 4h', target: { kind: 'function', name: 'codes-refresh' } });
    expect([...EXTERNAL_JOB_IDS].sort()).toEqual(['events-scan', 'game-data-refresh', 'leaks-scan', 'research-routine']);
    for (const id of EXTERNAL_JOB_IDS) expect(runnerOf(must(by[id]))).toBe('External routine');
  });

  it('the research routine is a self-adjusting routine job, live (its routine delivers)', () => {
    const job = must(JOBS.find((j) => j.id === 'research-routine'));
    expect(job).toMatchObject({ label: 'Research routine', cadence: SELF_ADJUSTING, fallbackCadence: 'mon 08:50', target: { kind: 'external' }, status: 'live' });
    expect(describeCadence(effectiveCadence(job, undefined).cadence)).toBe('Mon at 08:50 UTC');
    expect(runnable(job)).toBe(false);
  });

  it('every live function job has its function folder and a config entry', () => {
    const config = readFileSync('supabase/config.toml', 'utf8');
    for (const j of JOBS) {
      if (j.target.kind !== 'function') continue;
      const name = j.target.name;
      expect(() => readFileSync(`supabase/functions/${name}/index.ts`)).not.toThrow();
      expect(config).toContain(`[functions.${name}]`);
    }
    expect(config).toMatch(/\[functions\.scheduler\]\nverify_jwt = false/);
    expect(config).toMatch(/\[functions\.findings-intake\]\nverify_jwt = false/);
  });
});

describe('who may start the scheduler', () => {
  const ownerCheck = vi.fn(async (token: string) => token === 'a.owner.jwt');
  it('the cron job with the key, an owner, and nobody else', async () => {
    expect(await whoCalls('Bearer svc', 'svc', ownerCheck)).toBe('cron');
    expect(await whoCalls('Bearer a.owner.jwt', 'svc', ownerCheck)).toBe('owner');
    expect(await whoCalls('Bearer a.user.jwt', 'svc', ownerCheck)).toBe('nobody');
    expect(await whoCalls('Bearer public-anon-key', 'svc', ownerCheck)).toBe('nobody');
    expect(await whoCalls(null, 'svc', ownerCheck)).toBe('nobody');
    expect(await whoCalls('Bearer svc', undefined, ownerCheck)).toBe('nobody');
    expect(await whoCalls('Bearer a.b.c', 'svc', async () => Promise.reject(new Error('down')))).toBe('nobody');
  });

  it('the cron job is also let in when its token matches the Vault secret, even if the runtime key differs', async () => {
    const timerKey = vi.fn(async (token: string) => token === 'vault.jwt.key');
    expect(await whoCalls('Bearer vault.jwt.key', 'other-form-of-key', ownerCheck, timerKey)).toBe('cron');
    expect(await whoCalls('Bearer vault.jwt.key', undefined, ownerCheck, timerKey)).toBe('cron');
    expect(await whoCalls('Bearer a.owner.jwt', 'svc', ownerCheck, timerKey)).toBe('owner');
    expect(await whoCalls('Bearer wrong', 'svc', ownerCheck, timerKey)).toBe('nobody');
    expect(await whoCalls('Bearer a.owner.jwt', 'svc', ownerCheck, async () => Promise.reject(new Error('down')))).toBe('owner');
  });

  it('asks is_owner() with the caller’s own token; only a plain true counts', async () => {
    const f = vi.fn(async () => ({ ok: true, json: async () => true }));
    expect(await ownerByToken('a.b.c', { url: 'https://x.supabase.co/', anonKey: 'anon' }, f)).toBe(true);
    expect(f).toHaveBeenCalledWith('https://x.supabase.co/rest/v1/rpc/is_owner', expect.objectContaining({ headers: expect.objectContaining({ apikey: 'anon', Authorization: 'Bearer a.b.c' }) }));
    expect(await ownerByToken('a.b.c', { url: 'u', anonKey: 'k' }, async () => ({ ok: true, json: async () => 'true' }))).toBe(false);
    expect(await ownerByToken('a.b.c', { url: 'u', anonKey: 'k' }, async () => ({ ok: false, json: async () => true }))).toBe(false);
    expect(await ownerByToken('a.b.c', { url: undefined, anonKey: 'k' }, f)).toBe(false);
  });
});

describe('calling a job’s function', () => {
  it('sends the service key and reads numbers, message and findings', async () => {
    const f = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, rows: { pulls: 4 }, at: 'x', findings: [{ kind: 'leak', title: 'X' }, { kind: 'nope', title: 'Y' }] }) }));
    const r = await callJobFunction(f, 'https://p.supabase.co', 'svc', 'backup', 5000);
    expect(f).toHaveBeenCalledWith('https://p.supabase.co/functions/v1/backup', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer svc' }) }));
    expect(r).toMatchObject({ status: 'ok', message: 'Done.', counts: { rows: { pulls: 4 } } });
    expect(r.findings).toHaveLength(1);
  });

  it('an error answer and no answer are errors, said plainly', async () => {
    expect(await callJobFunction(async () => ({ ok: false, status: 500, json: async () => ({ error: 'Reading pulls failed' }) }), 'u', 'k', 'backup', 5000)).toMatchObject({ status: 'error', message: 'Reading pulls failed' });
    const hang = (_u: string, init: { signal: AbortSignal }) => new Promise<never>((_, rej) => init.signal.addEventListener('abort', () => rej(new Error('aborted'))));
    expect((await callJobFunction(hang, 'u', 'k', 'backup', 10)).message).toMatch(/No answer from backup within/);
  });

  it('drops findings it cannot read, never guesses', () => {
    expect(readFindings('x')).toEqual([]);
    expect(readFindings([{ kind: 'leak', title: '  ' }, { kind: 'event', title: 'Ok', source_url: 'javascript:alert(1)' }])).toEqual([
      { game_id: null, kind: 'event', title: 'Ok', payload: {}, source_name: null, source_url: null, topic: 'events-modes' },
    ]);
  });
});

const NOW = FRI_1700;
const good = { job: 'leaks-scan', game_id: 'hsr', kind: 'leak', title: 'New 5★ in 3.8', payload: { element: 'Ice' }, source: { name: 'nanoka.cc', url: 'https://nanoka.cc/hsr/new' }, found_at: '2026-10-09T06:00:00Z' };

describe('findings intake (the routine’s deliveries)', () => {
  it('accepts a good delivery, grouped by job', () => {
    const r = readIntake({ ran: ['events-scan'], findings: [good] }, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.byJob.get('events-scan')).toEqual([]); // ran, found nothing: still recorded
    expect(r.byJob.get('leaks-scan')?.[0]).toMatchObject({ kind: 'leak', source_name: 'nanoka.cc', source_url: 'https://nanoka.cc/hsr/new', found_at: '2026-10-09T06:00:00.000Z' });
  });

  it('refuses the whole batch on any problem, listing each one', () => {
    const r = readIntake({ findings: [good, { ...good, job: 'backup', kind: 'rumour', title: '', source: {}, found_at: '2030-01-01T00:00:00Z' }] }, NOW);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.problems).toHaveLength(5);
    expect(readIntake({ findings: [] }, NOW).ok).toBe(false);
    expect(readIntake({ findings: Array(101).fill(good) }, NOW).ok).toBe(false);
    expect(readIntake({ findings: [{ ...good, payload: { big: 'x'.repeat(9000) } }] }, NOW).ok).toBe(false);
    expect(readIntake({ findings: [{ ...good, source: { name: 'x', url: 'ftp://x' } }] }, NOW).ok).toBe(false);
    expect(readIntake({ ran: ['backup'], findings: [] }, NOW).ok).toBe(false);
    expect(readIntake(null, NOW).ok).toBe(false);
  });

  it('the same job + game + kind + source + title within 30 days is skipped', async () => {
    const db = fakeDb();
    const f = must((readIntake({ findings: [good, { ...good, title: 'new 5★  in 3.8' }] }, NOW) as { ok: true; byJob: Map<string, NewFinding[]> }).byJob.get('leaks-scan'));
    const r1 = await saveFindings(db, 'leaks-scan', f, 'routine', NOW);
    expect(r1).toMatchObject({ added: 1, known: 1 }); // repeat inside the batch
    expect(r1.ids).toHaveLength(1);
    expect(await saveFindings(db, 'leaks-scan', f, 'routine', NOW + 86_400_000)).toMatchObject({ added: 0, known: 2, ids: [] });
    const r3 = await saveFindings(db, 'events-scan', f, 'routine', NOW);
    expect(r3).toMatchObject({ added: 1, known: 1 }); // other job: new to it (the second is the in-batch repeat)
    expect(r3.ids).toHaveLength(1);
    expect(await saveFindings(db, 'leaks-scan', f, 'routine', NOW + 31 * 86_400_000)).toMatchObject({ added: 1, known: 1 });
    expect(db.tables.scheduler_findings?.[0]).toMatchObject({ status: 'new', delivered_by: 'routine', dedupe_key: dedupeKey(must(f[0])) });
  });

  it('a delivery records a run per job and stamps the job with the delivery time', async () => {
    const db = fakeDb();
    const r = readIntake({ ran: ['events-scan'], findings: [good] }, NOW) as { ok: true; byJob: Map<string, NewFinding[]> };
    const { saved, addedIds } = await deliver(db, r.byJob, NOW, () => '2026-10-12T06:00:00.000Z');
    expect(saved).toEqual([
      { job: 'events-scan', delivered: 0, added: 0, known: 0 },
      { job: 'leaks-scan', delivered: 1, added: 1, known: 0 },
    ]);
    expect(addedIds).toHaveLength(1);
    expect(db.tables.scheduler_runs?.map((x) => [x.job_id, x.message, x.started_by])).toEqual([
      ['events-scan', 'Delivered 0 findings.', 'routine'],
      ['leaks-scan', 'Delivered 1 finding.', 'routine'],
    ]);
    expect(db.tables.scheduler_jobs?.find((j) => j.id === 'leaks-scan')).toMatchObject({ last_status: 'ok', last_run_at: new Date(NOW).toISOString(), next_due_at: '2026-10-12T06:00:00.000Z' });
  });

  it('deliver returns addedIds for auto-approve: one per new finding, none for known', async () => {
    const db = fakeDb();
    const findings = [
      { ...good, title: 'first leak' },
      { ...good, title: 'second leak' },
    ];
    const r = readIntake({ findings }, NOW) as { ok: true; byJob: Map<string, NewFinding[]> };
    const { saved, addedIds } = await deliver(db, r.byJob, NOW, () => null);
    expect(saved[0]).toMatchObject({ job: 'leaks-scan', added: 2 });
    expect(addedIds).toHaveLength(2);
    expect(addedIds.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
    const r2 = readIntake({ findings }, NOW + 1000) as { ok: true; byJob: Map<string, NewFinding[]> };
    const { addedIds: ids2 } = await deliver(db, r2.byJob, NOW + 1000, () => null);
    expect(ids2).toHaveLength(0);
  });

  it('failed runs and next_at: checked all-or-nothing (self-adjusting cadence)', () => {
    const later = new Date(NOW + 86_400_000).toISOString();
    const r = readIntake({ ran: ['leaks-scan'], failed: [{ job: 'game-data-refresh', message: 'nanoka.cc answered 503' }], next_at: { 'leaks-scan': later }, findings: [] }, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect([...r.failed]).toEqual([['game-data-refresh', 'nanoka.cc answered 503']]);
      expect([...r.nextAt]).toEqual([['leaks-scan', later]]);
    }
    // The research routine is a job like the others: in ran, failed and next_at.
    const research = readIntake({ ran: ['research-routine'], next_at: { 'research-routine': later }, findings: [{ ...good, job: 'research-routine' }] }, NOW);
    expect(research.ok && research.byJob.get('research-routine')?.length).toBe(1);
    expect(research.ok && research.nextAt.get('research-routine')).toBe(later);
    expect(readIntake({ failed: [{ job: 'research-routine', message: 'notice page answered 404' }], findings: [] }, NOW).ok).toBe(true);
    // A failure alone is a delivery.
    expect(readIntake({ failed: [{ job: 'events-scan', message: 'timed out' }], findings: [] }, NOW).ok).toBe(true);
    const bad = (body: unknown) => (readIntake(body, NOW) as { ok: false; problems: string[] }).problems;
    expect(bad({ failed: [{ job: 'backup', message: 'x' }], findings: [] })).toEqual([`failed[0].job: must be one of ${EXTERNAL_JOB_IDS.join(', ')}.`]);
    expect(bad({ failed: [{ job: 'leaks-scan', message: ' ' }], findings: [] })).toEqual(['failed[0].message: missing (what went wrong, in plain words).']);
    expect(bad({ failed: [{ job: 'leaks-scan', message: 'x'.repeat(501) }], findings: [] })).toEqual(['failed[0].message: longer than 500 characters.']);
    expect(bad({ ran: ['leaks-scan'], failed: [{ job: 'leaks-scan', message: 'x' }], findings: [] })).toEqual(['failed: leaks-scan is also in "ran"; one outcome per job per delivery.']);
    expect(bad({ failed: [{ job: 'leaks-scan', message: 'x' }], findings: [good] })).toEqual(['failed: leaks-scan also has findings; one outcome per job per delivery.']);
    expect(bad({ ran: ['leaks-scan'], next_at: { backup: later }, findings: [] })).toEqual([`next_at.backup: not a job; use one of ${EXTERNAL_JOB_IDS.join(', ')}.`]);
    expect(bad({ ran: ['leaks-scan'], next_at: { 'leaks-scan': new Date(NOW - 1000).toISOString() }, findings: [] })).toEqual(['next_at.leaks-scan: must be in the future (when the job runs next).']);
    expect(bad({ ran: ['leaks-scan'], next_at: { 'leaks-scan': new Date(NOW + 32 * 86_400_000).toISOString() }, findings: [] })).toEqual(['next_at.leaks-scan: more than 31 days ahead.']);
    expect(bad({ ran: ['leaks-scan'], next_at: { 'leaks-scan': 'soon' }, findings: [] })).toEqual(['next_at.leaks-scan: must be an ISO date-time, e.g. "2026-10-11T06:00:00Z".']);
    expect(bad({ ran: ['leaks-scan'], next_at: [], findings: [] })).toEqual(['"next_at" must be an object: { "<job>": "<ISO time>" }.']);
    // Every problem is listed at once: a bad "failed" entry and a bad finding together.
    expect(bad({ failed: [{ job: 'events-scan', message: '' }], findings: [{ ...good, title: '' }] })).toEqual(['failed[0].message: missing (what went wrong, in plain words).', 'findings[0].title: missing.']);
  });

  it('a failed run is recorded red with the routine\'s words; next_at sets when each job is expected', async () => {
    const db = fakeDb();
    const later = new Date(NOW + 2 * 86_400_000).toISOString();
    const r = readIntake({ ran: ['leaks-scan'], failed: [{ job: 'events-scan', message: 'timed out' }], next_at: { 'events-scan': later }, findings: [] }, NOW);
    if (!r.ok) throw new Error(r.problems.join(' '));
    const { saved } = await deliver(db, r.byJob, NOW, () => 'fallback', r.failed, r.nextAt);
    expect(saved).toEqual([
      { job: 'leaks-scan', delivered: 0, added: 0, known: 0 },
      { job: 'events-scan', delivered: 0, added: 0, known: 0, failed: true },
    ]);
    expect(db.tables.scheduler_runs?.find((x) => x.job_id === 'events-scan')).toMatchObject({ status: 'error', message: 'timed out', started_by: 'routine' });
    expect(db.tables.scheduler_jobs?.find((j) => j.id === 'events-scan')).toMatchObject({ last_status: 'error', last_message: 'timed out', next_due_at: later });
    // No next_at for this job: its fallback cadence.
    expect(db.tables.scheduler_jobs?.find((j) => j.id === 'leaks-scan')).toMatchObject({ last_status: 'ok', next_due_at: 'fallback' });
  });

  it('a routine job is expected when it said, overdue once that passed; else on its fallback after its last delivery', () => {
    const job = must(JOBS.find((j) => j.id === 'leaks-scan'));
    expect(job).toMatchObject({ cadence: SELF_ADJUSTING, status: 'live' });
    const at = NOW + 3_600_000;
    expect(externalNext(job, { cadence: null, last_run_at: new Date(NOW).toISOString(), next_due_at: new Date(at).toISOString() }, NOW)).toEqual({ at, overdue: false });
    expect(externalNext(job, { cadence: null, last_run_at: new Date(NOW).toISOString(), next_due_at: new Date(at).toISOString() }, at + 1)).toEqual({ at, overdue: true });
    // Never delivered: nothing expected yet.
    expect(externalNext(job, { cadence: null, last_run_at: null, next_due_at: null }, NOW)).toEqual({ at: null, overdue: false });
    // Delivered without a time: the fallback cadence (mon,wed,fri 06:00) after that delivery.
    const fb = externalNext(job, { cadence: null, last_run_at: new Date(NOW).toISOString(), next_due_at: null }, NOW);
    expect(fb.at).toBe(nextSlot(must(parseCadence('mon,wed,fri 06:00')), NOW));
  });
});

/** A tiny fake of the parts of the Supabase client used by findings.ts. */
let fakeUuidCounter = 0;
function fakeUuid() { return `00000000-0000-0000-0000-${String(++fakeUuidCounter).padStart(12, '0')}`; }

function fakeDb() {
  type Row = Record<string, unknown>;
  const tables: Record<string, Row[]> = { scheduler_findings: [], scheduler_runs: [], scheduler_jobs: [] };
  const db: DeliveryDb = {
    from(table) {
      const tbl = (tables[table] ??= []);
      const filters: ((r: Row) => boolean)[] = [];
      let justInserted: Row[] | null = null;
      const answer = () => ({ data: justInserted ?? tbl.filter((r) => filters.every((f) => f(r))), error: null });
      const q = {
        select: () => q,
        eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), q),
        in: (c: string, v: unknown[]) => (filters.push((r) => v.includes(r[c])), q),
        gte: (c: string, v: string) => (filters.push((r) => String(r[c]) >= v), q),
        insert: (rows: object[]) => {
          const withIds = (rows as Row[]).map((r) => (r.id ? r : { id: fakeUuid(), ...r }));
          tbl.push(...withIds);
          justInserted = withIds;
          return q;
        },
        upsert: async (rows: object[]) => {
          for (const r of rows as Row[]) if (!tbl.some((x) => x.id === r.id)) tbl.push({ ...r });
          return { data: null, error: null };
        },
        update: (patch: object) => ({
          eq: async (c: string, v: unknown) => {
            for (const r of tbl) if (r[c] === v) Object.assign(r, patch);
            return { data: null, error: null };
          },
        }),
        then: (ok: (a: { data: unknown; error: null }) => unknown) => Promise.resolve(answer()).then(ok),
      };
      return q as unknown as ReturnType<DeliveryDb['from']>;
    },
  };
  return Object.assign(db, { tables });
}

describe('findings intake key', () => {
  const KEY = 'k'.repeat(40);
  const ok = <T,>(data: T) => async () => ({ data, error: null });
  const fail = (message: string) => async () => ({ data: null, error: { message } });
  const vault = (stored: string) => ({ ready: ok(stored.length >= 32), keyOk: async (key: string) => ({ data: key === stored, error: null }) });

  it('reads x-intake-key, else a Bearer key, without surrounding spaces or line breaks', () => {
    expect(intakeKeyFrom(new Headers({ 'x-intake-key': ` ${KEY}\n` }))).toBe(KEY);
    expect(intakeKeyFrom(new Headers({ authorization: `Bearer ${KEY}` }))).toBe(KEY);
    expect(intakeKeyFrom(new Headers({ 'x-intake-key': KEY, authorization: 'Bearer something-else' }))).toBe(KEY);
    expect(intakeKeyFrom(new Headers())).toBe('');
  });

  it('the right key passes, a wrong or short one is 401', async () => {
    expect(await checkIntakeKey(KEY, vault(KEY))).toEqual({ ok: true });
    expect(await checkIntakeKey('x'.repeat(40), vault(KEY))).toEqual({ ok: false, status: 401, error: 'Not allowed.' });
    expect(await checkIntakeKey('short', vault(KEY))).toEqual({ ok: false, status: 401, error: 'Not allowed.' });
  });

  it('a Vault key that is missing or too short is 500 with a plain message, whatever is sent', async () => {
    const short = 'a'.repeat(11); // what was in Vault on 2026-10-11
    expect(await checkIntakeKey(short, vault(short))).toEqual({ ok: false, status: 500, error: INTAKE_NOT_READY });
    expect(await checkIntakeKey(KEY, vault(''))).toEqual({ ok: false, status: 500, error: INTAKE_NOT_READY });
    expect(INTAKE_NOT_READY).toBe('The intake key in Vault (findings_intake_key) is missing or shorter than 32 characters.');
  });

  it('a check that cannot run is 500 with the reason, not "Not allowed."', async () => {
    expect(await checkIntakeKey(KEY, { ready: fail('function findings_intake_key_ready() does not exist'), keyOk: ok(true) })).toEqual({
      ok: false,
      status: 500,
      error: "Couldn't check the key: function findings_intake_key_ready() does not exist",
    });
    expect(await checkIntakeKey(KEY, { ready: ok(true), keyOk: fail('permission denied') })).toEqual({ ok: false, status: 500, error: "Couldn't check the key: permission denied" });
  });
});

describe('decisions-only intake', () => {
  const uuid = '01234567-89ab-cdef-0123-456789abcdef';

  it('isDecisionsOnly returns true when body has decisions but no findings/ran/failed', () => {
    expect(isDecisionsOnly({ decisions: [{ id: uuid, status: 'approved' }] })).toBe(true);
    expect(isDecisionsOnly({ decisions: [{ id: uuid, status: 'approved' }], findings: [] })).toBe(false);
    expect(isDecisionsOnly({ decisions: [{ id: uuid, status: 'approved' }], ran: ['leaks-scan'] })).toBe(false);
    expect(isDecisionsOnly({ decisions: [{ id: uuid, status: 'approved' }], failed: [] })).toBe(false);
    expect(isDecisionsOnly({ decisions: [] })).toBe(false);
    expect(isDecisionsOnly({})).toBe(false);
    expect(isDecisionsOnly(null)).toBe(false);
  });

  it('readDecisions parses valid decisions and drops invalid ones', () => {
    const good = { id: uuid, status: 'approved', reason: 'looks right', topic: 'characters' };
    expect(readDecisions({ decisions: [good] })).toEqual([good]);
    expect(readDecisions({ decisions: [{ id: uuid, status: 'dismissed' }] })).toEqual([{ id: uuid, status: 'dismissed' }]);
    expect(readDecisions({ decisions: [{ id: 'bad', status: 'approved' }] })).toEqual([]);
    expect(readDecisions({ decisions: [{ id: uuid, status: 'maybe' }] })).toEqual([]);
    expect(readDecisions({ decisions: [{ id: uuid, status: 'approved', topic: 'bogus' }] })).toEqual([{ id: uuid, status: 'approved' }]);
    expect(readDecisions({ decisions: 'not an array' })).toEqual([]);
    expect(readDecisions({})).toEqual([]);
  });
});
