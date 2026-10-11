import { useEffect, useState } from 'react';
import { announceRolesChanged, pendingInvite, setPendingInvite } from '../../core/auth/invite';
import type { PanelProps } from '../../core/registry/panels';
import { formatDate } from '../../core/time/reset';
import { Button } from '../../core/ui';
import { serverCommunity, type CommunityApi, type CommunityHome, type InviteStatus } from './communityData';
import c from './community.module.css';

/*
 * Community (T60): the groundwork only. The owner wants a closed community later (the
 * HLIÐSKJÁLF Discord inside the app, and more); for now this page is the frame: a welcome
 * for the first testers and the empty place the Discord will go. Members only: the menu
 * shows it to testers and the owner, and the server (community_home) refuses everyone else.
 * Opening an invite link lands here to accept it.
 * No design yet (CLAUDE.md Override 5): HLIÐSKJÁLF's tokens and parts.
 */

type View =
  | { kind: 'loading' }
  | { kind: 'invite' }
  | { kind: 'invite-bad'; status: Exclude<InviteStatus, 'open' | 'yours'> }
  | { kind: 'member'; home: CommunityHome }
  | { kind: 'outside' }
  | { kind: 'error'; message: string };

const BAD_INVITE: Record<'used' | 'cancelled' | 'unknown', string> = {
  used: 'This invite link was already used by someone else.',
  cancelled: 'This invite link was cancelled.',
  unknown: 'This invite link isn’t valid. It may have been copied only in part.',
};

export default function CommunityPage({ account, api = serverCommunity }: PanelProps & { api?: CommunityApi | null }) {
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);
  const [round, setRound] = useState(0);
  const signedIn = Boolean(account);

  useEffect(() => {
    if (!api || !signedIn) return;
    let alive = true;
    void (async () => {
      const token = pendingInvite();
      if (token) {
        try {
          const status = await api.inviteStatus(token);
          if (!alive) return;
          if (status === 'open') return setView({ kind: 'invite' });
          setPendingInvite(null);
          if (status !== 'yours') return setView({ kind: 'invite-bad', status });
        } catch (e) {
          if (alive) setView({ kind: 'error', message: e instanceof Error ? e.message : 'The invite couldn’t be checked.' });
          return;
        }
      }
      try {
        const home = await api.home();
        if (alive) setView({ kind: 'member', home });
      } catch {
        // The server says no: not a member (or not any more).
        if (alive) setView({ kind: 'outside' });
      }
    })();
    return () => {
      alive = false;
    };
  }, [api, signedIn, round]);

  if (!api) return <p className={c.note}>This site runs without a server, so there’s no community here.</p>;
  if (!signedIn) return <p className={c.note}>Sign in to see the community. It’s for invited testers for now.</p>;

  const accept = async () => {
    const token = pendingInvite();
    if (!token) return setRound((n) => n + 1);
    setBusy(true);
    try {
      await api.accept(token);
      setPendingInvite(null);
      announceRolesChanged();
      setRound((n) => n + 1);
    } catch (e) {
      setView({ kind: 'error', message: e instanceof Error ? e.message : 'The invite couldn’t be accepted.' });
    } finally {
      setBusy(false);
    }
  };
  const decline = () => {
    setPendingInvite(null);
    setRound((n) => n + 1);
  };

  switch (view.kind) {
    case 'loading':
      return <p className={c.note}>Loading…</p>;
    case 'error':
      return (
        <p className={c.alert} role="alert">
          {view.message}
        </p>
      );
    case 'invite':
      return (
        <section className={c.hero} aria-labelledby="community-invite">
          <span className={c.label}>YOU’RE INVITED</span>
          <h2 className={c.title} id="community-invite">
            Join HLIÐSKJÁLF’s first testers
          </h2>
          <p className={c.text}>
            Testers get the Community page and try new things before everyone else. The owner sees your profile name and when you joined in their
            member list. You can be removed or leave by deleting your account.
          </p>
          <div className={c.actions}>
            <Button variant="primary" disabled={busy} onClick={() => void accept()}>
              Accept the invite
            </Button>
            <Button variant="quiet" disabled={busy} onClick={decline}>
              Not now
            </Button>
          </div>
        </section>
      );
    case 'invite-bad':
      return (
        <section className={c.hero} aria-labelledby="community-bad">
          <span className={c.label}>INVITE</span>
          <h2 className={c.title} id="community-bad">
            This invite can’t be used
          </h2>
          <p className={c.text}>{BAD_INVITE[view.status]} Ask the owner for a new one.</p>
          <div className={c.actions}>
            <Button variant="quiet" onClick={() => setRound((n) => n + 1)}>
              OK
            </Button>
          </div>
        </section>
      );
    case 'outside':
      return (
        <section className={c.hero} aria-labelledby="community-outside">
          <span className={c.label}>INVITE ONLY</span>
          <h2 className={c.title} id="community-outside">
            The community is invite-only for now
          </h2>
          <p className={c.text}>It opens to more people later. If you have an invite link, open it while signed in.</p>
        </section>
      );
    case 'member': {
      const { home } = view;
      return (
        <div className={c.stack}>
          <section className={c.hero} aria-labelledby="community-welcome">
            <span className={c.label}>{home.role === 'owner' ? 'COMMUNITY · YOURS' : 'COMMUNITY · FIRST MEMBERS'}</span>
            <h2 className={c.title} id="community-welcome">
              The community is being built.
            </h2>
            <p className={c.lead}>You’re one of the first.</p>
            <dl className={c.facts}>
              <div className={c.fact}>
                <dt>Members so far</dt>
                <dd className={c.factValue}>{home.members}</dd>
              </div>
              <div className={c.fact}>
                <dt>You</dt>
                <dd className={c.factValue}>{home.role === 'owner' ? 'Owner' : 'Tester'}</dd>
              </div>
              {home.joined_at && (
                <div className={c.fact}>
                  <dt>Joined</dt>
                  <dd className={c.factValue}>{formatDate(Date.parse(home.joined_at))}</dd>
                </div>
              )}
            </dl>
          </section>
          <section className={c.slot} aria-label="Community space (coming later)">
            <span className={c.slotLabel}>COMING LATER</span>
            <p className={c.slotText}>The HLIÐSKJÁLF Discord will open right here.</p>
          </section>
        </div>
      );
    }
  }
}
