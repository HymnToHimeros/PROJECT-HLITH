import { useId, useState, type FormEvent } from 'react';
import { Button, HowTo } from '../../core/ui';
import c from './connections.module.css';
import { readSkportToken } from './skport';

/*
 * How a player gets the SKPort ACCOUNT_TOKEN. Sources:
 * - SKPort / Gryphline stores the token as a browser cookie after login.
 * - The cookie_store page (https://zonai.skport.com/web/cookie_store) shows the
 *   current ACCOUNT_TOKEN value, ready to copy.
 * - Alternatively, DevTools → Application → Cookies → zonai.skport.com → ACCOUNT_TOKEN.
 * Not tested with a live account yet.
 */
export function SkportSteps({ open = false }: { open?: boolean }) {
  return (
    <HowTo
      title="How to get your SKPort token"
      open={open}
      steps={[
        <>
          On a PC, open <span className={c.mono}>zonai.skport.com</span> and log in with the account you play Endfield on.
        </>,
        <>
          Go to <span className={c.mono}>zonai.skport.com/web/cookie_store</span>. The page shows your ACCOUNT_TOKEN — copy it.
        </>,
        <>
          If that page doesn't work, press <span className={c.mono}>F12</span> → <strong>Application</strong> (Firefox: <strong>Storage</strong>) → <strong>Cookies</strong> → <span className={c.mono}>zonai.skport.com</span> and copy the value of the <span className={c.mono}>ACCOUNT_TOKEN</span> cookie.
        </>,
        <>Paste the token into the box below and press the button. HLITH finds your Endfield account on it.</>,
      ]}
    >
      <p className={c.body}>
        <strong>What is SKPort?</strong> SKPort (Gryphline) is the global community platform for Arknights: Endfield, the same way HoYoLAB is for HoYoverse games. It reads your Endfield data (sanity, level) through official channels.
      </p>
      <p className={c.body}>
        <strong>One value only:</strong> unlike HoYoLAB which needs multiple cookies, SKPort uses a single ACCOUNT_TOKEN. Treat it like a password.
      </p>
      <p className={c.body}>
        <strong>It stops working when</strong> you log out of SKPort, or the token expires. Copy a fresh one and use "Replace token".
      </p>
      <p className={c.body}>Only global (Gryphline) accounts work. Accounts on the China servers use SKLand, which HLITH can't read.</p>
    </HowTo>
  );
}

export function PasteSkportToken({
  submitLabel,
  busy,
  disabledReason,
  onSubmit,
}: {
  submitLabel: string;
  busy: boolean;
  disabledReason: string | null;
  onSubmit: (token: string) => void;
}) {
  const id = useId();
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const off = disabledReason !== null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (busy || off) return;
    const read = readSkportToken(text);
    if (!read.ok) return setProblem('That doesn\'t look like an ACCOUNT_TOKEN: it should be a single value, at least 10 characters, with no spaces or semicolons.');
    setProblem(null);
    setText('');
    onSubmit(read.token);
  };

  return (
    <form className={c.tight} onSubmit={submit}>
      <label className={c.field} htmlFor={`${id}-token`}>
        Paste your ACCOUNT_TOKEN
      </label>
      <input
        id={`${id}-token`}
        className={c.input}
        type="password"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="ACCOUNT_TOKEN value"
        autoComplete="off"
        spellCheck={false}
        disabled={off}
      />
      <div className={c.row}>
        <Button type="submit" variant="primary" disabled={busy || off || !text.trim()}>
          {busy ? 'Asking SKPort…' : submitLabel}
        </Button>
      </div>
      {problem && (
        <span className={c.error} role="alert">
          {problem}
        </span>
      )}
      {disabledReason && <span className={c.muted}>{disabledReason}</span>}
    </form>
  );
}
