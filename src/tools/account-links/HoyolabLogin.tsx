import { useId, useState, type FormEvent, type ReactNode } from 'react';
import type { GameContract } from '../../core/contract';
import { Button, HowTo } from '../../core/ui';
import c from './connections.module.css';
import { readLogin, savedLogin, type HoyoLogin } from './hoyolab';

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
export function HoyolabSteps({ game, open = false }: { game: GameContract; open?: boolean }) {
  return (
    <HowTo
      title="How to get your HoYoLAB login values"
      open={open}
      steps={[
        <>
          On a PC, open <span className={c.mono}>hoyolab.com</span> in Chrome or Edge and log in with the account that plays {game.name}.
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
        <>Press the button below. HLITH finds your {game.name} account by itself. If the login has more than one, it asks which UID to use.</>,
      ]}
    >
      <p className={c.body}>
        <strong>Why so many steps?</strong> HoYoLAB has no official way to connect other apps. These values work like your HoYoLAB login, so treat them like a password. HoYoLAB hides them from page scripts, so they have to be copied by hand. We don’t know a reliable way to do this in a phone browser, so use a PC.
      </p>
      <p className={c.body}>
        <strong>What HLITH does with them:</strong> sends them over HTTPS to HLITH’s server for this one request. The server passes them to HoYoLAB and never stores or logs them. By default they’re forgotten right after. Tick “Remember on this device” to keep them in this browser only. They’re never synced and never go into a backup.
      </p>
      <p className={c.body}>
        <strong>It stops working when</strong> you press Log out on hoyolab.com for that account, or the login expires (other trackers say this usually takes a few months, but we haven’t checked). Then copy fresh values. Using a different account for another game? Log in to it in a second browser or a private window, so each login stays its own.
      </p>
      <p className={c.body}>Only global (HoYoverse) accounts work. Accounts on the China servers use a different system that HLITH can’t read.</p>
    </HowTo>
  );
}

export interface LoginChoice {
  login: HoyoLogin;
  uid: string | undefined;
  remember: boolean;
  fromSaved: boolean;
}

/**
 * The login box: paste the values (used once) or use the login remembered on this
 * device. The pasted text is cleared as soon as it's sent.
 */
export function HoyolabLoginForm({
  game,
  submitLabel,
  disabledReason,
  busy,
  onSubmit,
  extra,
}: {
  game: GameContract;
  submitLabel: string;
  disabledReason: string | null;
  busy: boolean;
  onSubmit: (choice: LoginChoice) => void;
  extra?: ReactNode;
}) {
  const id = useId();
  const saved = savedLogin(game.id);
  const [text, setText] = useState('');
  const [uid, setUid] = useState(saved?.uid ?? '');
  const [remember, setRemember] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const disabled = busy || disabledReason !== null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    const read = readLogin(text);
    if (!read.ok) return setProblem(`I need both values: ${read.missing.join(' and ')}. ltuid_v2 is a number, ltoken_v2 starts with v2_.`);
    setProblem(null);
    setText(''); // the login is a secret: never kept in the form
    onSubmit({ login: read.login, uid: uid.trim() || undefined, remember, fromSaved: false });
  };

  return (
    <div className={c.tight}>
      {saved && (
        <div className={c.row}>
          <Button variant="primary" disabled={disabled} onClick={() => onSubmit({ login: saved.login, uid: uid.trim() || saved.uid, remember: true, fromSaved: true })}>
            {submitLabel} · saved login
          </Button>
          <span className={c.muted}>Remembered on this device since {new Date(saved.savedAt).toLocaleDateString()}.</span>
        </div>
      )}
      <form className={c.tight} onSubmit={submit}>
        <label className={c.field} htmlFor={`${id}-values`}>
          {saved ? 'Or paste a fresh login' : 'Paste your login values'} (ltuid_v2 and ltoken_v2, any order)
        </label>
        <textarea
          id={`${id}-values`}
          className={c.textarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'123456789\nv2_…'}
          rows={3}
          autoComplete="off"
          spellCheck={false}
          disabled={disabledReason !== null}
        />
        <label className={c.field} htmlFor={`${id}-uid`}>
          {game.short} UID (optional, only if your login has more than one account)
        </label>
        <input id={`${id}-uid`} className={c.input} inputMode="numeric" value={uid} onChange={(e) => setUid(e.target.value.replace(/\D/g, ''))} placeholder="Found by itself" disabled={disabledReason !== null} />
        <label className={c.toggle}>
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} disabled={disabledReason !== null} />
          <span>
            Remember on this device
            <span className={c.toggleNote}>Off: used once, then forgotten. On: kept in this browser only (never synced, never backed up). Anyone using this browser could use it.</span>
          </span>
        </label>
        <div className={c.row}>
          <Button type="submit" variant={saved ? 'secondary' : 'primary'} disabled={disabled || !text.trim()}>
            {busy ? 'Asking HoYoLAB…' : submitLabel}
          </Button>
          {extra}
        </div>
        {problem && (
          <span className={c.error} role="alert">
            {problem}
          </span>
        )}
        {disabledReason && <span className={c.muted}>{disabledReason}</span>}
      </form>
    </div>
  );
}
