import { useEffect, useState } from 'react';
import { runnerOf } from '../../../supabase/functions/_shared/jobs.ts';
import { describeCadence, dueJobs, effectiveCadence, externalNext, nextSlot, runnable, selfAdjusting } from '../../../supabase/functions/_shared/scheduler.ts';
import { ExampleNotice, ExampleTag, HowTo, NoData } from '../../core/ui';
import o from './owner.module.css';
import { JOBS, jobLabel, runJobNow, setJobEnabled, setTimer, timerStatus, type TimerStatus, type JobDef, type JobRowFull, type RunView, type SchedulerData } from './schedulerData';

/*
 * Owner console → Scheduler. Every job from supabase/functions/_shared/jobs.ts with its
 * cadence, who runs it, its switch, last run, next due and "Run now", plus the run log.
 * The fixed jobs run in Supabase (one cron job → scheduler function); the "find new info"
 * jobs run in an external routine and only deliver here (findings-intake, docs/ROUTINES.md).
 */

export const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : null);

const STATUS_LABEL: Record<string, string> = { ok: 'OK', error: 'ERROR', skipped: 'SKIPPED', frame: 'FRAME' };
const BY_LABEL: Record<RunView['started_by'], string> = { cron: 'schedule', owner: 'you', routine: 'routine' };

export function StatusBadge({ status }: { status: string }) {
  return <span className={`${o.badge} ${o[`st_${status}`] ?? ''}`}>{STATUS_LABEL[status] ?? status.toUpperCase()}</span>;
}

interface Props {
  data: SchedulerData & { reload: () => void };
  now: number;
}

export function Scheduler({ data, now }: Props) {
  const example = data.mode === 'example';
  const rowOf = (id: string) => data.rows.find((r) => r.id === id);
  const supabaseJobs = JOBS.filter((j) => j.target.kind !== 'external');
  const routineJobs = JOBS.filter((j) => j.target.kind === 'external');
  const notStarted = data.mode === 'live' && !data.loading && !data.error && !data.runs.some((r) => r.started_by === 'cron');

  return (
    <div className={o.stack}>
      <HowTo
        steps={[
          <>One database cron job starts the scheduler every 15 minutes. It runs each fixed job (backup, HoYoLAB daily) when its time comes, never two copies at once, and writes every run in the log below.</>,
          <>The “find new info” jobs (leaks, events, new game data) are done by a separate routine chat a few times a week. It delivers what it finds to Findings; its deliveries show up in the log as “routine”.</>,
          <>LIVE means the job’s logic is built. FRAME means the slot exists but the logic is not built yet: it records “frame only” and never invents data.</>,
          <>Switch a job off to skip it until you switch it back on. “Run now” starts one job straight away; its result appears in the log within a minute.</>,
        ]}
      >
        Times are UTC. A job due at 16:10 runs at the next 15-minute tick after it.
      </HowTo>

      {example && <ExampleNotice>This site runs without a server, so the run log below is an example. The job list itself is the real one from the code.</ExampleNotice>}
      {data.error && (
        <p className={o.alert} role="alert">
          Could not read the scheduler: {data.error}
        </p>
      )}
      {data.mode === 'live' && <TimerCard notStarted={notStarted} />}

      <section className={o.card} aria-labelledby="sched-supabase">
        <h3 className={o.cardTitle} id="sched-supabase">
          Run by Supabase
        </h3>
        {supabaseJobs.map((j) => (
          <JobRow key={j.id} job={j} row={rowOf(j.id)} now={now} example={example} reload={data.reload} />
        ))}
      </section>

      <section className={o.card} aria-labelledby="sched-routine">
        <h3 className={o.cardTitle} id="sched-routine">
          Run by the external routine
        </h3>
        <span className={o.note}>These run in their own chat, not in Supabase. The routine is set up from docs/ROUTINES.md; until it delivers, they stay FRAME.</span>
        {routineJobs.map((j) => (
          <JobRow key={j.id} job={j} row={rowOf(j.id)} now={now} example={example} reload={data.reload} />
        ))}
      </section>

      <section className={o.card} aria-labelledby="sched-log">
        <div className={o.cardHead}>
          <h3 className={o.cardTitle} id="sched-log">
            Run log
          </h3>
          {example && <ExampleTag />}
        </div>
        {data.loading ? (
          <span className={o.note}>Loading…</span>
        ) : data.runs.length === 0 ? (
          <NoData />
        ) : (
          <ul className={o.log}>
            {data.runs.map((r) => (
              <li key={r.id} className={o.logRow}>
                <StatusBadge status={r.status} />
                <span className={o.logJob}>{jobLabel(r.job_id)}</span>
                <span className={o.logMsg}>{r.message}</span>
                <span className={o.recordMeta}>
                  {when(r.started_at)} · by {BY_LABEL[r.started_by]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function JobRow({ job, row, now, example, reload }: { job: JobDef; row: JobRowFull | undefined; now: number; example: boolean; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const eff = effectiveCadence(job, row);
  const external = job.target.kind === 'external';
  const included = job.target.kind === 'included';
  const enabled = row ? row.enabled : true;
  const lastRun = row?.last_run_at ?? null;
  // A routine's job is expected when its last delivery said (next_at), else on its fallback cadence.
  const ext = external ? externalNext(job, row, now) : null;
  const due = !included && enabled && row !== undefined && (ext ? ext.overdue : dueJobs([job], [row], now).length > 0);
  const nextAt = ext ? ext.at : nextSlot(eff.cadence, now);

  const toggle = async () => {
    setBusy(true);
    try {
      await setJobEnabled(job.id, !enabled);
      reload();
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Could not change it.');
    } finally {
      setBusy(false);
    }
  };
  const run = async () => {
    setBusy(true);
    setNote(null);
    try {
      await runJobNow(job.id);
      setNote('Started. The result appears in the run log within a minute.');
      setTimeout(reload, 8000);
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Could not start it.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className={o.job} aria-label={job.label}>
      <div className={o.jobHead}>
        <span className={o.jobName}>{job.label}</span>
        <span className={`${o.badge} ${job.status === 'live' ? o.st_ok : o.st_frame}`}>{job.status === 'live' ? 'LIVE' : 'FRAME'}</span>
        <span className={o.recordMeta}>{runnerOf(job)}</span>
      </div>
      <span className={o.jobDoes}>{job.does}</span>
      <dl className={o.facts}>
        <div>
          <dt>{external ? 'Expected' : 'Cadence'}</dt>
          <dd>
            {included && job.target.kind === 'included'
              ? `With ${jobLabel(job.target.in)}`
              : selfAdjusting(job) && !eff.overridden
                ? 'Self-adjusting: the routine says when it runs next'
                : describeCadence(eff.cadence)}
            {eff.overridden && ' (your change)'}
            {eff.badOverride && ' (your change could not be read; using the default)'}
          </dd>
        </div>
        <div>
          <dt>{external ? 'Last delivery' : 'Last run'}</dt>
          <dd>
            {included ? (
              'See its parent job'
            ) : lastRun ? (
              <>
                {when(lastRun)} {row?.last_status && <StatusBadge status={row.last_status} />}
                {row?.last_message && <span className={o.lastMsg}>{row.last_message}</span>}
              </>
            ) : (
              <NoData dash={false} />
            )}
          </dd>
        </div>
        {!included && (
          <div>
            <dt>{external ? 'Next expected' : 'Next due'}</dt>
            <dd>{!enabled ? 'Switched off' : due ? (external ? 'Overdue' : 'Due now (next tick)') : nextAt === null ? 'After its first delivery' : when(new Date(nextAt).toISOString())}</dd>
          </div>
        )}
        <div>
          <dt>Logic built by</dt>
          <dd>{job.logicOwner}</dd>
        </div>
      </dl>
      {runnable(job) && (
        <div className={o.jobActions}>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label={`${job.label} on`}
            className={o.switch}
            disabled={example || !row || busy}
            title={example ? 'Needs the server' : !row ? 'Appears after the scheduler’s first run' : undefined}
            onClick={() => void toggle()}
          >
            <span className={o.knob} />
          </button>
          <span className={o.note}>{enabled ? 'On' : 'Off'}</span>
          <button type="button" className={o.smallBtn} disabled={example || busy} title={example ? 'Needs the server' : undefined} onClick={() => void run()}>
            Run now
          </button>
        </div>
      )}
      {external && <span className={o.note}>Started by the routine in its own chat; there is nothing to start here.</span>}
      {note && (
        <span className={o.note} role="status">
          {note}
        </span>
      )}
    </article>
  );
}

/** The on/off switch for the 15-minute timer. Nothing is scheduled until the owner presses Start. */
function TimerCard({ notStarted }: { notStarted: boolean }) {
  const [status, setStatus] = useState<TimerStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const load = () => void timerStatus().then(setStatus);
  useEffect(load, []);
  const flip = async (on: boolean) => {
    setBusy(true);
    setProblem(null);
    try {
      await setTimer(on);
      load();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={o.card} aria-labelledby="sched-timer">
      <h3 className={o.cardTitle} id="sched-timer">
        Timer
      </h3>
      <span className={o.note}>
        {status === null
          ? 'Checking…'
          : status.running
            ? 'On: the scheduler starts every 15 minutes.'
            : 'Off: nothing runs on its own until you press Start.'}
      </span>
      {status && !status.key_saved && (
        <p className={o.alert} role="status">
          Before starting: add the Vault secret <code>scheduler_key</code> (Supabase → Integrations → Vault), or every run is refused.
        </p>
      )}
      {status?.running && notStarted && <span className={o.note}>Started; the first run shows in the log within 15 minutes.</span>}
      <span>
        <button type="button" className={o.smallBtn} disabled={busy || status === null} onClick={() => void flip(!status?.running)}>
          {status?.running ? 'Stop timer' : 'Start timer'}
        </button>
      </span>
      {problem && (
        <p className={o.alert} role="alert">
          {problem}
        </p>
      )}
    </section>
  );
}
