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
import type { GameContract } from '../../core/contract';
import { backend } from '../../core/data/backend';
import { LIST_KINDS, type CatalogKind, type ListKind } from '../../core/data/catalog';
import { fetchCatalogRows, saveCatalogRow, setCatalogStatus } from '../../core/data/catalogSource';
import { noteFromFinding, noteKey } from '../intel/leakNotes';
import { eventFromInfo, findingSource, planApproval, type Draft } from './approve';

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
export interface TimerStatus {
  running: boolean;
  key_saved: boolean;
}

/** Is the 15-minute timer on, and is the Vault key there? (owner only, live mode) */
export async function timerStatus(): Promise<TimerStatus | null> {
  if (!backend) return null;
  const { data, error } = await backend.rpc('scheduler_timer_status');
  return error ? null : (data as TimerStatus);
}

/** Start or stop the 15-minute timer. Only the owner can; nothing runs until they press Start. */
export async function setTimer(on: boolean): Promise<void> {
  if (!backend) throw new Error('This site runs without a server (this device only).');
  const { error } = await backend.rpc(on ? 'scheduler_timer_start' : 'scheduler_timer_stop');
  if (error) throw new Error(error.message);
}

export async function runJobNow(id: string): Promise<void> {
  if (!backend) throw new Error('This site runs without a server (this device only).');
  const { error } = await backend.functions.invoke('scheduler', { body: { job: id } });
  if (error) throw new Error(error.message);
}

export type ApproveResult =
  | { kind: 'added'; message: string; gameId: string; list: ListKind; id: string }
  | { kind: 'note'; message: string; gameId: string; id: string }
  | { kind: 'needs-form'; message: string; draft: Draft }
  | { kind: 'none'; message: string };

const LIST_NOUN: Record<ListKind, string> = { events: 'Events', banners: 'Banners', backlog: 'Backlog', characters: 'Characters', versions: 'Versions' };

/**
 * Approving a finding (T77): it always shows in that game's Intel (a note, intel/leakNotes.ts),
 * and it also goes into the built-in lists (catalog_items) when it fits one: complete items
 * straight away, otherwise the result carries a pre-filled draft for the Lists form. Every row's
 * source names the finding, so "Move back to new" can retire both again.
 */
export async function onApprove(finding: FindingView, game?: GameContract): Promise<ApproveResult> {
  const where = game?.short ?? finding.game_id?.toUpperCase() ?? '';
  const note = noteFromFinding(finding);
  if (note) await saveCatalogRow({ game_id: note.gameId, kind: 'leak', id: note.id, data: note.data, source: findingSource(finding.id) });
  const list = await toList(finding, game, where);
  if (!note) return list ?? { kind: 'none', message: 'Approved, but nothing was added anywhere: it names no game, so neither Intel nor a game’s list can show it.' };
  const intel = `Added to ${where} · Intel.`;
  if (!list) return { kind: 'note', message: `${intel} Everyone sees it after reload (unless they hide leaks). “Move back to new” takes it out again.`, gameId: note.gameId, id: note.id };
  return { ...list, message: `${intel} ${list.message.replace(/^Approved\. /, '')}` };
}

/** The list part of an approval, or null when no list takes this finding. */
async function toList(finding: FindingView, game: GameContract | undefined, where: string): Promise<ApproveResult | null> {
  // A new event named in an info finding: already listed, or the Lists form opens pre-filled.
  const event = finding.game_id ? eventFromInfo(finding) : null;
  if (event && finding.game_id) {
    const listed = game ? await game.data.events().catch(() => []) : [];
    const same = listed.find((e) => e.title.trim().toLowerCase() === event.title.toLowerCase());
    if (same) return { kind: 'none', message: `“${same.title}” is already in ${where} · Events (${same.start.slice(0, 10)} → ${same.end.slice(0, 10)}), so nothing new went into the list.` };
    const asEvent = planApproval({ ...finding, kind: 'event', payload: { ...event } }, game);
    if (asEvent.ok) return { kind: 'needs-form', message: `“${event.title}” isn’t in ${where} · Events yet. The form is open in Lists with its name and dates; it still needs: ${asEvent.draft.missing.join(', ')}.`, draft: asEvent.draft };
  }
  const plan = planApproval(finding, game);
  if (!plan.ok) return null;
  const { draft } = plan;
  if (draft.missing.length > 0) {
    return { kind: 'needs-form', message: `Approved. To add it to ${LIST_NOUN[draft.list]} it still needs: ${draft.missing.join(', ')}. The form is open in Lists.`, draft };
  }
  const { id, ...data } = draft.item as { id: string } & Record<string, unknown>;
  await saveCatalogRow({ game_id: draft.gameId, kind: LIST_KINDS[draft.list], id, data, source: findingSource(finding.id) });
  const label = String(data.title ?? data.name ?? id);
  return {
    kind: 'added',
    message: `Added “${label}” to ${where} · ${LIST_NOUN[draft.list]}${data.leak ? ' as a leak' : ''}. Everyone sees it after reload. “Move back to new” retires it again.`,
    gameId: draft.gameId,
    list: draft.list,
    id,
  };
}

/** Undoing an approval: what that finding added (its Intel note, its list item) is retired again. Returns what happened, or null if it added nothing. */
export async function undoApprove(finding: FindingView, game?: GameContract): Promise<string | null> {
  const said: string[] = [];
  const retire = async (gameId: string, kind: CatalogKind) => {
    const rows = await fetchCatalogRows(backend, gameId, kind);
    const row = rows.find((r) => r.source === findingSource(finding.id) && r.status === 'active');
    if (!row) return null;
    await setCatalogStatus(row.game_id, kind, row.id, 'retired');
    return row;
  };
  const note = noteFromFinding(finding);
  if (note && (await retire(note.gameId, 'leak'))) said.push(`Took it out of ${game?.short ?? note.gameId.toUpperCase()} · Intel again.`);
  const plan = planApproval(finding, game);
  if (plan.ok) {
    const row = await retire(plan.draft.gameId, LIST_KINDS[plan.draft.list]);
    if (row) said.push(`Retired “${String(row.data.title ?? row.data.name ?? row.id)}” again: it’s out of the list for everyone after reload.`);
  }
  return said.length ? said.join(' ') : null;
}

/** Records your decision on a finding, then (for an approval) calls onApprove. Returns when it was decided, and what approving did. */
export async function decideFinding(finding: FindingView, status: Exclude<Decision, 'new'>, game?: GameContract): Promise<{ decidedAt: string; result: ApproveResult | null }> {
  if (!backend) throw new Error('This site runs without a server (this device only).');
  const { data: auth } = await backend.auth.getUser();
  const decidedAt = new Date().toISOString();
  const { error } = await backend
    .from('scheduler_findings')
    .update({ status, decided_by: auth.user?.id ?? null, decided_at: decidedAt })
    .eq('id', finding.id);
  if (error) throw new Error(error.message);
  const result = status === 'approved' ? await onApprove({ ...finding, status, decided_at: decidedAt }, game) : null;
  return { decidedAt, result };
}

/** "Move back to new": undoes an Approve or Dismiss (the finding returns to the inbox, undecided). An approval's list item is retired again. */
export async function reopenFinding(finding: FindingView, game?: GameContract): Promise<string | null> {
  if (!backend) throw new Error('This site runs without a server (this device only).');
  const undone = finding.status === 'approved' ? await undoApprove(finding, game) : null;
  const { error } = await backend.from('scheduler_findings').update({ status: 'new', decided_by: null, decided_at: null }).eq('id', finding.id);
  if (error) throw new Error(error.message);
  return undone;
}

/**
 * Findings approved before Intel showed them all (or whose note write failed): add their Intel note now.
 * Only adds what is missing (one row per finding, by its source); a retired note stays retired.
 * Returns how many were added.
 */
export async function backfillNotes(findings: FindingView[]): Promise<number> {
  const wanted = findings.filter((f) => f.status === 'approved').flatMap((f) => {
    const note = noteFromFinding(f);
    return note ? [{ f, note }] : [];
  });
  if (!backend || wanted.length === 0) return 0;
  const rows = await fetchCatalogRows(backend, undefined, 'leak');
  const have = new Set(rows.map((r) => r.source));
  // The same item approved twice gets one note (noteKey: same game and title).
  const titles = new Set(rows.filter((r) => r.status === 'active').map((r) => noteKey(r.game_id, String(r.data.title ?? ''))));
  let added = 0;
  for (const { f, note } of wanted) {
    if (have.has(findingSource(f.id))) continue;
    const key = noteKey(note.gameId, note.data.title);
    if (titles.has(key)) continue;
    titles.add(key);
    await saveCatalogRow({ game_id: note.gameId, kind: 'leak', id: note.id, data: note.data, source: findingSource(f.id) });
    added++;
  }
  return added;
}

export const jobLabel = (id: string) => JOBS.find((j) => j.id === id)?.label ?? id;
export { JOBS, type JobDef };
