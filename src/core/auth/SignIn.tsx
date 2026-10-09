import { useState, type FormEvent } from 'react';
import { Button } from '../ui/Button';
import s from './signin.module.css';

interface Props {
  onProvider: (provider: 'google' | 'discord') => Promise<string | null>;
  onEmail: (email: string) => Promise<string | null>;
}

/** Login: Google, Discord, or an email sign-in link (DESIGN §4). */
export function SignIn({ onProvider, onEmail }: Props) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    if (email.trim()) void run(() => onEmail(email.trim()), () => setSent(true));
  };

  return (
    <main className={s.page}>
      <div className={s.card}>
        <div className="t-label">PROJECT-HLITH</div>
        <h1 className={`t-display ${s.name}`}>HLIÐSKJÁLF</h1>
        <p className={s.lead}>One seat, every world. Sign in to see your games.</p>
        <Button className={s.wide} disabled={busy} onClick={() => void run(() => onProvider('google'))}>
          Continue with Google
        </Button>
        <Button className={s.wide} disabled={busy} onClick={() => void run(() => onProvider('discord'))}>
          Continue with Discord
        </Button>
        <div className={s.or}>OR</div>
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
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button variant="primary" type="submit" className={s.wide} disabled={busy}>
              Email me a sign-in link
            </Button>
          </form>
        )}
        {error && (
          <p className={s.error} role="alert">
            {error}
          </p>
        )}
        <p className={s.foot}>Your data is private to your account. Times show in your local time.</p>
      </div>
    </main>
  );
}
