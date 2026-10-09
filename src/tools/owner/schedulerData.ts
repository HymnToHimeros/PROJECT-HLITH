/**
 * Owner console · Scheduler and Findings: reading and changing the scheduler tables
 * (supabase/migrations/0005_scheduler.sql) as the owner. Row-level security lets only
 * an owner read them, and only change a job's switch / cadence and a finding's decision.
 *
 * Without a server ("this device only") the job list still comes from the code, and the
 * run log and findings are EXAMPLES, built here and always marked as such.
 */
import { useCallback, useEffect, useState } from 'react';
import { JOBS, type JobDef } from '../../../supabase/functions/_shared/jobs.ts';
import type { FindingKind, RunStatus } from '../../../supabase/functions/_shared/scheduler.ts';
import { backend } from '../../core/data/backend';

export interface JobRowFull {
  id: string;
  enabled: boolean;
  cadence: string | null;
  last_run_at: string | null;
  last_status: RunStatus | null;
  last_message: string | null;
  next_due_at: string | null;
  lock_until: string | null;
}

export interface RunView {
  id: number | string;
  job_id: string;
  started_at: string;
  finished_at: string;
  status: RunStatus;
  message: string;
  counts: Record<string, unknown>;
  started_by: 'cron' | 'owner' | 'routine';
}

export type Decision = 'new' | 'approved' | 'dismissed';

export interface FindingView {
  id: string;
  job_id: string;
  game_id: string | null;
  kind: FindingKind;
  title: string;
  payload: Record<string, unknown>;
  source_name: string | null;
  source_url: string | null;
  found_at: string;
  delivered_at: string;
  delivered_by: 'scheduler' | 'routine';
  status: Decision;
  decided_at: string | null;
}

export interface SchedulerData {
  mode: 'live' | 'example';
  loading: boolean;
  error: string | null;
  rows: JobRowFull[];
  runs: RunView[];
  findings: FindingView[];
}

const HOUR = 3_600_000;

/** Example run log, relative to now. Only ever shown with the EXAMPLE notice. */
export function exampleRuns(now: number): RunView[] {
  const iso = (t: number) => new Date(t).toISOString();
  return [
    { id: 'ex-1', job_id: 'hoyolab-daily', started_at: iso(now - 2 * HOUR), finished_at: iso(now - 2 * HOUR + 41_000), status: 'ok', message: 'Example: 2 accounts checked in.', counts: {}, started_by: 'cron' },
    { id: 'ex-2', job_id: 'leaks-scan', started_at: iso(now - 9 * HOUR), finished_at: iso(now - 9 * HOUR), status: 'ok', message: 'Example: Delivered 2 findings.', counts: {}, started_by: 'routine' },
    { id: 'ex-3', job_id: 'backup', started_at: iso(now - 16 * HOUR), finished_at: iso(now - 16 * HOUR + 12_000), status: 'error', message: 'Example: Saving pulls failed.', counts: {}, started_by: 'cron' },
    { id: 'ex-4', job_id: 'backup', started_at: iso(now - 15 * HOUR), finished_at: iso(now - 15 * HOUR + 14_000), status: 'ok', message: 'Example: 17 tables copied.', counts: {}, started_by: 'owner' },
  ];
}

/** Example findings, relative to now, using the first registered games. */
export function exampleFindings(now: number, gameIds: string[]): FindingView[] {
  const iso = (t: number) => new Date(t).toISOString();
  const g = (i: number) => gameIds[i % Math.max(gameIds.length, 1)] ?? null;
  const base = { payload: {}, delivered_by: 'routine' as const, decided_at: null };
  return [
    { ...base, id: 'ex-f1', job_id: 'leaks-scan', game_id: g(0), kind: 'leak', title: 'Example: a new character in the next version', source_name: 'Example source', source_url: null, found_at: iso(now - 10 * HOUR), delivered_at: iso(now - 9 * HOUR), status: 'new', payload: { note: 'example only' } },
    { ...base, id: 'ex-f2', job_id: 'events-scan', game_id: g(1), kind: 'event', title: 'Example: a login event starting next week', source_name: 'Example source', source_url: null, found_at: iso(now - 30 * HOUR), delivered_at: iso(now - 29 * HOUR), status: 'new' },
    { ...base, id: 'ex-f3', job_id: 'game-data-refresh', game_id: g(0), kind: 'character', title: 'Example: kit data for a released character', source_name: 'Example source', source_url: null, found_at: iso(now - 50 * HOUR), delivered_at: iso(now - 49 * HOUR), status: 'approved', decided_at: iso(now - 40 * HOUR) },
  ];
}

/** Loads the three tables (owner only). Without a server: the example set. */
export function useSchedulerData(gameIds: string[]): SchedulerData & { reload: () => void; setLocal: (f: (d: SchedulerData) => SchedulerData) => void } {
  const [now] = useState(() => Date.now());
  const [data, setData] = useState<SchedulerData>(() =>
    backend
      ? { mode: 'live', loading: true, error: null, rows: [], runs: [], findings: [] }
      : { mode: 'example', loading: false, error: null, rows: [], runs: exampleRuns(now), findings: exampleFindings(now, gameIds) },
  );
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const client = backend;
    if (!client) return;
    let alive = true;
    void Promise.all([
      client.from('scheduler_jobs').select('id,enabled,cadence,last_run_at,last_status,last_message,next_due_at,lock_until'),
      client.from('scheduler_runs').select('id,job_id,started_at,finished_at,status,message,counts,started_by').order('started_at', { ascending: false }).limit(50),
      client.from('scheduler_findings').select('id,job_id,game_id,kind,title,payload,source_name,source_url,found_at,delivered_at,delivered_by,status,decided_at').order('delivered_at', { ascending: false }).limit(200),
    ]).then(([jobs, runs, findings]) => {
      if (!alive) return;
      const error = jobs.error?.message ?? runs.error?.message ?? findings.error?.message ?? null;
      setData({
        mode: 'live',
        loading: false,
        error,
        rows: (jobs.data ?? []) as JobRowFull[],
        runs: (runs.data ?? []) as RunView[],
        findings: (findings.data ?? []) as FindingView[],
      });
    });
    return () => {
      alive = false;
    };
  }, [tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...data, reload, setLocal: setData };
}

export async function setJobEnabled(id: string, enabled: boolean): Promise<void> {
  if (!backend) throw new Error('This site runs without a server (this device only).');
  const { error } = await backend.from('scheduler_jobs').update({ enabled }).eq('id', id);
  if (error) throw new Error(error.message);
}

/** Starts one job now through the scheduler function (it checks you are an owner). */
export async function runJobNow(id: string): Promise<void> {
  if (!backend) throw new Error('This site runs without a server (this device only).');
  const { error } = await backend.functions.invoke('scheduler', { body: { job: id } });
  if (error) throw new Error(error.message);
}

/**
 * Hook for approved findings. FRAME only marks a finding approved; actually writing it
 * into the built-in lists (catalog_items: characters, banners, events, leaks …) is logic
 * for the data workstream, which fills this in. Until then approving changes nothing else.
 */
export async function onApprove(finding: FindingView): Promise<void> {
  void finding; // DATA workstream: write the approved finding into catalog_items here.
}

/** Records your decision on a finding, then (for an approval) calls onApprove. */
export async function decideFinding(finding: FindingView, status: Exclude<Decision, 'new'>): Promise<string> {
  if (!backend) throw new Error('This site runs without a server (this device only).');
  const { data: auth } = await backend.auth.getUser();
  const decidedAt = new Date().toISOString();
  const { error } = await backend
    .from('scheduler_findings')
    .update({ status, decided_by: auth.user?.id ?? null, decided_at: decidedAt })
    .eq('id', finding.id);
  if (error) throw new Error(error.message);
  if (status === 'approved') await onApprove({ ...finding, status, decided_at: decidedAt });
  return decidedAt;
}

export const jobLabel = (id: string) => JOBS.find((j) => j.id === id)?.label ?? id;
export { JOBS, type JobDef };
