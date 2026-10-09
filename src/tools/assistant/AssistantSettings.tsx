import { useId, useState } from 'react';
import type { GameContract } from '../../core/contract';
import { Button, useNow } from '../../core/ui';
import { CostHowTo, KeySetup } from './KeySetup';
import { formatUsd, MODELS, priceLine } from './models';
import { ActionLog, ProposalsHowTo } from './Proposals';
import { spentToday, updateSettings, useSettings } from './settings';
import s from './assistant.module.css';

/** Assistant settings: key, model, web search, daily limit, and the changes it made. */
export function AssistantSettingsView({ games }: { games: GameContract[] }) {
  const settings = useSettings();
  const uid = useId();
  const [limitDraft, setLimitDraft] = useState(settings.dailyLimit === null ? '' : String(settings.dailyLimit));
  const [limitError, setLimitError] = useState('');
  const now = useNow(60_000);
  const today = spentToday(settings, now);
  const chosen = MODELS.find((m) => m.id === settings.model);

  const saveLimit = () => {
    const v = limitDraft.trim();
    if (v === '') {
      updateSettings((x) => ({ ...x, dailyLimit: null }));
      return setLimitError('');
    }
    const n = Number(v.replace('$', ''));
    if (!Number.isFinite(n) || n <= 0) return setLimitError('Use an amount in dollars, like 1 or 0.50, or leave it empty for no limit.');
    updateSettings((x) => ({ ...x, dailyLimit: n }));
    setLimitError('');
  };

  return (
    <div className={s.plain}>
      <KeySetup compact />

      <fieldset className={s.section}>
        <legend className={s.sectionLabel}>WHICH MODEL ANSWERS</legend>
        {MODELS.map((m) => {
          const mine = settings.measured[m.id];
          return (
            <label key={m.id} className={s.modelCard}>
              <input type="radio" name={`${uid}-model`} checked={settings.model === m.id} onChange={() => updateSettings((x) => ({ ...x, model: m.id }))} />
              <span className={s.modelText}>
                <span className={s.modelName}>
                  {m.label}
                  {settings.model === m.id && <span className={s.meta}> · in use</span>}
                </span>
                <span className={s.mono}>{priceLine(m.id)}</span>
                <span>{m.blurb}</span>
                <span>Good for: {m.goodFor}</span>
                <span>Less suited: {m.lessSuited}</span>
                <span>
                  {mine && mine.messages > 0
                    ? `On this device: ${mine.messages} message${mine.messages === 1 ? '' : 's'}, about ${formatUsd(mine.usd / mine.messages)} each (estimate).`
                    : 'No messages with this model on this device yet, so there is no real cost to show.'}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>

      <section className={s.section} aria-label="Web search">
        <span className={s.sectionLabel}>WEB SEARCH</span>
        <label className={s.radioRow}>
          <input type="checkbox" checked={settings.webSearch} onChange={(e) => updateSettings((x) => ({ ...x, webSearch: e.target.checked }))} />
          <span>Let the Assistant search the web (news, patch notes, event details). Each search costs $0.01 and the reply names its sources.</span>
        </label>
        {chosen && !chosen.webSearch && <p className={s.p}>{chosen.label} doesn’t use web search here: the tool isn’t documented for it yet. Pick Opus or Sonnet to search.</p>}
      </section>

      <section className={s.section} aria-label="Daily limit">
        <span className={s.sectionLabel}>DAILY LIMIT</span>
        <p className={s.p}>
          Spent today on this device: <span className={`${s.strong} ${s.mono}`}>{formatUsd(today)}</span>
          {settings.dailyLimit !== null && (
            <>
              {' '}
              of <span className={s.mono}>{formatUsd(settings.dailyLimit)}</span>
            </>
          )}{' '}
          (estimate). Resets at midnight your time. Counted on this device only; your Claude Console can set a hard limit for the key.
        </p>
        <div className={s.row}>
          <label className={s.field} htmlFor={`${uid}-limit`}>
            Limit in US dollars (empty = none)
            <input id={`${uid}-limit`} className={s.textInput} inputMode="decimal" value={limitDraft} onChange={(e) => setLimitDraft(e.target.value)} />
          </label>
          <Button onClick={saveLimit}>Save limit</Button>
        </div>
        {limitError && (
          <p className={s.problem} role="alert">
            {limitError}
          </p>
        )}
      </section>

      <CostHowTo />
      <ProposalsHowTo />

      <section className={s.section} aria-label="Changes the Assistant made">
        <span className={s.sectionLabel}>CHANGES THE ASSISTANT MADE</span>
        {games.map((g) => (
          <ActionLog key={g.id} game={g} showGame={games.length > 1} />
        ))}
        <p className={s.p}>Only changes you approved appear here. Undo puts things back; nothing is ever deleted.</p>
      </section>
    </div>
  );
}
