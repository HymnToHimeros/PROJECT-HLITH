import { useState } from 'react';
import { FINDING_KINDS } from '../../../supabase/functions/_shared/scheduler.ts';
import type { GameContract } from '../../core/contract';
import { ExampleNotice, ExampleTag, GameTag, HowTo, NoData, UnverifiedTag } from '../../core/ui';
import o from './owner.module.css';
import { LeakPost, postOf } from './LeakPost';
import { jobLabel, type Decision, type SchedulerData } from './schedulerData';
import { when } from './Scheduler';

/*
 * Owner console → Findings: a read-only log of what the jobs found.
 * Every finding is approved automatically when it arrives; the routine can
 * dismiss wrong ones through the decisions endpoint. The owner sees the log
 * but never has to decide. "Move back to new" is still available in case
 * something needs to be re-examined.
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
  const [status, setStatus] = useState<Decision | 'all'>('all');
  const gameName = (id: string) => games.find((g) => g.id === id)?.short ?? id.toUpperCase();

  const gameIds = [...new Set([...games.map((g) => g.id), ...data.findings.map((f) => f.game_id).filter((g): g is string => Boolean(g))])];
  const shown = data.findings.filter((f) => (game === 'all' || f.game_id === game) && (kind === 'all' || f.kind === kind) && (status === 'all' || f.status === status));

  return (
    <div className={o.stack}>
      <HowTo
        steps={[
          <>Every finding the routine delivers is approved automatically when it arrives. The routine can correct itself: wrong findings are dismissed through the decisions endpoint, which also takes out their Intel note and list item.</>,
          <>This screen is a read-only log. Nothing here needs your decision.</>,
          <>Approved findings show in that game's Intel, grouped by topic. A finding that fits a list (characters, events, banners) also goes into it.</>,
        ]}
      />
      {example && <ExampleNotice>This site runs without a server, so these findings are examples.</ExampleNotice>}

      <section className={o.card} aria-labelledby="findings-title">
        <div className={o.cardHead}>
          <h3 className={o.cardTitle} id="findings-title">
            Log <span className={o.count}>{data.loading ? '…' : `${data.findings.length} total`}</span>
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
              <option value="all">All</option>
              <option value="approved">Approved</option>
              <option value="dismissed">Dismissed</option>
              <option value="new">New</option>
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
              const post = postOf(f.payload);
              return (
                <li key={f.id} className={o.finding}>
                  <div className={o.jobHead}>
                    <span className={o.badge}>{KIND_LABEL[f.kind] ?? f.kind}</span>
                    {f.game_id && (vent ? <GameTag label={gameName(f.game_id)} vent={vent} /> : <span className={o.badge}>{gameName(f.game_id)}</span>)}
                    <span className={o.jobName}>{f.title}</span>
                  </div>
                  {f.kind === 'leak' || f.payload.leak === true ? (
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
                  {post && <LeakPost post={post} />}
                  {Object.keys(f.payload).length > 0 && (
                    <details className={o.payload}>
                      <summary>Details</summary>
                      <pre>{JSON.stringify(f.payload, null, 2)}</pre>
                    </details>
                  )}
                  <span className={o.note}>
                    {f.auto_source
                      ? `Auto-approved (${f.auto_source})${f.status === 'dismissed' ? ' → dismissed by routine' : ''}`
                      : `${f.status === 'approved' ? 'Approved' : f.status === 'dismissed' ? 'Dismissed' : 'New'} ${when(f.decided_at)}`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
