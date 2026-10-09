import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { Button, HowTo } from '../../core/ui';
import c from './connections.module.css';
import { readLogin, type HoyoLogin } from './hoyolab';

/*
 * How a player gets the HoYoLAB login values. Sources:
 * - genshin.py authentication guide (steps 1–5: hoyolab.com → F12 → Application → Cookies):
 *   https://seria.is-a.dev/genshin.py/authentication
 * - The cookies are HttpOnly since 2023, so a console script can't read them; copy by hand,
 *   and the names are ltoken_v2 / ltuid_v2 since July 2023:
 *   https://github.com/canaria3406/hoyolab-auto-sign
 * - Battle Chronicle / Real-Time Notes privacy setting, second browser for a second account,
 *   "logging out ends it": the V1 tracker's own guide (project-gacha-tracker), which worked with these values.
 * Not confirmed by us: how long the values last (third-party bots say "usually a few months"),
 * and the exact wording of the privacy switches on hoyolab.com, which HoYoLAB changes from time to time.
 */
export function HoyolabSteps({ open = false }: { open?: boolean }) {
  return (
    <HowTo
      title="How to get your HoYoLAB login values"
      open={open}
      steps={[
        <>
          On a PC, open <span className={c.mono}>hoyolab.com</span> in Chrome or Edge and log in with the HoYoLAB account you play on.
        </>,
        <>
          Press <span className={c.mono}>F12</span> (or right-click the page and choose Inspect). In the panel that opens, choose the <strong>Application</strong> tab (it may hide behind <span className={c.mono}>»</span>). In Firefox the tab is called <strong>Storage</strong>.
        </>,
        <>
          On the left, open <strong>Cookies</strong> → <span className={c.mono}>https://www.hoyolab.com</span>.
        </>,
        <>
          Type <span className={c.mono}>ltoken_v2</span> in the filter box. Double-click its value, copy it, and paste it into the box below. Do the same for <span className={c.mono}>ltuid_v2</span> (a number), and <span className={c.mono}>ltmid_v2</span> if you see it. Just the values, in any order. Pasting whole <span className={c.mono}>name=value</span> lines works too.
        </>,
        <>
          On hoyolab.com, open your profile → <strong>Battle Chronicle</strong> → settings, and turn on showing your Battle Chronicle and Real-Time Notes. If they’re off, HoYoLAB answers that your data is private.
        </>,
        <>Press the button below. HLITH finds the game accounts (UIDs) on that login by itself, for every game it supports. Each game stays separate.</>,
      ]}
    >
      <p className={c.body}>
        <strong>Why so many steps?</strong> HoYoLAB has no official way to connect other apps. These values work like your HoYoLAB login, so treat them like a password. HoYoLAB hides them from page scripts, so they have to be copied by hand. We don’t know a reliable way to do this in a phone browser, so use a PC.
      </p>
      <p className={c.body}>
        <strong>It stops working when</strong> you press Log out on hoyolab.com for that account, or the login expires (other trackers say this usually takes a few months, but we haven’t checked). Then copy fresh values and use “Replace login”.
      </p>
      <p className={c.body}>
        <strong>A second account (an alt)?</strong> Log in to it in a second browser or a private window and copy its values there, so each login stays its own. Logging out of one in the same browser ends that login.
      </p>
      <p className={c.body}>Only global (HoYoverse) accounts work. Accounts on the China servers use a different system that HLITH can’t read.</p>
    </HowTo>
  );
}

/**
 * The paste box for a HoYoLAB login. The pasted text is cleared as soon as it's
 * read: the login is a secret and never stays in the form.
 */
export function PasteLogin({ submitLabel, busy, disabledReason, onSubmit, children }: { submitLabel: string; busy: boolean; disabledReason: string | null; onSubmit: (login: HoyoLogin) => void; children?: ReactNode }) {
  const id = useId();
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const off = disabledReason !== null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (busy || off) return;
    const read = readLogin(text);
    if (!read.ok) return setProblem(`I need both values: ${read.missing.join(' and ')}. ltuid_v2 is a number, ltoken_v2 starts with v2_.`);
    setProblem(null);
    setText('');
    onSubmit(read.login);
  };

  return (
    <form className={c.tight} onSubmit={submit}>
      <label className={c.field} htmlFor={`${id}-values`}>
        Paste your login values (ltuid_v2 and ltoken_v2, any order)
      </label>
      <textarea id={`${id}-values`} className={c.textarea} value={text} onChange={(e) => setText(e.target.value)} placeholder={'123456789\nv2_…'} rows={3} autoComplete="off" spellCheck={false} disabled={off} />
      {children}
      <div className={c.row}>
        <Button type="submit" variant="primary" disabled={busy || off || !text.trim()}>
          {busy ? 'Asking HoYoLAB…' : submitLabel}
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
