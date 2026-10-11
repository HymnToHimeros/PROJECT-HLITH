import { useEffect, useId, useState, type FormEvent } from 'react';
import { LEGAL_VERSIONS } from '../../../config/legal/versions';
import { formatDate } from '../time/reset';
import { Button } from '../ui/Button';
import type { Gate, GateApi } from './gate';
import { LegalLinks } from './SignIn';
import { checkUsername, USERNAME_HINT, type UsernameStatus } from './username';
import s from './signin.module.css';

/**
 * First run (T62, owner): before HLIÐSKJÁLF opens, accept the Terms of service and Privacy
 * policy, then choose a username. Nothing else works until both are done (the server refuses
 * app data until then). Signing out and deleting the account stay possible: people can say no.
 * When only the texts changed (a new version), only step 1 shows again.
 */
export function FirstRun({ gate, api, onDone, onSignOut }: { gate: Gate; api: GateApi; onDone: (next: Gate) => void; onSignOut: () => void }) {
  const legalDone = gate.termsOk && gate.privacyOk;
  const both = !gate.username;
  return (
    <main className={s.page}>
      <div className={s.card}>
        <div className="t-label">{both ? `STEP ${legalDone ? 2 : 1} OF 2` : legalDone ? 'ONE LAST THING' : 'UPDATED TERMS'}</div>
        {!legalDone ? <AcceptStep gate={gate} api={api} onDone={onDone} reaccept={!both} /> : <UsernameStep gate={gate} api={api} onDone={onDone} />}
        <Leave api={api} onSignOut={onSignOut} />
        <LegalLinks />
      </div>
    </main>
  );
}

function AcceptStep({ gate, api, onDone, reaccept }: { gate: Gate; api: GateApi; onDone: (g: Gate) => void; reaccept: boolean }) {
  const id = useId();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      // The versions this page shows; the server refuses them if they're no longer current.
      onDone(await api.accept(LEGAL_VERSIONS.terms, LEGAL_VERSIONS.privacy));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t work. Try again.');
    } finally {
      setBusy(false);
    }
  };
  const stale = gate.termsVersion > LEGAL_VERSIONS.terms || gate.privacyVersion > LEGAL_VERSIONS.privacy;
  return (
    <section className={s.step} aria-labelledby={`${id}-title`}>
      <h1 className={s.stepTitle} id={`${id}-title`}>
        {reaccept ? 'The Terms or Privacy policy changed' : 'Before you start'}
      </h1>
      <p className={s.about}>{reaccept ? 'Please read the current versions and agree to them to keep using HLIÐSKJÁLF.' : 'HLIÐSKJÁLF is free and fan-made. In short:'}</p>
      <div className={s.summary}>
        <h2 className={s.summaryTitle}>Terms of service</h2>
        <ul className={s.summaryList}>
          <li>A free tool, offered as it is. Use it fairly and don’t harass anyone.</li>
          <li>Your game accounts follow HoYoverse’s terms; the HoYoLAB automation is optional and your choice.</li>
          <li>The owner may silence, suspend or remove accounts that break the rules.</li>
        </ul>
        <a className={s.summaryLink} href="/terms" target="_blank" rel="noopener">
          Read the full Terms of service
        </a>
      </div>
      <div className={s.summary}>
        <h2 className={s.summaryTitle}>Privacy policy</h2>
        <ul className={s.summaryList}>
          <li>Only what the app needs: your sign-in, settings, game data and the extras you switch on. Kept in London, UK.</li>
          <li>No ads, no tracking, never sold. Your email is never shown to anyone.</li>
          <li>Download or delete everything, any time.</li>
        </ul>
        <a className={s.summaryLink} href="/privacy" target="_blank" rel="noopener">
          Read the full Privacy policy
        </a>
      </div>
      <label className={s.agree} htmlFor={`${id}-agree`}>
        <input id={`${id}-agree`} type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>I have read and understood the Terms of service and Privacy policy, and I agree to them.</span>
      </label>
      {stale && <p className={s.error}>This page is out of date. Reload it to read the current versions.</p>}
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      <Button variant="primary" className={s.wide} disabled={!agreed || busy || stale} onClick={() => void accept()}>
        Continue
      </Button>
    </section>
  );
}

function UsernameStep({ gate, api, onDone }: { gate: Gate; api: GateApi; onDone: (g: Gate) => void }) {
  return (
    <section className={s.step} aria-labelledby="choose-username">
      <h1 className={s.stepTitle} id="choose-username">
        Choose a username
      </h1>
      <p className={s.about}>It’s how you show up in HLIÐSKJÁLF: on your profile card, in the community and to the owner. You can change it later, once every 30 days.</p>
      <UsernameForm api={api} initial={gate.suggested ?? ''} owner={gate.owner} submitLabel="Continue" onSaved={onDone} />
    </section>
  );
}

/** A username field with a live "available / taken" check. Also used in Profile. */
export function UsernameForm({
  api,
  initial,
  current = null,
  owner = false,
  submitLabel,
  onSaved,
  onCancel,
}: {
  api: GateApi;
  initial: string;
  current?: string | null;
  /** The owner may choose reserved names. */
  owner?: boolean;
  submitLabel: string;
  onSaved: (g: Gate) => void;
  onCancel?: () => void;
}) {
  const id = useId();
  const [name, setName] = useState(initial);
  const [checked, setChecked] = useState<{ name: string; status: UsernameStatus } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = name.trim();
  const local = checkUsername(trimmed, owner);

  // Ask the server whether a well-formed name is free, a moment after typing stops.
  useEffect(() => {
    if (local !== 'ok') return;
    let alive = true;
    const t = setTimeout(() => {
      void api.status(trimmed).then(
        (status) => alive && setChecked({ name: trimmed, status }),
        () => alive && setChecked(null),
      );
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [api, trimmed, local]);

  const status: UsernameStatus | null = !trimmed ? null : local !== 'ok' ? local : checked?.name === trimmed ? checked.status : null;
  const same = current !== null && trimmed === current;
  const canSave = !busy && !same && (status === 'ok' || status === 'yours');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(await api.setUsername(trimmed));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That didn’t work. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className={s.form} onSubmit={(e) => void submit(e)}>
      <label className={s.fieldLabel} htmlFor={`${id}-name`}>
        Username
      </label>
      <input
        id={`${id}-name`}
        className={s.input}
        value={name}
        maxLength={20}
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        onChange={(e) => setName(e.target.value)}
        aria-describedby={`${id}-hint`}
        aria-invalid={status !== null && status !== 'ok' && status !== 'yours'}
      />
      <p className={status === 'ok' || status === 'yours' ? s.hintOk : status ? s.hintBad : s.hint} id={`${id}-hint`} aria-live="polite">
        {same ? 'That’s your username now.' : status ? USERNAME_HINT[status] : trimmed ? 'Checking…' : USERNAME_HINT.invalid}
      </p>
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" className={s.wide} disabled={!canSave}>
        {submitLabel}
      </Button>
      {onCancel && (
        <Button variant="quiet" className={s.wide} onClick={onCancel}>
          Cancel
        </Button>
      )}
    </form>
  );
}

/** Saying no stays possible: sign out, or delete the account (the normal 30-day deletion). */
function Leave({ api, onSignOut }: { api: GateApi; onSignOut: () => void }) {
  const id = useId();
  const [asking, setAsking] = useState(false);
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null | 'started'>(null);
  const [error, setError] = useState<string | null>(null);
  const del = async () => {
    setBusy(true);
    setError(null);
    try {
      const at = await api.deleteAccount();
      setDone(at ?? 'started');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t work. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={s.leave}>
      {done !== null ? (
        <p className={s.about} role="status">
          Your account will be deleted for good{typeof done === 'number' ? ` on ${formatDate(done)}` : ' in 30 days'}. Signing in again before then lets you keep it.
        </p>
      ) : asking ? (
        <div className={s.form}>
          <label className={s.fieldLabel} htmlFor={`${id}-word`}>
            This deletes your account and everything in it, for good, after 30 days. Type DELETE to confirm.
          </label>
          <input id={`${id}-word`} className={s.input} value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" />
          {error && (
            <p className={s.error} role="alert">
              {error}
            </p>
          )}
          <Button className={s.wide} disabled={word !== 'DELETE' || busy} onClick={() => void del()}>
            Delete my account
          </Button>
          <Button variant="quiet" className={s.wide} onClick={() => setAsking(false)}>
            Keep my account
          </Button>
        </div>
      ) : null}
      <div className={s.leaveRow}>
        <Button variant="quiet" onClick={onSignOut}>
          Sign out
        </Button>
        {!asking && done === null && (
          <Button variant="quiet" onClick={() => setAsking(true)}>
            Delete my account
          </Button>
        )}
      </div>
    </div>
  );
}
