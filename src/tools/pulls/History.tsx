import { useState, type ChangeEvent, type CSSProperties, type FormEvent } from 'react';
import type { GameContract, PullRecord } from '../../core/contract';
import { backend } from '../../core/data/backend';
import { addPulls } from '../../core/data/userData';
import { formatDateTime } from '../../core/time/reset';
import { Button, EmptyState, ExampleTag, HowTo } from '../../core/ui';
import { cx } from '../../core/ui/cx';
import { parseHistoryFile, readAccount } from '../import/uigf';
import { pityFromHistory } from '../pity/pity';
import { cacheFileSteps, fileSteps, findHistoryLink, goodToKnow, guideFor, pasteSteps } from './importGuides';
import { LuckReport } from './LuckReport';
import p from './pulls.module.css';
import type { PullsData } from './usePullsData';

type Status = { kind: 'idle' } | { kind: 'busy' } | { kind: 'ok'; text: string } | { kind: 'error'; text: string };
type Way = 'link' | 'cache' | 'file' | null;

/**
 * History (design: NO DATA YET card + import choices; Override 3: the Luck
 * report is a card in here). Ways in (Override 2): the in-game history link
 * (pasted, or read from the game's cache file) and export files. Below:
 * pity per banner, the Luck report and every top result with the pity it took.
 */
export function History({ game, data, signedIn }: { game: GameContract; data: PullsData; signedIn: boolean }) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [way, setWay] = useState<Way>(null);
  const [link, setLink] = useState('');
  const mapping = game.historyMapping;
  const fileImport = game.historyImporters.some((i) => i.kind === 'file');
  const linkImport = game.historyImporters.some((i) => i.kind === 'link');
  const guide = guideFor(mapping?.uigfKey);
  const fileLabel = game.historyImporters
    .filter((i) => i.kind === 'file')
    .map((i) => i.label)
    .join(' or ');

  const report = (records: PullRecord[], skipped: Record<string, number>, invalid: number) => {
    const added = addPulls(game.id, records);
    const skippedCount = Object.values(skipped).reduce((a, b) => a + b, 0);
    const extra = [skippedCount ? `${skippedCount} from banner types HLITH doesn't know yet` : '', invalid ? `${invalid} unreadable` : ''].filter(Boolean).join(', ');
    setStatus({ kind: 'ok', text: `Added ${added} new pulls (${records.length - added} already stored).${extra ? ` Skipped: ${extra}.` : ''}` });
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

  const importLink = async (pasted: string) => {
    if (!backend || !mapping || !pasted.trim()) return;
    setStatus({ kind: 'busy' });
    const knownIds = data.user.pulls.map((x) => x.id);
    const { data: res, error } = await backend.functions.invoke<{ game: string; uid: string; timezone: number | null; list: unknown[] }>('gacha-import', { body: { link: pasted, knownIds } });
    setLink(''); // the link holds a temporary key: never kept
    if (error || !res) {
      const body: unknown = error && 'context' in error && error.context instanceof Response ? await error.context.json().catch(() => null) : null;
      const text = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' ? body.error : 'The import failed. Try again in a minute.';
      return setStatus({ kind: 'error', text });
    }
    if (res.game !== game.id) return setStatus({ kind: 'error', text: `This link is for another game, not ${game.name}.` });
    const acc = readAccount(res.uid, res.list, res.timezone ?? 8, mapping);
    report(acc.records, acc.skipped, acc.invalid);
  };

  const onLink = (e: FormEvent) => {
    e.preventDefault();
    void importLink(link);
  };

  const onCache = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    let text: string;
    try {
      text = await file.text();
    } catch {
      return setStatus({ kind: 'error', text: 'Your browser couldn’t read that file. If the game is still running, close it and try again (the link stays in the file).' });
    }
    const found = findHistoryLink(text);
    if (!found) return setStatus({ kind: 'error', text: 'No history link in this file. Open the history page in the game first, then pick data_2 from the newest webCaches folder.' });
    await importLink(found);
  };

  const example = data.history.example;
  const types = game.bannerTypes.filter((t) => data.history.list.some((h) => h.bannerType === t.id));
  const tops = topsWithPity(data.history.list).slice(-10).reverse();
  const noImport = !mapping || (!fileImport && !linkImport);
  const ways: { id: Exclude<Way, null>; label: string; sub: string; show: boolean }[] = [
    { id: 'link', label: 'Paste a history link', sub: 'From the in-game history page. Works on PC.', show: linkImport },
    { id: 'cache', label: 'Pick the game’s cache file', sub: 'The same link, read from the game’s own file. PC, no command needed.', show: linkImport },
    { id: 'file', label: 'Upload a file', sub: `Export from another tracker (${fileLabel || '.json'}).`, show: fileImport },
  ];

  return (
    <div className={p.stack} style={{ '--vent': game.vent } as CSSProperties}>
      {example && (
        <section className={p.noHistory} aria-label="No pull history yet">
          <span className={p.noDataLabel}>NO DATA YET</span>
          <h3 className={p.noHistoryTitle}>No pull history yet</h3>
          <p className={p.noHistoryBody}>
            Import your history once. HLITH then knows your pity and 50/50 state, and the Planner and Luck report fill in. Until then the numbers below are examples <ExampleTag />.
          </p>
        </section>
      )}

      {noImport ? (
        <EmptyState title="No import for this game yet" body="This game has no history import yet." />
      ) : (
        <>
          <div className={p.ways}>
            {ways
              .filter((w) => w.show)
              .map((w) => (
                <button key={w.id} type="button" className={cx(p.way, way === w.id && p.wayOn)} aria-expanded={way === w.id} onClick={() => setWay(way === w.id ? null : w.id)}>
                  <span className={p.wayTitle}>{w.label}</span>
                  <span className={p.waySub}>{w.sub}</span>
                </button>
              ))}
          </div>

          {way === 'link' && (
            <section className={p.card} aria-label="Paste a history link">
              {guide ? <HowTo title="How do I get the link? (PC)" steps={pasteSteps(guide)} open /> : <p className={p.muted}>A step-by-step guide for this game isn’t written yet.</p>}
              {signedIn ? (
                <form className={p.stack} onSubmit={onLink}>
                  <label className={p.field}>
                    History link (used once, never saved)
                    <textarea className={p.textarea} value={link} onChange={(e) => setLink(e.target.value)} placeholder="Paste the link or the whole text that contains it" rows={3} />
                  </label>
                  <Button type="submit" variant="primary" disabled={status.kind === 'busy' || !link.trim()}>
                    Import from link
                  </Button>
                </form>
              ) : (
                <p className={p.muted}>Sign in (Account) to import from a link: the link is read by our server, which needs your account to store the pulls. Export files work without signing in.</p>
              )}
            </section>
          )}

          {way === 'cache' && (
            <section className={p.card} aria-label="Pick the game’s cache file">
              {guide ? <HowTo title="Where is the file? (PC)" steps={cacheFileSteps(guide)} open /> : <p className={p.muted}>A step-by-step guide for this game isn’t written yet.</p>}
              {signedIn ? (
                <label className={p.field}>
                  Choose the cache file (data_2)
                  <input id={`history-cache-${game.id}`} className={p.input} type="file" onChange={(e) => void onCache(e)} />
                </label>
              ) : (
                <p className={p.muted}>Sign in (Account) to import from the game’s link. Export files work without signing in.</p>
              )}
            </section>
          )}

          {way === 'file' && (
            <section className={p.card} aria-label="Upload a file">
              <HowTo title="How do I get an export file?" steps={fileSteps(guide)} open />
              <label className={p.field}>
                Export file ({fileLabel})
                <input id={`history-file-${game.id}`} className={p.input} type="file" accept=".json,application/json" onChange={(e) => void onFile(e)} />
              </label>
            </section>
          )}

          {/* The ExampleNotice button focuses this; it opens the file way. */}
          {way !== 'file' && fileImport && (
            <input id={`history-file-${game.id}`} className={p.srOnly} type="file" accept=".json,application/json" aria-label={`Export file (${fileLabel})`} onChange={(e) => void onFile(e)} tabIndex={-1} />
          )}

          <HowTo title="Phone, console and good to know" steps={goodToKnow()} />

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

      {types.length > 0 && (
        <div className={p.pityGrid}>
          {types.map((t) => {
            const pity = pityFromHistory(data.history.list, t.id);
            const hard = t.pity.kind === 'hard-pity' ? t.pity.hardPity : null;
            const hasFeatured = t.pity.kind === 'hard-pity' && t.pity.featured !== undefined;
            return (
              <article key={t.id} className={p.card} aria-label={`${t.label} pity`}>
                <div className={p.kindRow}>
                  <span className={p.kind}>{t.label}</span>
                  {example && <ExampleTag />}
                </div>
                <div className={p.figures}>
                  <div className={p.figure}>
                    <span className={p.figLabel}>Pity</span>
                    <span className={p.figValue}>
                      {pity.pity.known ? pity.pity.value : '—'}
                      {hard !== null && `/${hard}`}
                    </span>
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
      )}

      <LuckReport game={game} history={data.history.list} example={example} />

      <section className={p.card} aria-label={`Every ${game.terms.rarity.top}`}>
        <h3 className={p.cardTitle}>
          Every {game.terms.rarity.top}, newest first {example && <ExampleTag />}
        </h3>
        {tops.length === 0 ? (
          <span className={p.muted}>None yet.</span>
        ) : (
          <ul className={p.topList}>
            {tops.map(({ pull: h, pity }) => (
              <li key={h.id} className={p.topRow}>
                <span className={cx(p.topName, h.featured === false && p.lost)}>{h.name}</span>
                <span className={p.small}>{game.bannerTypes.find((t) => t.id === h.bannerType)?.label ?? h.bannerType}</span>
                <span className={p.small}>{h.featured === undefined ? '' : h.featured ? 'won 50/50' : 'lost 50/50'}</span>
                <span className={p.topPity}>
                  {pity} <span className={p.small}>pulls</span>
                </span>
                <span className={p.small}>{formatDateTime(Date.parse(h.time))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Each top result with the pulls it took on its banner type (V1: "every 5★ with the pity it took"). Oldest first. */
function topsWithPity(history: PullRecord[]): { pull: PullRecord; pity: number }[] {
  const sorted = [...history].sort((a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id));
  const since: Record<string, number> = {};
  const out: { pull: PullRecord; pity: number }[] = [];
  for (const h of sorted) {
    since[h.bannerType] = (since[h.bannerType] ?? 0) + 1;
    if (h.rarity === 'top') {
      out.push({ pull: h, pity: since[h.bannerType] ?? 0 });
      since[h.bannerType] = 0;
    }
  }
  return out;
}
