import { useState, type FormEvent } from 'react';
import { Button } from '../ui/Button';
import s from './signin.module.css';

interface Props {
  onProvider: (provider: 'google' | 'discord') => Promise<string | null>;
  onEmail: (email: string) => Promise<string | null>;
  /** An invite link (T60) was opened on this device: say so, and open email sign-in too. */
  invited?: boolean;
}

/** The public pages (T55: plain pages outside the app, open without signing in) and the fan notice. */
export function LegalLinks() {
  return (
    <footer className={s.legal}>
      <nav aria-label="About HLIÐSKJÁLF" className={s.legalLinks}>
        <a href="/about">About</a>
        <a href="/privacy">Privacy policy</a>
        <a href="/terms">Terms of service</a>
      </nav>
      <p className={s.fan}>HLIÐSKJÁLF is a fan-made tool, not affiliated with HoYoverse. Game names and art belong to HoYoverse.</p>
      <p className={s.fan}>
        © 2026 HymnToHimeros. All rights reserved. See <a href="https://github.com/HymnToHimeros/PROJECT-HLITH/blob/main/LICENSE">LICENSE</a>.
      </p>
    </footer>
  );
}

/**
 * Remembered on this device once an owner or tester unlocks email sign-in. While signed in
 * the server's answer decides (T60, rememberTester): a tester or the owner keeps it, anyone
 * else loses it. Signed out, the device can't ask, so "Owner or tester?" can still set it.
 */
export const TESTER_KEY = 'hlith.signin.tester';
export function rememberTester(on: boolean): void {
  try {
    if (on) localStorage.setItem(TESTER_KEY, '1');
    else localStorage.removeItem(TESTER_KEY);
  } catch {
    /* storage blocked: nothing to remember */
  }
}
const readTester = () => {
  try {
    return localStorage.getItem(TESTER_KEY) === '1';
  } catch {
    return false;
  }
};

/**
 * Login (DESIGN §4). Discord comes first, then Google; both are open to everyone (owner, T55:
 * Google's sign-in is published). The email link (no mail service set up yet, T10) is shown
 * greyed out with "isn't open to the public yet". "Owner or tester?" unlocks it on this device,
 * and so does an invite link (T60).
 */
export function SignIn({ onProvider, onEmail, invited = false }: Props) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tester, setTester] = useState(() => invited || readTester());

  const run = async (task: () => Promise<string | null>, after?: () => void) => {
    setBusy(true);
    setError(null);
    const err = await task();
    setBusy(false);
    if (err) setError(err);
    else after?.();
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (tester && email.trim()) void run(() => onEmail(email.trim()), () => setSent(true));
  };
  const unlock = () => {
    try {
      localStorage.setItem(TESTER_KEY, '1');
    } catch {
      /* storage blocked: unlocked for this visit only */
    }
    setTester(true);
  };
  const closed = !tester;

  return (
    <main className={s.page}>
      <div className={s.card}>
        <div className="t-label">PROJECT-HLITH</div>
        <h1 className={`t-display ${s.name}`}>HLIÐSKJÁLF</h1>
        <p className={s.lead}>One seat, every world. Sign in to see your games.</p>
        {invited && (
          <p className={s.invited} role="status">
            <strong>You’ve been invited to test HLIÐSKJÁLF.</strong> Sign in with Discord, Google or email, then accept the invite.
          </p>
        )}
        <p className={s.about}>
          A free command hub for Honkai: Star Rail and Zenless Zone Zero: plan pulls, track dailies, events and your roster, on phone and PC.{' '}
          <a href="/about">What it does</a>
        </p>
        <Button variant="primary" className={s.wide} disabled={busy} onClick={() => void run(() => onProvider('discord'))}>
          Continue with Discord
        </Button>

        <Button className={s.wide} disabled={busy} onClick={() => void run(() => onProvider('google'))}>
          Continue with Google
        </Button>

        <div className={s.or}>{closed ? 'COMING LATER' : 'OR'}</div>
        <div className={closed ? s.closed : s.open} aria-describedby={closed ? 'signin-closed-note' : undefined}>
          {closed && (
            <p className={s.closedNote} id="signin-closed-note">
              Email sign-in isn’t open to the public yet. Use Discord or Google.
            </p>
          )}
          {sent ? (
            <p className={s.sent} role="status">
              Check {email} for a sign-in link. It works once and expires soon.
            </p>
          ) : (
            <form className={s.form} onSubmit={submit}>
              <label className="visually-hidden" htmlFor="signin-email">
                Email
              </label>
              <input
                id="signin-email"
                className={s.input}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                disabled={closed}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Button type="submit" className={s.wide} disabled={busy || closed}>
                Email me a sign-in link
              </Button>
            </form>
          )}
        </div>
        {closed && (
          <button type="button" className={s.testerLink} onClick={unlock}>
            Owner or tester? Use email
          </button>
        )}
        {error && (
          <p className={s.error} role="alert">
            {error}
          </p>
        )}
        <p className={s.foot}>Your data is private to your account. Times show in your local time.</p>
        <LegalLinks />
      </div>
    </main>
  );
}
