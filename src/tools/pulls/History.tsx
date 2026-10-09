import { useState, type ChangeEvent, type FormEvent } from 'react';
import type { GameContract, PullRecord } from '../../core/contract';
import { backend } from '../../core/data/backend';
import { addPulls } from '../../core/data/userData';
import { formatDateTime } from '../../core/time/reset';
import { Button, EmptyState } from '../../core/ui';
import { parseHistoryFile, readAccount } from '../import/uigf';
import { pityFromHistory } from '../pity/pity';
import { LuckReport } from './LuckReport';
import { Ex } from './shared';
import p from './pulls.module.css';
import type { PullsData } from './usePullsData';

type Status = { kind: 'idle' } | { kind: 'busy' } | { kind: 'ok'; text: string } | { kind: 'error'; text: string };

/** History: import (file or in-game link), pity per banner, recent top results, Luck report card. */
export function History({ game, data, signedIn }: { game: GameContract; data: PullsData; signedIn: boolean }) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [link, setLink] = useState('');
  const mapping = game.historyMapping;
  const fileImport = game.historyImporters.some((i) => i.kind === 'file');
  const linkImport = game.historyImporters.some((i) => i.kind === 'link');

  const report = (records: PullRecord[], skipped: Record<string, number>, invalid: number) => {
    const added = addPulls(game.id, records);
    const skippedCount = Object.values(skipped).reduce((a, b) => a + b, 0);
    const extra = [skippedCount ? `${skippedCount} from banner types HLITH doesn't know yet` : '', invalid ? `${invalid} unreadable` : ''].filter(Boolean).join(', ');
    setStatus({
      kind: 'ok',
      text: `Added ${added} new pulls (${records.length - added} already stored).${extra ? ` Skipped: ${extra}.` : ''}`,
    });
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !mapping) return;
    setStatus({ kind: 'busy' });
    const result = parseHistoryFile(await file.text(), mapping);
    if (!result.ok) return setStatus({ kind: 'error', text: result.error });
    const records = result.accounts.flatMap((a) => a.records);
    const skipped: Record<string, number> = {};
    for (const a of result.accounts) for (const [k, v] of Object.entries(a.skipped)) skipped[k] = (skipped[k] ?? 0) + v;
    report(
      records,
      skipped,
      result.accounts.reduce((n, a) => n + a.invalid, 0),
    );
  };

  const onLink = async (e: FormEvent) => {
    e.preventDefault();
    if (!backend || !mapping || !link.trim()) return;
    setStatus({ kind: 'busy' });
    const known = data.user.pulls.map((x) => x.id);
    const { data: res, error } = await backend.functions.invoke<{
      game: string;
      uid: string;
      timezone: number | null;
      list: unknown[];
    }>('gacha-import', {
      body: { link, knownIds: known },
    });
    setLink(''); // the link holds a temporary key: never kept
    if (error || !res) {
      const body: unknown = error && 'context' in error && error.context instanceof Response ? await error.context.json().catch(() => null) : null;
      const text = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' ? body.error : 'The import failed. Try again in a minute.';
      return setStatus({ kind: 'error', text });
    }
    if (res.game !== game.id)
      return setStatus({
        kind: 'error',
        text: `This link is for another game, not ${game.name}.`,
      });
    const acc = readAccount(res.uid, res.list, res.timezone ?? 8, mapping);
    report(acc.records, acc.skipped, acc.invalid);
  };

  const example = data.history.example;
  const types = game.bannerTypes.filter((t) => data.history.list.some((h) => h.bannerType === t.id));
  const tops = data.history.list
    .filter((h) => h.rarity === 'top')
    .slice(-8)
    .reverse();

  return (
    <div className={p.stack}>
      <article className={p.card}>
        <div className={p.cardHead}>
          <div>
            <div className={p.kind}>Import</div>
            <h3 className={p.cardTitle}>Add your pull history</h3>
          </div>
        </div>
        {!mapping || (!fileImport && !linkImport) ? (
          <EmptyState title="No import for this game yet" body="This game has no history import yet." />
        ) : (
          <>
            {fileImport && (
              <label className={p.field}>
                Export file (
                {game.historyImporters
                  .filter((i) => i.kind === 'file')
                  .map((i) => i.label)
                  .join(' or ')}
                )
                <input id={`history-file-${game.id}`} className={p.input} type="file" accept=".json,application/json" onChange={(e) => void onFile(e)} />
              </label>
            )}
            {linkImport &&
              (signedIn ? (
                <form className={p.form} onSubmit={(e) => void onLink(e)}>
                  <label className={p.field}>
                    In-game history link (used once, never saved)
                    <textarea
                      className={p.textarea}
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      placeholder="Paste the link or the whole text that contains it"
                      rows={3}
                    />
                  </label>
                  <Button type="submit" variant="primary" disabled={status.kind === 'busy' || !link.trim()}>
                    Import from link
                  </Button>
                </form>
              ) : (
                <span className={p.muted}>Sign in to import from the in-game link.</span>
              ))}
            {status.kind === 'busy' && <span className={p.muted}>Importing…</span>}
            {status.kind === 'ok' && (
              <span className={p.message} role="status">
                {status.text}
              </span>
            )}
            {status.kind === 'error' && (
              <span className={p.error} role="alert">
                {status.text}
              </span>
            )}
          </>
        )}
      </article>

      <div className={p.grid}>
        {types.map((t) => {
          const pity = pityFromHistory(data.history.list, t.id);
          const hard = t.pity.kind === 'hard-pity' ? t.pity.hardPity : null;
          const hasFeatured = t.pity.kind === 'hard-pity' && t.pity.featured !== undefined;
          return (
            <article key={t.id} className={p.card}>
              <div className={p.kind}>{t.label}</div>
              <div className={p.figures}>
                <div className={p.figure}>
                  <span className={p.figLabel}>Pity</span>
                  <Ex example={example}>
                    <span className={p.figValue}>
                      {pity.pity.known ? pity.pity.value : '—'}
                      {hard !== null && `/${hard}`}
                    </span>
                  </Ex>
                </div>
                {hasFeatured && (
                  <div className={p.figure}>
                    <span className={p.figLabel}>Next {game.terms.rarity.top}</span>
                    <span className={p.figValue}>{pity.guaranteed.known ? (pity.guaranteed.value ? 'Guaranteed' : '50/50') : 'Unknown'}</span>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <LuckReport game={game} history={data.history.list} example={example} />

      <article className={p.card}>
        <div className={p.kind}>Latest {game.terms.rarity.top} results</div>
        {tops.length === 0 ? (
          <span className={p.muted}>None yet.</span>
        ) : (
          <div className={p.tableWrap}>
            <table className={p.table}>
              <tbody>
                {tops.map((h) => (
                  <tr key={h.id}>
                    <td className={h.featured === false ? p.lost : p.top}>
                      <Ex example={example}>{h.name}</Ex>
                    </td>
                    <td>{game.bannerTypes.find((t) => t.id === h.bannerType)?.label ?? h.bannerType}</td>
                    <td>{h.featured === undefined ? '' : h.featured ? 'won 50/50' : 'lost 50/50'}</td>
                    <td className={p.num}>{formatDateTime(Date.parse(h.time))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </div>
  );
}
