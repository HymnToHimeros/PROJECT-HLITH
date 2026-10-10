import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import { backend } from '../../core/data/backend';
import { allAnnouncements, createAnnouncement, endAnnouncement, isActive, type Announcement } from '../../core/data/announcements';
import { formatDateTime } from '../../core/time/reset';
import { Button, HowTo, NoData } from '../../core/ui';
import o from './owner.module.css';

/*
 * Owner console → Announcements (public.announcements, migration 0008). Write a short
 * note for everyone signed in, optionally scheduled, and end it whenever you like. It
 * shows as a strip at the top of the app while active; each person can hide it on their
 * device. Nothing is deleted: ended announcements stay listed.
 * No design yet (CLAUDE.md Override 5): the owner console's tokens and parts.
 */

const toLocalInput = (t: number) => new Date(t - new Date(t).getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

function stateOf(a: Announcement, now: number): 'live' | 'scheduled' | 'ended' {
  if (isActive(a, now)) return 'live';
  return Date.parse(a.starts_at) > now ? 'scheduled' : 'ended';
}
const STATE_LABEL = { live: 'SHOWING', scheduled: 'SCHEDULED', ended: 'ENDED' } as const;

export function Announcements() {
  const live = Boolean(backend);
  const uid = useId();
  const [list, setList] = useState<Announcement[] | null>(live ? null : []);
  const [error, setError] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [level, setLevel] = useState<'info' | 'warning'>('info');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const reload = useCallback(() => {
    if (!live) return;
    void allAnnouncements().then(
      (rows) => {
        setList(rows);
        setNow(Date.now());
      },
      (e: unknown) => {
        setList([]);
        setError(e instanceof Error ? e.message : 'Could not read the announcements.');
      },
    );
  }, [live]);
  useEffect(reload, [reload]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaid(null);
    if (!title.trim()) return setError('Give it a title.');
    const t = Date.now();
    const startsAt = start ? new Date(start).toISOString() : new Date(t).toISOString();
    const endsAt = end ? new Date(end).toISOString() : null;
    if (endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) return setError('It has to end after it starts.');
    try {
      await createAnnouncement({ title: title.trim(), body: body.trim(), level, starts_at: startsAt, ends_at: endsAt });
      setSaid(
        Date.parse(startsAt) > t
          ? `Scheduled “${title.trim()}”: everyone signed in sees it from ${formatDateTime(Date.parse(startsAt))}.`
          : `Published “${title.trim()}”: everyone signed in sees it at the top of the app after reload${endsAt ? `, until ${formatDateTime(Date.parse(endsAt))}` : ''}.`,
      );
      setTitle('');
      setBody('');
      setStart('');
      setEnd('');
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not publish it.');
    }
  };

  const endNow = async (a: Announcement) => {
    setError(null);
    try {
      await endAnnouncement(a);
      setSaid(`Ended “${a.title}”: it stops showing for everyone after reload.`);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not end it.');
    }
  };

  const f = (k: string) => `${uid}-${k}`;
  return (
    <div className={o.stack}>
      <HowTo
        steps={[
          <>Write a short note for everyone signed in. It shows as a strip at the top of every page while it runs.</>,
          <>Leave the start empty to publish now, or pick a time to schedule it. Leave the end empty to keep it until you end it.</>,
          <>Each person can hide it on their device. End now stops it for everyone; ended notes stay listed here.</>,
        ]}
      />
      {!live && <p className={o.note}>This site runs without a server, so announcements can’t reach anyone from here.</p>}
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

      {live && (
        <form className={o.form} onSubmit={(e) => void submit(e)} aria-label="New announcement">
          <h3 className={o.cardTitle}>New announcement</h3>
          <div className={o.formGrid}>
            <label className={`${o.field} ${o.wide}`} htmlFor={f('title')}>
              Title
              <input id={f('title')} className={o.input} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} autoComplete="off" />
            </label>
            <label className={`${o.field} ${o.wide}`} htmlFor={f('body')}>
              More detail (optional)
              <textarea id={f('body')} className={o.textarea} value={body} maxLength={2000} onChange={(e) => setBody(e.target.value)} />
            </label>
            <label className={o.field} htmlFor={f('level')}>
              Kind
              <select id={f('level')} className={o.select} value={level} onChange={(e) => setLevel(e.target.value as 'info' | 'warning')}>
                <option value="info">News</option>
                <option value="warning">Heads up (problem, downtime)</option>
              </select>
            </label>
            <label className={o.field} htmlFor={f('start')}>
              Starts (empty = now)
              <input id={f('start')} className={o.input} type="datetime-local" min={toLocalInput(now)} value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className={o.field} htmlFor={f('end')}>
              Ends (empty = until you end it)
              <input id={f('end')} className={o.input} type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
            </label>
          </div>
          <div className={o.jobActions}>
            <Button variant="primary" type="submit">
              {start && Date.parse(new Date(start).toISOString()) > now ? 'Schedule' : 'Publish'}
            </Button>
          </div>
        </form>
      )}

      <section className={o.card} aria-labelledby="ann-title">
        <h3 className={o.cardTitle} id="ann-title">
          Announcements
        </h3>
        {list === null ? (
          <span className={o.note}>Loading…</span>
        ) : list.length === 0 ? (
          <NoData />
        ) : (
          <ul className={o.list}>
            {list.map((a) => {
              const st = stateOf(a, now);
              return (
                <li key={a.id} className={`${o.item} ${st === 'ended' ? o.itemRetired : ''}`} aria-label={a.title}>
                  <span className={`${o.tag} ${st === 'live' ? o.tagOwner : ''}`}>{STATE_LABEL[st]}</span>
                  {a.level === 'warning' && <span className={o.tag}>HEADS UP</span>}
                  <span className={o.itemText}>
                    <span className={o.itemTitle}>{a.title}</span>
                    {a.body && <span className={o.annText}>{a.body}</span>}
                    <span className={o.recordMeta}>
                      From {formatDateTime(Date.parse(a.starts_at))}
                      {a.ends_at ? ` until ${formatDateTime(Date.parse(a.ends_at))}` : ' until you end it'}
                    </span>
                  </span>
                  {st !== 'ended' && (
                    <button type="button" className={o.smallBtn} aria-label={`End now: ${a.title}`} onClick={() => void endNow(a)}>
                      End now
                    </button>
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
