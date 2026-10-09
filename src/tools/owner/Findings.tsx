import { useState } from 'react';
import { FINDING_KINDS } from '../../../supabase/functions/_shared/scheduler.ts';
import type { GameContract } from '../../core/contract';
import { ExampleNotice, ExampleTag, GameTag, HowTo, NoData, UnverifiedTag } from '../../core/ui';
import o from './owner.module.css';
import { decideFinding, jobLabel, onApprove, type Decision, type FindingView, type SchedulerData } from './schedulerData';
import { when } from './Scheduler';

/*
 * Owner console → Findings: the inbox of what the jobs found (new leaks, events, info).
 * Approve or Dismiss. Approving only marks the finding; writing it into the built-in
 * lists is the data workstream's logic, behind onApprove (schedulerData.ts).
 */

const KIND_LABEL: Record<string, string> = { leak: 'Leak', event: 'Event', banner: 'Banner', character: 'Character', info: 'Info' };

interface Props {
  data: SchedulerData & { setLocal: (f: (d: SchedulerData) => SchedulerData) => void };
  games: GameContract[];
}

export function Findings({ data, games }: Props) {
  const example = data.mode === 'example';
  const [game, setGame] = useState('all');
  const [kind, setKind] = useState('all');
  const [status, setStatus] = useState<Decision | 'all'>('new');
  const [error, setError] = useState<string | null>(null);

  const gameIds = [...new Set([...games.map((g) => g.id), ...data.findings.map((f) => f.game_id).filter((g): g is string => Boolean(g))])];
  const gameName = (id: string) => games.find((g) => g.id === id)?.short ?? id.toUpperCase();
  const shown = data.findings.filter((f) => (game === 'all' || f.game_id === game) && (kind === 'all' || f.kind === kind) && (status === 'all' || f.status === status));
  const newCount = data.findings.filter((f) => f.status === 'new').length;

  const decide = async (f: FindingView, to: Exclude<Decision, 'new'>) => {
    setError(null);
    try {
      let decidedAt = new Date().toISOString();
      if (example) {
        if (to === 'approved') await onApprove({ ...f, status: to, decided_at: decidedAt });
      } else {
        decidedAt = await decideFinding(f, to);
      }
      data.setLocal((d) => ({ ...d, findings: d.findings.map((x) => (x.id === f.id ? { ...x, status: to, decided_at: decidedAt } : x)) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your decision.');
    }
  };

  return (
    <div className={o.stack}>
      <HowTo
        steps={[
          <>Jobs put what they find here: new leaks, events, banners, characters and other info. Each one says which job delivered it, whether it came from the routine, and when.</>,
          <>Approve what is right, Dismiss what is not. Nothing is ever removed: dismissed findings stay under “Dismissed”.</>,
          <>Approving marks the finding. Adding it to the built-in lists comes with the data workstream; until then approving changes nothing for users.</>,
          <>A finding the same job delivers again within 30 days is not added twice.</>,
        ]}
      />
      {example && <ExampleNotice>This site runs without a server, so these findings are examples. Approving or dismissing them only changes this screen.</ExampleNotice>}
      {error && (
        <p className={o.alert} role="alert">
          {error}
        </p>
      )}

      <section className={o.card} aria-labelledby="findings-title">
        <div className={o.cardHead}>
          <h3 className={o.cardTitle} id="findings-title">
            Inbox <span className={o.count}>{data.loading ? '…' : `${newCount} new`}</span>
          </h3>
          {example && <ExampleTag />}
        </div>
        <div className={o.filters}>
          <label className={o.filter}>
            <span>Game</span>
            <select className={o.select} value={game} onChange={(e) => setGame(e.target.value)}>
              <option value="all">All games</option>
              {gameIds.map((id) => (
                <option key={id} value={id}>
                  {gameName(id)}
                </option>
              ))}
            </select>
          </label>
          <label className={o.filter}>
            <span>Kind</span>
            <select className={o.select} value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="all">All kinds</option>
              {FINDING_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className={o.filter}>
            <span>Status</span>
            <select className={o.select} value={status} onChange={(e) => setStatus(e.target.value as Decision | 'all')}>
              <option value="new">New</option>
              <option value="approved">Approved</option>
              <option value="dismissed">Dismissed</option>
              <option value="all">All</option>
            </select>
          </label>
        </div>

        {data.loading ? (
          <span className={o.note}>Loading…</span>
        ) : shown.length === 0 ? (
          data.findings.length === 0 ? (
            <NoData />
          ) : (
            <span className={o.note}>Nothing matches these filters.</span>
          )
        ) : (
          <ul className={o.log}>
            {shown.map((f) => {
              const vent = games.find((g) => g.id === f.game_id)?.vent;
              return (
                <li key={f.id} className={o.finding}>
                  <div className={o.jobHead}>
                    <span className={o.badge}>{KIND_LABEL[f.kind] ?? f.kind}</span>
                    {f.game_id && (vent ? <GameTag label={gameName(f.game_id)} vent={vent} /> : <span className={o.badge}>{gameName(f.game_id)}</span>)}
                    <span className={o.jobName}>{f.title}</span>
                  </div>
                  {f.kind === 'leak' ? (
                    <UnverifiedTag source={f.source_name ?? 'unknown source'} />
                  ) : (
                    <span className={o.recordMeta}>Source: {f.source_name ?? 'not given'}</span>
                  )}
                  {f.source_url && (
                    <a className={o.link} href={f.source_url} target="_blank" rel="noreferrer noopener">
                      {f.source_url}
                    </a>
                  )}
                  <span className={o.recordMeta}>
                    Delivered by {jobLabel(f.job_id)} · {f.delivered_by === 'routine' ? 'routine' : 'scheduler'} · {when(f.delivered_at)} · found {when(f.found_at)}
                  </span>
                  {Object.keys(f.payload).length > 0 && (
                    <details className={o.payload}>
                      <summary>Details</summary>
                      <pre>{JSON.stringify(f.payload, null, 2)}</pre>
                    </details>
                  )}
                  {f.status === 'new' ? (
                    <div className={o.jobActions}>
                      <button type="button" className={o.publish} onClick={() => void decide(f, 'approved')} aria-label={`Approve: ${f.title}`}>
                        Approve
                      </button>
                      <button type="button" className={o.smallBtn} onClick={() => void decide(f, 'dismissed')} aria-label={`Dismiss: ${f.title}`}>
                        Dismiss
                      </button>
                    </div>
                  ) : (
                    <span className={o.note}>
                      {f.status === 'approved' ? 'Approved' : 'Dismissed'} {when(f.decided_at)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
