import { useCallback, useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { formatDate, formatDateTime } from '../../core/time/reset';
import { Button, HowTo, NoData } from '../../core/ui';
import { useNow } from '../../core/ui/useNow';
import { METHOD_LABEL, serverUsers, statusOf, type Action, type Hours, type LogRow, type Status, type UserRow, type UsersApi } from './usersData';
import o from './owner.module.css';

/*
 * Owner console → Users (T60b, migration 0015 + the moderate server function). Everyone who
 * joined, without email addresses: picture and profile name, sign-in methods, joined, last
 * active, tester, status. Per account: Silence, Ban, Remove (a ban plus the normal 30-day
 * deletion, undoable until then), each asked once more with an optional reason. Never on the
 * owner's own account or another owner. Every action is checked on the server and logged.
 * No design yet (CLAUDE.md Override 5): the owner console's tokens and parts.
 */

type Sort = 'newest' | 'active' | 'name';
type Pending = { user: UserRow; action: Action };

const nameOf = (u: { name: string | null }) => u.name?.trim() || 'No profile name';
const untilText = (t: number) => (t === Infinity ? 'until lifted' : `until ${formatDateTime(t)}`);

const ACTION_TEXT: Record<Action, { title: (n: string) => string; body: string; button: string; durations?: { hours: Hours; label: string }[] }> = {
  silence: {
    title: (n) => `Silence ${n}?`,
    body: 'They keep using their own HLITH, but can’t post, share or show up in anything others see.',
    button: 'Silence',
    durations: [
      { hours: 24, label: '24 hours' },
      { hours: 168, label: '7 days' },
      { hours: null, label: 'Until I lift it' },
    ],
  },
  lift_silence: { title: (n) => `Lift the silence on ${n}?`, body: 'They can share and show up again straight away.', button: 'Lift silence' },
  ban: {
    title: (n) => `Ban ${n}?`,
    body: 'They can’t use HLITH at all, and see a calm “suspended” screen with your contact address. Their data is kept.',
    button: 'Ban',
    durations: [
      { hours: 24, label: '24 hours' },
      { hours: 168, label: '7 days' },
      { hours: null, label: 'Permanent' },
    ],
  },
  unban: { title: (n) => `Unban ${n}?`, body: 'They can sign in and use HLITH again straight away.', button: 'Unban' },
  remove: {
    title: (n) => `Remove ${n}?`,
    body: 'They’re banned now, and their account is deleted for good in 30 days (the same as deleting it themselves). Until then you can undo it.',
    button: 'Remove',
  },
  undo_remove: { title: (n) => `Undo removing ${n}?`, body: 'The deletion is cancelled and the ban lifted. Their account is as it was.', button: 'Undo remove' },
};

function StatusTag({ status }: { status: Status }) {
  switch (status.kind) {
    case 'active':
      return null;
    case 'silenced':
      return <span className={o.tag}>SILENCED {status.until === Infinity ? '' : `· ${formatDate(status.until)}`}</span>;
    case 'banned':
      return <span className={`${o.tag} ${o.tagWarn}`}>BANNED {status.until === Infinity ? '' : `· ${formatDate(status.until)}`}</span>;
    case 'removing':
      return <span className={`${o.tag} ${o.tagWarn}`}>REMOVING · {formatDate(status.after)}</span>;
    case 'deleting':
      return <span className={o.tag}>DELETING · {formatDate(status.after)}</span>;
  }
}

/** The actions open for an account in this state. */
function actionsFor(u: UserRow, status: Status): Action[] {
  if (u.owner) return [];
  if (status.kind === 'removing') return ['undo_remove'];
  const out: Action[] = [];
  out.push(status.kind === 'silenced' ? 'lift_silence' : 'silence');
  out.push(status.kind === 'banned' ? 'unban' : 'ban');
  if (status.kind !== 'deleting') out.push('remove');
  return out;
}

const LOG_VERB: Record<Action, string> = {
  silence: 'Silenced',
  lift_silence: 'Lifted the silence on',
  ban: 'Banned',
  unban: 'Unbanned',
  remove: 'Removed',
  undo_remove: 'Undid removing',
};

export function Users({ api = serverUsers, selfId }: { api?: UsersApi | null; selfId?: string | undefined }) {
  const uid = useId();
  const now = useNow(60_000);
  const [users, setUsers] = useState<UserRow[] | null>(api ? null : []);
  const [log, setLog] = useState<LogRow[] | null>(api ? null : []);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('newest');
  const [pending, setPending] = useState<Pending | null>(null);
  const [hours, setHours] = useState<Hours>(24);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!api) return;
    void Promise.all([api.users(), api.log()]).then(
      ([u, l]) => {
        setUsers(u);
        setLog(l);
      },
      (e: unknown) => {
        setUsers([]);
        setLog([]);
        setError(e instanceof Error ? e.message : 'Could not read the accounts.');
      },
    );
  }, [api]);
  useEffect(reload, [reload]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (users ?? []).filter((u) => !q || nameOf(u).toLowerCase().includes(q));
    const t = (v: string | null) => (v ? Date.parse(v) : 0);
    return [...list].sort((a, b) =>
      sort === 'name' ? nameOf(a).localeCompare(nameOf(b)) : sort === 'active' ? t(b.last_active_at) - t(a.last_active_at) : t(b.joined_at) - t(a.joined_at),
    );
  }, [users, query, sort]);

  const open = (user: UserRow, action: Action) => {
    setPending({ user, action });
    setHours(24);
    setReason('');
    setError(null);
    setSaid(null);
  };
  const confirm = async (e: FormEvent) => {
    e.preventDefault();
    if (!api || !pending) return;
    const { user, action } = pending;
    const text = ACTION_TEXT[action];
    setBusy(true);
    setError(null);
    try {
      await api.act({ user_id: user.user_id, action, hours: text.durations ? hours : null, reason: reason.trim() });
      setSaid(`${LOG_VERB[action]} ${nameOf(user)}.`);
      setPending(null);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That didn’t work.');
    } finally {
      setBusy(false);
    }
  };

  const f = (k: string) => `${uid}-${k}`;
  return (
    <div className={o.stack}>
      <HowTo
        steps={[
          <>Everyone who joined HLIÐSKJÁLF, newest first. Email addresses are never shown here.</>,
          <>Silence: they keep their own HLITH but can’t share or show up for others. Ban: they can’t use HLITH at all. Both can end on their own.</>,
          <>Remove: a ban, and their account is deleted in 30 days. You can undo it until then. Every action is logged below, with your reason.</>,
        ]}
      />
      {!api && <p className={o.note}>This site runs without a server, so there are no accounts here.</p>}
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

      <section className={o.card} aria-labelledby={f('users')}>
        <div className={o.cardHead}>
          <h3 className={o.cardTitle} id={f('users')}>
            Users{users && users.length ? ` · ${users.length}` : ''}
          </h3>
          <div className={o.userTools}>
            <label className="visually-hidden" htmlFor={f('q')}>
              Search by name
            </label>
            <input id={f('q')} className={o.input} type="search" placeholder="Search by name" value={query} onChange={(e) => setQuery(e.target.value)} />
            <label className="visually-hidden" htmlFor={f('sort')}>
              Sort
            </label>
            <select id={f('sort')} className={o.select} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="newest">Newest first</option>
              <option value="active">Last active</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>
        {users === null ? (
          <span className={o.note}>Loading…</span>
        ) : shown.length === 0 ? (
          <NoData />
        ) : (
          <ul className={o.list}>
            {shown.map((u) => {
              const status = statusOf(u, now);
              const self = u.user_id === selfId;
              const actions = self ? [] : actionsFor(u, status);
              const avatar = api?.avatarUrl(u.avatar_path) ?? null;
              const isPending = pending?.user.user_id === u.user_id;
              return (
                <li key={u.user_id} className={o.userRow} aria-label={nameOf(u)}>
                  <div className={o.userMain}>
                    <span className={o.userAvatar} aria-hidden="true">
                      {avatar ? <img src={avatar} alt="" loading="lazy" /> : (u.name?.trim().slice(0, 1).toUpperCase() ?? '') || '?'}
                    </span>
                    <span className={o.itemText}>
                      <span className={o.userName}>
                        <span className={o.itemTitle}>{nameOf(u)}</span>
                        {self && <span className={`${o.tag} ${o.tagOwner}`}>YOU</span>}
                        {u.owner && !self && <span className={`${o.tag} ${o.tagOwner}`}>OWNER</span>}
                        {u.tester && <span className={o.tag}>TESTER</span>}
                        <StatusTag status={status} />
                      </span>
                      <span className={o.recordMeta}>
                        {(u.methods.length ? u.methods.map((m) => METHOD_LABEL[m] ?? m) : ['—']).join(' · ')} · joined {formatDate(Date.parse(u.joined_at))}
                        {u.last_active_at ? ` · active ${formatDate(Date.parse(u.last_active_at))}` : ' · not active yet'}
                      </span>
                      {status.kind === 'silenced' && <span className={o.recordMeta}>Silenced {untilText(status.until)}</span>}
                      {status.kind === 'banned' && <span className={o.recordMeta}>Banned {status.until === Infinity ? 'permanently' : untilText(status.until)}</span>}
                      {status.kind === 'removing' && <span className={o.recordMeta}>Removed: deleted for good on {formatDate(status.after)} unless you undo it</span>}
                      {status.kind === 'deleting' && <span className={o.recordMeta}>Deleting their own account on {formatDate(status.after)}</span>}
                    </span>
                    {actions.length > 0 && !isPending && (
                      <span className={o.userActions}>
                        {actions.map((a) => (
                          <button key={a} type="button" className={o.smallBtn} onClick={() => open(u, a)} aria-label={`${ACTION_TEXT[a].button}: ${nameOf(u)}`}>
                            {ACTION_TEXT[a].button}
                          </button>
                        ))}
                      </span>
                    )}
                  </div>
                  {isPending && pending && (
                    <form className={o.confirm} onSubmit={(e) => void confirm(e)} aria-label={ACTION_TEXT[pending.action].title(nameOf(u))}>
                      <span className={o.itemTitle}>{ACTION_TEXT[pending.action].title(nameOf(u))}</span>
                      <span className={o.annText}>{ACTION_TEXT[pending.action].body}</span>
                      {ACTION_TEXT[pending.action].durations && (
                        <fieldset className={o.durations}>
                          <legend className={o.note}>For how long</legend>
                          {ACTION_TEXT[pending.action].durations?.map((d) => (
                            <label key={d.label} className={o.duration}>
                              <input type="radio" name={f('hours')} checked={hours === d.hours} onChange={() => setHours(d.hours)} />
                              {d.label}
                            </label>
                          ))}
                        </fieldset>
                      )}
                      <label className={o.field} htmlFor={f('reason')}>
                        Reason (optional, only you see it)
                        <textarea id={f('reason')} className={o.textarea} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
                      </label>
                      <div className={o.jobActions}>
                        <Button variant="primary" type="submit" disabled={busy}>
                          {ACTION_TEXT[pending.action].button}
                        </Button>
                        <Button variant="quiet" onClick={() => setPending(null)} disabled={busy}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={o.card} aria-labelledby={f('log')}>
        <h3 className={o.cardTitle} id={f('log')}>
          Moderation log
        </h3>
        {log === null ? (
          <span className={o.note}>Loading…</span>
        ) : log.length === 0 ? (
          <NoData />
        ) : (
          <ul className={o.list}>
            {log.map((l) => {
              const until = l.until === 'infinity' ? Infinity : l.until ? Date.parse(l.until) : null;
              return (
                <li key={l.id} className={o.item} aria-label={`${LOG_VERB[l.action]} ${nameOf(l)}`}>
                  <span className={o.itemText}>
                    <span className={o.itemTitle}>
                      {LOG_VERB[l.action]} {nameOf(l)}
                      {until !== null && l.action !== 'remove' ? ` · ${until === Infinity ? (l.action === 'ban' ? 'permanently' : 'until lifted') : `until ${formatDateTime(until)}`}` : ''}
                      {l.action === 'remove' && until !== null && until !== Infinity ? ` · deleted ${formatDate(until)} unless undone` : ''}
                    </span>
                    {l.reason && <span className={o.annText}>“{l.reason}”</span>}
                    <span className={o.recordMeta}>
                      {formatDateTime(Date.parse(l.created_at))}
                      {l.by_name ? ` · by ${l.by_name}` : ''}
                    </span>
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
