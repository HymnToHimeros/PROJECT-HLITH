import { useState, type FormEvent } from 'react';
import { Button } from '../ui/Button';
import s from './signin.module.css';

interface Props {
  onProvider: (provider: 'google' | 'discord') => Promise<string | null>;
  onEmail: (email: string) => Promise<string | null>;
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
    </footer>
  );
}

/** Remembered on this device once an owner or tester unlocks Google and email sign-in. */
export const TESTER_KEY = 'hlith.signin.tester';
const readTester = () => {
  try {
    return localStorage.getItem(TESTER_KEY) === '1';
  } catch {
    return false;
  }
};

/**
 * Login (DESIGN §4). Discord is open to everyone and comes first. Google (still in Google's
 * "testing" mode, so only listed accounts can use it) and the email link (no mail service set up
 * yet) are shown greyed out with "Not open to the public yet" (owner, T55). "Owner or tester?"
 * unlocks them on this device, so the owner and listed testers are never locked out; Google itself
 * still refuses anyone not on its test list.
 */
export function SignIn({ onProvider, onEmail }: Props) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tester, setTester] = useState(readTester);

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
        <p className={s.about}>
          A free command hub for Honkai: Star Rail and Zenless Zone Zero: plan pulls, track dailies, events and your roster, on phone and PC.{' '}
          <a href="/about">What it does</a>
        </p>
        <Button variant="primary" className={s.wide} disabled={busy} onClick={() => void run(() => onProvider('discord'))}>
          Continue with Discord
        </Button>

        <div className={s.or}>{closed ? 'COMING LATER' : 'OR'}</div>
        <div className={closed ? s.closed : s.open} aria-describedby={closed ? 'signin-closed-note' : undefined}>
          {closed && (
            <p className={s.closedNote} id="signin-closed-note">
              Not open to the public yet. Sign in with Discord.
            </p>
          )}
          <Button className={s.wide} disabled={busy || closed} onClick={() => void run(() => onProvider('google'))}>
            Continue with Google
          </Button>
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
            Owner or tester? Use Google or email
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
