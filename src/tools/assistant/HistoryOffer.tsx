import { useMemo, useState } from 'react';
import type { GameContract } from '../../core/contract';
import { importPulls, removePulls } from '../../core/data/userData';
import { parseHistoryFile, type ImportedAccount } from '../import/uigf';
import s from './assistant.module.css';

/** Which in-view game an attached .json pull export (UIGF / SRGF) is for, with its one account. */
export function historyFileFor(text: string, games: GameContract[]): { game: GameContract; account: ImportedAccount; format: string } | null {
  for (const game of games) {
    if (!game.historyMapping) continue;
    const res = parseHistoryFile(text, game.historyMapping);
    if (!res.ok) continue;
    const withPulls = res.accounts.filter((a) => a.records.length > 0);
    // Several accounts: History asks which one is yours, so send them there.
    if (withPulls.length === 1 && withPulls[0]) return { game, account: withPulls[0], format: res.format === 'uigf-v4' ? 'UIGF' : 'SRGF' };
  }
  return null;
}

/**
 * T71: an attached pull history export is imported by the app (the same importer as Pulls →
 * History), not retyped by Claude. Undo removes exactly the pulls it added.
 */
export function HistoryOffer({ text, games }: { text: string; games: GameContract[] }) {
  const found = useMemo(() => historyFileFor(text, games), [text, games]);
  const [done, setDone] = useState<{ ids: string[]; undone: number | null } | null>(null);
  if (!found) return null;
  const { game, account, format } = found;
  if (done)
    return (
      <span className={s.offer} role="status">
        {done.undone !== null
          ? `Import undone: removed the ${done.undone} pulls it added.`
          : `Added ${done.ids.length} new pulls to ${game.short} History (${account.records.length - done.ids.length} already stored).`}
        {done.undone === null && done.ids.length > 0 && (
          <button type="button" className={s.tool} onClick={() => setDone({ ...done, undone: removePulls(game.id, done.ids) })}>
            Undo
          </button>
        )}
      </span>
    );
  return (
    <span className={s.offer}>
      This is a {format} pull history for {game.short} ({account.records.length} pulls).
      <button type="button" className={s.tool} onClick={() => setDone({ ids: importPulls(game.id, account.records), undone: null })}>
        Import into History
      </button>
    </span>
  );
}
