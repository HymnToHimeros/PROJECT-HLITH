import { useId, useState, type FormEvent } from 'react';
import { Button, HowTo } from '../../core/ui';
import c from './connections.module.css';
import { readSkportToken } from './skport';

/*
 * How a player gets the SKPort ACCOUNT_TOKEN. Sources (community check-in tools that use this token,
 * e.g. github.com/torikushiii/endfield-auto): log in on the SKPort Endfield portal,
 * https://game.skport.com/endfield/sign-in, then DevTools → Application → Cookies → ACCOUNT_TOKEN.
 * The cookie is httpOnly, so it can't be read from the console, and it's URL-encoded (%2F for /):
 * readSkportToken decodes it. zonai.skport.com is SKPort's API host, not a page a player can open.
 * Not tested with a live account yet.
 */
export function SkportSteps({ open = false }: { open?: boolean }) {
  return (
    <HowTo
      title="How to get your SKPort token"
      open={open}
      steps={[
        <>
          On a PC, open{' '}
          <a className={c.mono} href="https://game.skport.com/endfield/sign-in" target="_blank" rel="noreferrer noopener">
            game.skport.com/endfield/sign-in
          </a>{' '}
          and log in with the account you play Endfield on.
        </>,
        <>
          Press <span className={c.mono}>F12</span> → <strong>Application</strong> (Firefox: <strong>Storage</strong>) → <strong>Cookies</strong> → <span className={c.mono}>https://game.skport.com</span>.
        </>,
        <>
          Find <span className={c.mono}>ACCOUNT_TOKEN</span> and copy its value. If you don't see it there, look under the other skport.com entries in the same list.
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
