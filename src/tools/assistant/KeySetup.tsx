import { useId, useState, type FormEvent } from 'react';
import { Button, HowTo } from '../../core/ui';
import { forgetKey, looksLikeKey, maskKey, saveKey, useKey, type KeyPlace } from './keyStore';
import { MODELS, priceLine, WEB_SEARCH_USD } from './models';
import s from './assistant.module.css';

/** Exact steps, checked against the Claude docs ("Get your Claude API key", platform.claude.com) on 2026-10-09. */
export function GetKeyHowTo({ open = false }: { open?: boolean }) {
  return (
    <HowTo
      title="How to get a Claude API key"
      open={open}
      steps={[
        <>
          Go to <a className={s.textLink} href="https://platform.claude.com/" target="_blank" rel="noreferrer">platform.claude.com</a> (the Claude Console) and sign in, or create an
          account.
        </>,
        <>
          Open <a className={s.textLink} href="https://platform.claude.com/settings/keys" target="_blank" rel="noreferrer">Settings → API keys</a>.
        </>,
        'Click “Create key”, give it a name (for example HLITH), choose when it expires, and set “Linked account” to yourself.',
        'Copy the key. It starts with sk-ant- and the Console shows it only once; if you lose it, create a new one.',
        'Paste it below. Messages are billed to your Claude Console account (see Billing there, where you can also set a spend limit).',
      ]}
    />
  );
}

export function CostHowTo() {
  return (
    <HowTo
      title="What it costs"
      steps={[
        'You pay Anthropic directly, through your own key. HLITH adds nothing and never sees the bill.',
        ...MODELS.map((m) => `${m.label}: ${priceLine(m.id)}.`),
        `Web search costs $${WEB_SEARCH_USD.toFixed(2)} per search on top. A screenshot adds input tokens.`,
        'Every reply shows its cost as an estimate: the token counts Claude reports × these list prices. The real figure is on the Usage and Billing pages of your Claude Console.',
        'The daily limit in Settings is counted on this device from those estimates. When it’s reached, the Assistant stops sending until tomorrow (or until you raise it).',
      ]}
    />
  );
}

/** Set, change or forget your Claude API key. */
export function KeySetup({ compact = false }: { compact?: boolean }) {
  const current = useKey();
  const uid = useId();
  const [draft, setDraft] = useState('');
  const [place, setPlace] = useState<KeyPlace>('device');
  const [error, setError] = useState('');
  const [changing, setChanging] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!looksLikeKey(draft)) return setError('That doesn’t look like a Claude API key. It starts with sk-ant-.');
    saveKey(draft, place);
    setDraft('');
    setError('');
    setChanging(false);
  };

  if (current && !changing)
    return (
      <section className={s.section} aria-label="Your Claude API key">
        <span className={s.sectionLabel}>YOUR CLAUDE KEY</span>
        <p className={s.p}>
          <span className={`${s.strong} ${s.mono}`}>{maskKey(current.key)}</span> · {current.place === 'device' ? 'kept on this device until you forget it' : 'kept for this tab only'}
        </p>
        <div className={s.row}>
          <Button onClick={() => setChanging(true)}>Change key</Button>
          <Button onClick={() => forgetKey()}>Forget key</Button>
        </div>
      </section>
    );

  return (
    <section className={s.section} aria-label="Add your Claude API key">
      <span className={s.sectionLabel}>{current ? 'CHANGE YOUR CLAUDE KEY' : 'STEP 1 · YOUR CLAUDE KEY'}</span>
      {!compact && (
        <p className={s.p}>
          The Assistant uses <span className={s.strong}>your own</span> Claude API key, so you pay Anthropic for what you use and HLITH has no AI bill.
        </p>
      )}
      <GetKeyHowTo open={!compact && !current} />
      <form className={s.plain} onSubmit={submit}>
        <label className={s.field} htmlFor={`${uid}-key`}>
          Claude API key
          <input
            id={`${uid}-key`}
            className={s.textInput}
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="sk-ant-…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </label>
        <fieldset className={s.plain}>
          <legend className={s.p}>Where to keep it</legend>
          <label className={s.radioRow}>
            <input type="radio" name={`${uid}-place`} checked={place === 'device'} onChange={() => setPlace('device')} />
            <span>On this device, until I tap “Forget key”</span>
          </label>
          <label className={s.radioRow}>
            <input type="radio" name={`${uid}-place`} checked={place === 'session'} onChange={() => setPlace('session')} />
            <span>For this tab only (best on a shared computer)</span>
          </label>
        </fieldset>
        {error && (
          <p className={s.problem} role="alert">
            {error}
          </p>
        )}
        <div className={s.row}>
          <Button variant="primary" type="submit">
            Save key
          </Button>
          {current && <Button onClick={() => setChanging(false)}>Cancel</Button>}
        </div>
      </form>
      <p className={s.p}>
        Your key stays in this browser only. It is not saved in your HLITH account and never synced. Each message carries it to HLITH’s Assistant function, which
        hands it to Claude for that one reply and keeps nothing: no copy, no log.
      </p>
    </section>
  );
}
