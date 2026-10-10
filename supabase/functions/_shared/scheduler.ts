/**
 * The scheduler: decides which jobs are due, runs them one after another inside a
 * time budget, never runs the same job twice at once (lock row with expiry), and
 * records every run. Pure apart from the injected store, runner and clock, so it
 * is tested outside the server (tests/scheduler.test.ts).
 *
 * Database side: supabase/migrations/0005_scheduler.sql. Job list: jobs.ts.
 */
import { isScheduler } from './backupPlan.ts';
import { FRAME_MESSAGE, JOBS, SELF_ADJUSTING, type JobDef } from './jobs.ts';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// ── Cadence ──────────────────────────────────────────────────────────
/** Times are UTC. minute = minutes after midnight. days: 0 = Sunday. */
export type Cadence = { kind: 'daily'; minute: number } | { kind: 'weekly'; days: number[]; minute: number } | { kind: 'every'; hours: number };

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** "daily 16:10" · "mon,wed,fri 06:00" · "every 6h". Anything else → null. */
export function parseCadence(text: string): Cadence | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, ' ');
  const every = t.match(/^every (\d{1,3}) ?h$/);
  if (every) {
    const hours = Number(every[1]);
    return hours >= 1 && hours <= 168 ? { kind: 'every', hours } : null;
  }
  const m = t.match(/^([a-z,]+) (\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[2]);
  const min = Number(m[3]);
  if (h > 23 || min > 59) return null;
  const minute = h * 60 + min;
  if (m[1] === 'daily') return { kind: 'daily', minute };
  const days = (m[1] ?? '').split(',').map((d) => DAY_NAMES.indexOf(d as (typeof DAY_NAMES)[number]));
  if (!days.length || days.some((d) => d < 0)) return null;
  return { kind: 'weekly', days: [...new Set(days)].sort((a, b) => a - b), minute };
}

const hhmm = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;

/** Plain English: "Daily at 16:10 UTC", "Mon, Wed, Fri at 06:00 UTC", "Every 6 hours". */
export function describeCadence(c: Cadence): string {
  if (c.kind === 'every') return c.hours === 1 ? 'Every hour' : `Every ${c.hours} hours`;
  if (c.kind === 'daily') return `Daily at ${hhmm(c.minute)} UTC`;
  return `${c.days.map((d) => DAY_LABELS[d]).join(', ')} at ${hhmm(c.minute)} UTC`;
}

/** The latest scheduled time at or before `now`. */
export function lastSlot(c: Cadence, now: number): number {
  if (c.kind === 'every') {
    const step = c.hours * HOUR;
    return Math.floor(now / step) * step;
  }
  const midnight = Math.floor(now / DAY) * DAY;
  for (let back = 0; back <= 7; back++) {
    const slot = midnight - back * DAY + c.minute * MINUTE;
    if (slot > now) continue;
    if (c.kind === 'daily' || c.days.includes(new Date(slot).getUTCDay())) return slot;
  }
  return midnight - 8 * DAY; // unreachable for a valid cadence
}

/** The first scheduled time strictly after `after`. */
export function nextSlot(c: Cadence, after: number): number {
  if (c.kind === 'every') return lastSlot(c, after) + c.hours * HOUR;
  const midnight = Math.floor(after / DAY) * DAY;
  for (let ahead = 0; ahead <= 8; ahead++) {
    const slot = midnight + ahead * DAY + c.minute * MINUTE;
    if (slot <= after) continue;
    if (c.kind === 'daily' || c.days.includes(new Date(slot).getUTCDay())) return slot;
  }
  return midnight + 9 * DAY; // unreachable for a valid cadence
}

// ── Job rows ─────────────────────────────────────────────────────────
/** One row of scheduler_jobs (the parts the scheduler reads). */
export interface JobRow {
  id: string;
  enabled: boolean;
  /** Owner's override of the cadence, or null for the default from jobs.ts. */
  cadence: string | null;
  last_run_at: string | null;
}

/** The cadence a job runs on: the owner's override when it reads correctly, else the default. */
export function effectiveCadence(job: JobDef, row: Pick<JobRow, 'cadence'> | undefined): { cadence: Cadence; text: string; overridden: boolean; badOverride: boolean } {
  const fallback = parseCadence(job.cadence) ?? parseCadence(job.fallbackCadence ?? '') ?? { kind: 'daily', minute: 0 };
  if (row?.cadence) {
    const own = parseCadence(row.cadence);
    if (own) return { cadence: own, text: row.cadence, overridden: true, badOverride: false };
    return { cadence: fallback, text: job.cadence, overridden: false, badOverride: true };
  }
  return { cadence: fallback, text: job.cadence, overridden: false, badOverride: false };
}

/** Does the routine say when this job runs next (findings-intake next_at)? */
export const selfAdjusting = (job: JobDef) => job.cadence === SELF_ADJUSTING;

/**
 * When an external routine's job is expected next, and whether it is overdue: the time the
 * routine gave with its last delivery (next_due_at); without one, the job's fallback cadence
 * after its last delivery. Never delivered = nothing expected yet (not overdue).
 */
export function externalNext(job: JobDef, row: Pick<JobRow, 'cadence' | 'last_run_at'> & { next_due_at?: string | null } | undefined, now: number): { at: number | null; overdue: boolean } {
  const given = row?.next_due_at ? Date.parse(row.next_due_at) : NaN;
  if (Number.isFinite(given)) return { at: given, overdue: now > given };
  const last = row?.last_run_at ? Date.parse(row.last_run_at) : NaN;
  if (!Number.isFinite(last)) return { at: null, overdue: false };
  const at = nextSlot(effectiveCadence(job, row).cadence, last);
  return { at, overdue: now > at };
}

/** Jobs the Supabase scheduler runs itself (not part of another job, not an external routine). */
export const runnable = (job: JobDef) => job.target.kind === 'function' || job.target.kind === 'frame';

/**
 * Which jobs are due now, most overdue first. A job is due when it has not started
 * since its latest scheduled time. Missed slots (the scheduler was down) give ONE
 * catch-up run, never one per missed slot. Switched-off jobs never run.
 */
export function dueJobs(jobs: readonly JobDef[], rows: readonly JobRow[], now: number): { job: JobDef; slot: number }[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: { job: JobDef; slot: number }[] = [];
  for (const job of jobs) {
    if (!runnable(job)) continue;
    const row = byId.get(job.id);
    if (row && !row.enabled) continue;
    const slot = lastSlot(effectiveCadence(job, row).cadence, now);
    const last = row?.last_run_at ? Date.parse(row.last_run_at) : NaN;
    if (Number.isFinite(last) && last >= slot) continue;
    out.push({ job, slot });
  }
  return out.sort((a, b) => a.slot - b.slot);
}

/** A lock can be taken when there is none or it has expired. */
export const lockFree = (lockUntil: string | null, now: number) => !lockUntil || Date.parse(lockUntil) < now;

// ── Findings ─────────────────────────────────────────────────────────
export const FINDING_KINDS = ['leak', 'event', 'banner', 'character', 'info'] as const;
export type FindingKind = (typeof FINDING_KINDS)[number];

/** What a job hands back for the inbox (scheduler_findings). */
export interface NewFinding {
  game_id: string | null;
  kind: FindingKind;
  title: string;
  payload: Record<string, unknown>;
  source_name: string | null;
  source_url: string | null;
  /** When the job found it (ISO); the database fills in now when missing. */
  found_at?: string;
}

/** Same job + game + kind + source + title = the same finding (job is stored beside it). */
export function dedupeKey(f: Pick<NewFinding, 'game_id' | 'kind' | 'title' | 'source_name' | 'source_url'>): string {
  return [f.game_id ?? '-', f.kind, f.source_url ?? f.source_name ?? '-', f.title.trim().replace(/\s+/g, ' ')].join('|').toLowerCase().slice(0, 500);
}

/** A finding seen again within this many days is not added twice. */
export const DEDUPE_DAYS = 30;

/** Drops findings already known (by key) and repeats inside the same batch. */
export function freshFindings(findings: NewFinding[], known: ReadonlySet<string>): NewFinding[] {
  const seen = new Set(known);
  return findings.filter((f) => {
    const k = dedupeKey(f);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const MAX_FINDINGS = 200;

/** Keeps only well-formed findings from a scheduler job's answer. Anything odd is dropped, never guessed. */
export function readFindings(raw: unknown): NewFinding[] {
  if (!Array.isArray(raw)) return [];
  const out: NewFinding[] = [];
  for (const f of raw.slice(0, MAX_FINDINGS)) {
    if (!f || typeof f !== 'object') continue;
    const r = f as Record<string, unknown>;
    if (!FINDING_KINDS.includes(r.kind as FindingKind)) continue;
    const title = typeof r.title === 'string' ? r.title.trim().slice(0, 300) : '';
    if (!title) continue;
    out.push({
      game_id: typeof r.game_id === 'string' && r.game_id ? r.game_id : null,
      kind: r.kind as FindingKind,
      title,
      payload: r.payload && typeof r.payload === 'object' && !Array.isArray(r.payload) ? (r.payload as Record<string, unknown>) : {},
      source_name: typeof r.source_name === 'string' && r.source_name ? r.source_name.slice(0, 120) : null,
      source_url: typeof r.source_url === 'string' && /^https?:\/\//i.test(r.source_url) ? r.source_url : null,
    });
  }
  return out;
}

// ── Running ──────────────────────────────────────────────────────────
export type RunStatus = 'ok' | 'error' | 'skipped' | 'frame';

export interface JobResult {
  status: 'ok' | 'error' | 'frame';
  message: string;
  counts?: Record<string, unknown>;
  findings?: NewFinding[];
}

export interface RunRecord {
  job_id: string;
  started_at: string;
  finished_at: string;
  status: RunStatus;
  message: string;
  counts: Record<string, unknown>;
  started_by: 'cron' | 'owner' | 'routine';
}

/** The database side, as the scheduler needs it (service role). */
export interface SchedulerStore {
  /** Adds a row for every job that has none yet. Never changes an existing row. */
  register(ids: string[]): Promise<void>;
  rows(): Promise<JobRow[]>;
  /**
   * In one step: take the job's lock until `until` and mark it started at `now`,
   * only if the lock is free and (when notRunSince is set) it has not started since then.
   */
  takeLock(id: string, now: string, until: string, notRunSince: string | null): Promise<'taken' | 'busy' | 'already-ran'>;
  /** Records the result on the job row and lets go of the lock. */
  finish(id: string, patch: { last_status: RunStatus; last_message: string; next_due_at: string | null }): Promise<void>;
  recordRun(run: RunRecord): Promise<void>;
  /** Adds new findings (skipping ones the job found in the last DEDUPE_DAYS days); returns how many were new. */
  addFindings(jobId: string, findings: NewFinding[]): Promise<number>;
}

export interface SchedulerDeps {
  store: SchedulerStore;
  runJob: (job: JobDef, timeoutMs: number) => Promise<JobResult>;
  now: () => number;
}

export interface RunSummary {
  ran: { id: string; status: RunStatus; message: string }[];
  /** Due, but not enough time left in this run: the next run picks them up. */
  left: string[];
}

/** Free-plan functions stop after 150 s: new jobs start only while they fit in this. */
export const RUN_BUDGET_MS = 140_000;
/** A lock outlives the job's own time limit by this much, so a crashed run frees it. */
export const LOCK_MARGIN_MS = 60_000;

/**
 * One scheduler run. Cron: every due job. Owner "Run now": just `only`, whether due or not
 * (still never while that job is already running).
 */
export async function runScheduler(
  deps: SchedulerDeps,
  opts: { startedBy: 'cron' | 'owner'; only?: string; jobs?: readonly JobDef[]; budgetMs?: number },
): Promise<RunSummary> {
  const jobs = opts.jobs ?? JOBS;
  const budget = opts.budgetMs ?? RUN_BUDGET_MS;
  const start = deps.now();
  const iso = (t: number) => new Date(t).toISOString();
  const summary: RunSummary = { ran: [], left: [] };

  await deps.store.register(jobs.map((j) => j.id));
  const rows = await deps.store.rows();
  const rowOf = (id: string) => rows.find((r) => r.id === id);

  let plan: { job: JobDef; slot: number | null }[];
  if (opts.only) {
    const job = jobs.find((j) => j.id === opts.only);
    if (!job) throw new Error(`No job called “${opts.only}”.`);
    if (!runnable(job)) {
      const at = iso(deps.now());
      const message =
        job.target.kind === 'included'
          ? `Runs inside ${job.target.in}; start that job instead.`
          : 'Runs in an external routine (its own chat), not in Supabase; start it there.';
      await deps.store.recordRun({ job_id: job.id, started_at: at, finished_at: at, status: 'skipped', message, counts: {}, started_by: opts.startedBy });
      summary.ran.push({ id: job.id, status: 'skipped', message });
      return summary;
    }
    plan = [{ job, slot: null }];
  } else {
    plan = dueJobs(jobs, rows, start);
  }

  for (const { job, slot } of plan) {
    const limitMs = job.maxSeconds * 1000;
    const begin = deps.now();
    if (begin - start + limitMs > budget) {
      summary.left.push(job.id);
      continue;
    }
    const lock = await deps.store.takeLock(job.id, iso(begin), iso(begin + limitMs + LOCK_MARGIN_MS), slot === null ? null : iso(slot));
    if (lock === 'already-ran') continue; // another run started it since this one read the list
    if (lock === 'busy') {
      const message = 'Already running; this start was skipped.';
      await deps.store.recordRun({ job_id: job.id, started_at: iso(begin), finished_at: iso(deps.now()), status: 'skipped', message, counts: {}, started_by: opts.startedBy });
      summary.ran.push({ id: job.id, status: 'skipped', message });
      continue;
    }

    let result: JobResult;
    if (job.status === 'frame' || job.target.kind === 'frame') {
      result = { status: 'frame', message: FRAME_MESSAGE }; // never runs anything, never writes findings
    } else {
      try {
        result = await deps.runJob(job, limitMs);
      } catch (e) {
        result = { status: 'error', message: e instanceof Error ? e.message : 'The job failed.' };
      }
    }

    const counts: Record<string, unknown> = { ...(result.counts ?? {}) };
    let status: RunStatus = result.status;
    let message = result.message;
    if (status === 'ok' && job.status === 'live' && result.findings?.length) {
      try {
        counts.findings_new = await deps.store.addFindings(job.id, result.findings);
        counts.findings_seen = result.findings.length;
      } catch (e) {
        status = 'error';
        message = `Job ran, but saving its findings failed: ${e instanceof Error ? e.message : 'unknown error'}`;
      }
    }

    const end = deps.now();
    const next = nextSlot(effectiveCadence(job, rowOf(job.id)).cadence, end);
    await deps.store.recordRun({ job_id: job.id, started_at: iso(begin), finished_at: iso(end), status, message, counts, started_by: opts.startedBy });
    await deps.store.finish(job.id, { last_status: status, last_message: message, next_due_at: iso(next) });
    summary.ran.push({ id: job.id, status, message });
  }
  return summary;
}

// ── Calling a job's server function ──────────────────────────────────
type FetchLike = (url: string, init: { method: 'POST'; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** Numbers from a job's answer (one level of nesting), for the run log. */
function numbersOf(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (typeof v === 'number') out[k] = v;
    else if (v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every((x) => typeof x === 'number')) out[k] = v;
  }
  return out;
}

/**
 * Calls a job's server function with the service key and turns its answer into a result.
 * The job answers { ok: true, message?, counts?, findings? } or an error status with { error }.
 */
export async function callJobFunction(fetchFn: FetchLike, baseUrl: string, serviceKey: string, name: string, timeoutMs: number): Promise<JobResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchFn(`${baseUrl.replace(/\/$/, '')}/functions/v1/${name}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: '{}',
      signal: ctrl.signal,
    });
    let body: Record<string, unknown> = {};
    try {
      const parsed = await res.json();
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) body = parsed as Record<string, unknown>;
    } catch {
      // not JSON: judged by the status alone
    }
    if (!res.ok) return { status: 'error', message: typeof body.error === 'string' ? body.error : `${name} answered ${res.status}`, counts: numbersOf(body) };
    const counts = body.counts && typeof body.counts === 'object' && !Array.isArray(body.counts) ? (body.counts as Record<string, unknown>) : numbersOf(body);
    return { status: 'ok', message: typeof body.message === 'string' ? body.message : 'Done.', counts, findings: readFindings(body.findings) };
  } catch (e) {
    if (ctrl.signal.aborted) return { status: 'error', message: `No answer from ${name} within ${Math.round(timeoutMs / 1000)} s. It may still be running; its own records show the outcome.` };
    return { status: 'error', message: `Could not reach ${name}: ${e instanceof Error ? e.message : 'network error'}` };
  } finally {
    clearTimeout(timer);
  }
}

// ── Who may start the scheduler ──────────────────────────────────────
export type Caller = 'cron' | 'owner' | 'nobody';

/**
 * The cron job or a signed-in owner (public.is_owner()). Everyone else: nobody.
 * The cron job sends the Vault secret scheduler_key; `isTimerKey` asks the database whether
 * the token matches it (so it works whichever form of the project key the runtime holds).
 * `isOwnerToken` asks the database with the caller's own token.
 */
export async function whoCalls(
  authorization: string | null,
  serviceKey: string | undefined,
  isOwnerToken: (token: string) => Promise<boolean>,
  isTimerKey: (token: string) => Promise<boolean> = async () => false,
): Promise<Caller> {
  if (isScheduler(authorization, serviceKey)) return 'cron';
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return 'nobody';
  try {
    if (await isTimerKey(token)) return 'cron';
  } catch {
    // database unreachable: fall through to the owner check
  }
  // A user token is a JWT (three dot-separated parts); the public key is not.
  if (token.split('.').length !== 3) return 'nobody';
  try {
    return (await isOwnerToken(token)) ? 'owner' : 'nobody';
  } catch {
    return 'nobody';
  }
}

type OwnerFetch = (url: string, init: { method: 'POST'; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

/** Asks public.is_owner() as the caller (their token, the public key). True only for a plain `true`. */
export async function ownerByToken(token: string, env: { url: string | undefined; anonKey: string | undefined }, fetchFn: OwnerFetch): Promise<boolean> {
  if (!env.url || !env.anonKey) return false;
  const res = await fetchFn(`${env.url.replace(/\/$/, '')}/rest/v1/rpc/is_owner`, {
    method: 'POST',
    headers: { apikey: env.anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  return res.ok && (await res.json()) === true;
}
