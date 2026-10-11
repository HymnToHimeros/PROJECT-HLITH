import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import { inviteLink } from '../../core/auth/invite';
import { formatDate } from '../../core/time/reset';
import { Button, HowTo, NoData } from '../../core/ui';
import { inviteState, serverCommunity, type CommunityApi, type InviteRow, type MemberRow } from '../community/communityData';
import o from './owner.module.css';

/*
 * Owner console → Members (T60, migration 0014). The community's groundwork: make one-time
 * invite links, see what became of them, and see and remove testers. Every call is checked
 * on the server (owner only). Nothing is deleted: a removed tester is marked removed, a
 * cancelled link stays listed.
 * No design yet (CLAUDE.md Override 5): the owner console's tokens and parts.
 */

const STATE_LABEL = { unused: 'UNUSED', used: 'USED', cancelled: 'CANCELLED' } as const;
const nameOf = (name: string | null) => name?.trim() || 'No profile name';

export function Members({ api = serverCommunity, origin = typeof window !== 'undefined' ? window.location.origin : '' }: { api?: CommunityApi | null; origin?: string }) {
  const uid = useId();
  const [invites, setInvites] = useState<InviteRow[] | null>(api ? null : []);
  const [members, setMembers] = useState<MemberRow[] | null>(api ? null : []);
  const [note, setNote] = useState('');
  const [made, setMade] = useState<{ link: string; note: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    if (!api) return;
    void Promise.all([api.invites(), api.members()]).then(
      ([i, m]) => {
        setInvites(i);
        setMembers(m);
      },
      (e: unknown) => {
        setInvites([]);
        setMembers([]);
        setError(e instanceof Error ? e.message : 'Could not read members and invites.');
      },
    );
  }, [api]);
  useEffect(reload, [reload]);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setSaid(null);
    try {
      await task();
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t work.');
    } finally {
      setBusy(false);
    }
  };

  const create = (e: FormEvent) => {
    e.preventDefault();
    if (!api) return;
    void run(async () => {
      const { token } = await api.createInvite(note.trim());
      setMade({ link: inviteLink(origin, token), note: note.trim() });
      setCopied(false);
      setNote('');
    });
  };
  const copy = async () => {
    if (!made) return;
    try {
      await navigator.clipboard.writeText(made.link);
      setCopied(true);
    } catch {
      setError('Copying didn’t work here: select the link and copy it by hand.');
    }
  };
  const cancel = (i: InviteRow) =>
    run(async () => {
      if (!api) return;
      const ok = await api.cancelInvite(i.id);
      setSaid(ok ? `Cancelled the invite${i.note ? ` “${i.note}”` : ''}. Its link no longer works.` : 'That invite was already used or cancelled.');
    });
  const remove = (m: MemberRow) =>
    run(async () => {
      if (!api) return;
      setConfirm(null);
      await api.removeMember(m.user_id);
      setSaid(`Removed ${nameOf(m.name)}. They lose the Community page; a new invite brings them back.`);
    });

  const f = (k: string) => `${uid}-${k}`;
  return (
    <div className={o.stack}>
      <HowTo
        steps={[
          <>Make an invite link and send it to someone. Each link works once.</>,
          <>They open it, sign in with Discord or Google, and accept. Then they’re a tester: they see the Community page.</>,
          <>Cancel a link nobody used yet, or remove a tester. You always count as a member.</>,
        ]}
      />
      {!api && <p className={o.note}>This site runs without a server, so there are no members or invites here.</p>}
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

      {api && (
        <form className={o.form} onSubmit={create} aria-label="New invite">
          <h3 className={o.cardTitle}>New invite</h3>
          <label className={o.field} htmlFor={f('note')}>
            Note for you (optional), e.g. who it’s for
            <input id={f('note')} className={o.input} value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} autoComplete="off" />
          </label>
          <div className={o.jobActions}>
            <Button variant="primary" type="submit" disabled={busy}>
              Create invite
            </Button>
          </div>
          {made && (
            <div className={o.card} role="status" aria-label="New invite link">
              <span className={o.itemTitle}>Invite ready{made.note ? ` · ${made.note}` : ''}</span>
              <input className={o.input} readOnly value={made.link} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} />
              <div className={o.jobActions}>
                <Button onClick={() => void copy()}>{copied ? 'Copied' : 'Copy link'}</Button>
              </div>
              <span className={o.note}>Copy it now: only a fingerprint of the link is kept, so it can’t be shown again. Lost it? Cancel it and make a new one.</span>
            </div>
          )}
        </form>
      )}

      <section className={o.card} aria-labelledby={f('members')}>
        <h3 className={o.cardTitle} id={f('members')}>
          Testers{members && members.length ? ` · ${members.length}` : ''}
        </h3>
        {members === null ? (
          <span className={o.note}>Loading…</span>
        ) : members.length === 0 ? (
          <NoData />
        ) : (
          <ul className={o.list}>
            {members.map((m) => (
              <li key={m.user_id} className={o.item} aria-label={nameOf(m.name)}>
                <span className={o.tag}>TESTER</span>
                <span className={o.itemText}>
                  <span className={o.itemTitle}>{nameOf(m.name)}</span>
                  <span className={o.recordMeta}>
                    Joined {formatDate(Date.parse(m.joined_at))}
                    {m.invite_note ? ` · invite “${m.invite_note}”` : ''}
                  </span>
                </span>
                {confirm === m.user_id ? (
                  <span className={o.jobActions}>
                    <button type="button" className={o.smallBtn} disabled={busy} onClick={() => void remove(m)} aria-label={`Yes, remove ${nameOf(m.name)}`}>
                      Yes, remove
                    </button>
                    <button type="button" className={o.smallBtn} onClick={() => setConfirm(null)}>
                      Keep
                    </button>
                  </span>
                ) : (
                  <button type="button" className={o.smallBtn} onClick={() => setConfirm(m.user_id)} aria-label={`Remove ${nameOf(m.name)}`}>
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={o.card} aria-labelledby={f('invites')}>
        <h3 className={o.cardTitle} id={f('invites')}>
          Invites
        </h3>
        {invites === null ? (
          <span className={o.note}>Loading…</span>
        ) : invites.length === 0 ? (
          <NoData />
        ) : (
          <ul className={o.list}>
            {invites.map((i) => {
              const st = inviteState(i);
              const label = i.note || 'Invite';
              return (
                <li key={i.id} className={`${o.item} ${st === 'cancelled' ? o.itemRetired : ''}`} aria-label={label}>
                  <span className={`${o.tag} ${st === 'unused' ? o.tagOwner : ''}`}>{STATE_LABEL[st]}</span>
                  <span className={o.itemText}>
                    <span className={o.itemTitle}>{label}</span>
                    <span className={o.recordMeta}>
                      Made {formatDate(Date.parse(i.created_at))}
                      {st === 'used' && i.used_at ? ` · used by ${nameOf(i.used_by_name)} on ${formatDate(Date.parse(i.used_at))}` : ''}
                      {st === 'cancelled' && i.cancelled_at ? ` · cancelled ${formatDate(Date.parse(i.cancelled_at))}` : ''}
                    </span>
                  </span>
                  {st === 'unused' && (
                    <button type="button" className={o.smallBtn} disabled={busy} onClick={() => void cancel(i)} aria-label={`Cancel invite: ${label}`}>
                      Cancel
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
