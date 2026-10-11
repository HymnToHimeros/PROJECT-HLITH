/**
 * The scheduler's job list (one entry per job). The scheduler function
 * (supabase/functions/scheduler) reads this list on every run, and the Owner
 * console shows it.
 *
 * Adding a job = one entry here + the server function (or in-process handler) it runs.
 * The job's database row (supabase/migrations/0005_scheduler.sql, scheduler_jobs)
 * is created by the scheduler itself on its next run.
 *
 * Two runners:
 *  - the Supabase scheduler (target 'function' / 'frame'): fixed jobs, run by the one cron job;
 *  - an external routine (target 'external'): the "find new info" jobs need reading and
 *    judgement, so a separate scheduled Claude Code routine does them and delivers what it
 *    finds to the findings-intake function (docs/ROUTINES.md). Supabase never runs these.
 *    Their cadence is "self-adjusting": with each delivery the routine says when it runs each
 *    job next (next_at), and the Owner console expects it then ("Overdue" once that has passed).
 *    `fallbackCadence` is used only when a delivery gives no time for a job.
 *
 * status 'frame' = the slot exists but the logic is not built yet. A 'frame' target runs
 * as a no-op that records "frame only — logic not built yet" and never writes findings.
 * An external job is 'live' once its routine is set up and delivering.
 *
 * Cadence (all times UTC): "daily 16:10", "mon,wed,fri 06:00", "every 6h".
 * See parseCadence in scheduler.ts.
 */

export type JobTarget =
  /** Calls the server function of that name with the service key. */
  | { kind: 'function'; name: string }
  /** Slot only: logic not built yet (run by the scheduler as a no-op). */
  | { kind: 'frame' }
  /** Done by an external routine that delivers findings to findings-intake; never run by Supabase. */
  | { kind: 'external' }
  /** Already done inside another job; never run on its own. */
  | { kind: 'included'; in: string };

export interface JobDef {
  id: string;
  label: string;
  /** What it does, in plain English. */
  does: string;
  /** Default cadence, or SELF_ADJUSTING for routine jobs. The owner can override it per job (scheduler_jobs.cadence). */
  cadence: string;
  /** Self-adjusting jobs: the cadence used when a delivery gives no next time for the job. */
  fallbackCadence?: string;
  target: JobTarget;
  /** Workstream that owns the job's logic. */
  logicOwner: string;
  status: 'live' | 'frame';
  /** Longest the scheduler waits for an answer. A job only starts when this much time is left in the run. */
  maxSeconds: number;
}

/** The cadence text of jobs whose routine says when it runs next (findings-intake next_at). */
export const SELF_ADJUSTING = 'self-adjusting';

export const JOBS: readonly JobDef[] = [
  {
    id: 'backup',
    label: 'Nightly backup',
    does: 'Copies every table into the private backups folder as JSON, one folder per night. Never changes or deletes a row.',
    cadence: 'daily 02:40',
    target: { kind: 'function', name: 'backup' },
    logicOwner: 'FRAME workstream',
    status: 'live',
    maxSeconds: 120,
  },
  {
    id: 'hoyolab-daily',
    label: 'HoYoLAB daily check-in and codes',
    does: 'Claims the daily check-in and tries new codes for every saved HoYoLAB account whose owner switched it on.',
    cadence: 'daily 16:10',
    target: { kind: 'function', name: 'hoyolab-daily' },
    logicOwner: 'FRAME workstream',
    status: 'live',
    maxSeconds: 135,
  },
  {
    id: 'codes-refresh',
    label: 'Code list refresh',
    does: 'Copies the public list of redeem codes into the database. Already part of the HoYoLAB daily job, so it never runs on its own.',
    cadence: 'daily 16:10',
    target: { kind: 'included', in: 'hoyolab-daily' },
    logicOwner: 'FRAME workstream',
    status: 'live',
    maxSeconds: 0,
  },
  {
    id: 'leaks-scan',
    label: 'Leak scan',
    does: 'Looks for new leaks (for example the new-item lists in the nanoka.cc data) and delivers each one to Findings for you to approve or dismiss.',
    cadence: SELF_ADJUSTING,
    fallbackCadence: 'mon,wed,fri 06:00',
    target: { kind: 'external' },
    logicOwner: 'DATA workstream (routine chat)',
    status: 'live',
    maxSeconds: 0,
  },
  {
    id: 'events-scan',
    label: 'Events and banners scan',
    does: 'Looks for new events, banners and versions and delivers each one to Findings for you to approve or dismiss.',
    cadence: SELF_ADJUSTING,
    fallbackCadence: 'mon,wed,fri 06:00',
    target: { kind: 'external' },
    logicOwner: 'DATA workstream (routine chat)',
    status: 'live',
    maxSeconds: 0,
  },
  {
    id: 'game-data-refresh',
    label: 'Game data refresh',
    does: 'After a patch, looks for new characters, items and kits and delivers each one to Findings for you to approve or dismiss.',
    cadence: SELF_ADJUSTING,
    fallbackCadence: 'mon,wed,fri 06:00',
    target: { kind: 'external' },
    logicOwner: 'DATA workstream (routine chat)',
    status: 'live',
    maxSeconds: 0,
  },
  {
    id: 'research-routine',
    label: 'Research routine',
    does: 'Reads the official notices the importers don’t read, checks a second leak source and fills gaps in the lists, then delivers each find to Findings for you to approve or dismiss.',
    cadence: SELF_ADJUSTING,
    fallbackCadence: 'mon 08:50',
    target: { kind: 'external' },
    logicOwner: 'SCHEDULER workstream (research routine)',
    // Live once its routine delivers (one-line change then).
    status: 'frame',
    maxSeconds: 0,
  },
];

export const FRAME_MESSAGE = 'frame only — logic not built yet';

/** Who runs a job, in plain English. */
export function runnerOf(job: JobDef): 'Supabase scheduler' | 'External routine' | 'Inside another job' {
  if (job.target.kind === 'external') return 'External routine';
  if (job.target.kind === 'included') return 'Inside another job';
  return 'Supabase scheduler';
}

/** Jobs whose findings come in through findings-intake. */
export const EXTERNAL_JOB_IDS: readonly string[] = JOBS.filter((j) => j.target.kind === 'external').map((j) => j.id);

export const findJob = (id: string): JobDef | undefined => JOBS.find((j) => j.id === id);
