import { useCallback, useEffect, useState } from 'react';
import { FINDING_KINDS } from '../../../supabase/functions/_shared/scheduler.ts';
import type { GameContract } from '../../core/contract';
import { backend } from '../../core/data/backend';
import { ExampleNotice, ExampleTag, GameTag, HowTo, NoData, UnverifiedTag } from '../../core/ui';
import o from './owner.module.css';
import { planApproval, type Draft } from './approve';
import { LeakPost, postOf } from './LeakPost';
import { decideFinding, jobLabel, reopenFinding, type Decision, type FindingView, type SchedulerData } from './schedulerData';
import { when } from './Scheduler';

/*
 * Owner console → Findings: the inbox of what the jobs found (new leaks, events, info).
 * Approve or Dismiss. Approving a complete event, banner, character or leak adds it to
 * the built-in lists (onApprove in schedulerData.ts); an incomplete one opens the Lists
 * form pre-filled. "Move back to new" retires what the approval added.
 */

const KIND_LABEL: Record<string, string> = { leak: 'Leak', event: 'Event', banner: 'Banner', character: 'Character', info: 'Info' };

interface Props {
  data: SchedulerData & { setLocal: (f: (d: SchedulerData) => SchedulerData) => void };
  games: GameContract[];
  /** Opens Owner console → Lists with this item in the form, for the owner to complete. */
  onDraft?: (draft: Draft) => void;
}

export function Findings({ data, games, onDraft }: Props) {
  const example = data.mode === 'example';
  const [game, setGame] = useState('all');
  const [kind, setKind] = useState('all');
  const [status, setStatus] = useState<Decision | 'all'>('new');
  const [error, setError] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const gameOf = (f: FindingView) => games.find((g) => g.id === f.game_id);

  const gameIds = [...new Set([...games.map((g) => g.id), ...data.findings.map((f) => f.game_id).filter((g): g is string => Boolean(g))])];
  const gameName = (id: string) => games.find((g) => g.id === id)?.short ?? id.toUpperCase();
  const shown = data.findings.filter((f) => (game === 'all' || f.game_id === game) && (kind === 'all' || f.kind === kind) && (status === 'all' || f.status === status));
  const newCount = data.findings.filter((f) => f.status === 'new').length;

  const decide = async (f: FindingView, to: Exclude<Decision, 'new'>) => {
    setError(null);
    setSaid(null);
    try {
      let decidedAt = new Date().toISOString();
      if (example) {
        if (to === 'approved') {
          const plan = planApproval(f, gameOf(f));
          setSaid(plan.ok ? 'Example only: approving it here writes nothing to the lists (this site runs without a server).' : `Approved. ${plan.reason}`);
        }
      } else {
        const done = await decideFinding(f, to, gameOf(f));
        decidedAt = done.decidedAt;
        if (done.result) {
          setSaid(done.result.message);
          if (done.result.kind === 'needs-form') onDraft?.(done.result.draft);
        }
      }
      data.setLocal((d) => ({ ...d, findings: d.findings.map((x) => (x.id === f.id ? { ...x, status: to, decided_at: decidedAt } : x)) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your decision.');
    }
  };

  const reopen = async (f: FindingView) => {
    setError(null);
    setSaid(null);
    try {
      if (!example) {
        const undone = await reopenFinding(f, gameOf(f));
        if (undone) setSaid(undone);
      }
      data.setLocal((d) => ({ ...d, findings: d.findings.map((x) => (x.id === f.id ? { ...x, status: 'new', decided_at: null } : x)) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not move it back.');
    }
  };

  return (
    <div className={o.stack}>
      <HowTo
        steps={[
          <>Jobs put what they find here: new leaks, events, banners, characters and other info. Each one says which job delivered it, whether it came from the routine, and when.</>,
          <>Approve what is right, Dismiss what is not. Nothing is ever removed: dismissed findings stay under “Dismissed”. Changed your mind? “Move back to new” puts it back in the inbox.</>,
          <>Approving a complete event, banner, character or leak adds it to that game’s built-in list for everyone (they see it after reload). If something is missing, the Lists form opens with what the finding gave, so you can finish it.</>,
          <>Everything you approve also shows in that game’s Intel, under News and leaks (leaks marked unverified, posts with their link and translation). An info finding about a new event is checked against the game’s Events: already there, nothing more is added; not there, the Lists form opens with its name and dates. After each Approve the line above the inbox says where it went.</>,
          <>A finding the same job delivers again within 30 days is not added twice.</>,
        ]}
      />
      {example && <ExampleNotice>This site runs without a server, so these findings are examples. Approving or dismissing them only changes this screen.</ExampleNotice>}
      {error && (
        <p className={o.alert} role="alert">
          {error}
        </p>
      )}
      {said && (
        <p className={o.said} role="status">
          {said}
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
                    <div className={o.jobActions}>
                      <span className={o.note}>
                        {f.auto_source
                          ? `Approved automatically (trusted source: ${f.auto_source})`
                          : `${f.status === 'approved' ? 'Approved' : 'Dismissed'} ${when(f.decided_at)}`}
                      </span>
                      <button type="button" className={o.smallBtn} onClick={() => void reopen(f)} aria-label={`Move back to new: ${f.title}`}>
                        Move back to new
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {!example && <TrustedSources />}
    </div>
  );
}

// ── Trusted Sources management ─────────────────────────────────────
interface TrustedSource {
  source_name: string;
  added_at: string;
}

function TrustedSources() {
  const [sources, setSources] = useState<TrustedSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!backend) return;
    let alive = true;
    void backend.from('scheduler_trusted_sources').select('source_name,added_at').order('added_at', { ascending: true }).then(({ data, error: err }) => {
      if (!alive) return;
      if (err) setError(err.message);
      else setSources((data ?? []) as TrustedSource[]);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [tick]);

  const add = async () => {
    const name = newName.trim();
    if (!name || !backend) return;
    setError(null);
    const { error: err } = await backend.from('scheduler_trusted_sources').insert([{ source_name: name }]);
    if (err) setError(err.message);
    else { setNewName(''); reload(); }
  };

  const remove = async (name: string) => {
    if (!backend) return;
    setError(null);
    const { error: err } = await backend.from('scheduler_trusted_sources').delete().eq('source_name', name);
    if (err) setError(err.message);
    else reload();
  };

  return (
    <details className={o.card}>
      <summary className={o.cardHead} style={{ cursor: 'pointer' }}>
        <h3 className={o.cardTitle}>Trusted for leaks</h3>
        <span className={o.count}>{loading ? '...' : sources.length}</span>
      </summary>
      <p className={o.note} style={{ margin: '8px 0' }}>
        Findings from a trusted source are approved automatically when they arrive. Undo still works.
      </p>
      {error && <p className={o.alert} role="alert">{error}</p>}
      {sources.length > 0 && (
        <ul className={o.log}>
          {sources.map((s) => (
            <li key={s.source_name} className={o.finding} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ flex: 1 }}>{s.source_name}</span>
              <span className={o.recordMeta}>since {when(s.added_at)}</span>
              <button type="button" className={o.smallBtn} onClick={() => void remove(s.source_name)}>Remove</button>
            </li>
          ))}
        </ul>
      )}
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        <input
          className={o.select}
          type="text"
          placeholder="Source name (exact match)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void add(); }}
          style={{ flex: 1 }}
        />
        <button type="button" className={o.smallBtn} onClick={() => void add()} disabled={!newName.trim()}>Add</button>
      </div>
    </details>
  );
}
