import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import type { BacklogItem, GameContract } from '../../core/contract';
import { gameData, useAllUserData } from '../../core/data/userData';
import { formatDate } from '../../core/time/reset';
import { Button } from '../../core/ui';
import { mergeOwnItems } from '../edit-mode/merge';
import b from './backlog.module.css';
import { applyImport, parseOldExport, planImport, undoImport, type ImportUndo } from './oldImport';

/** Each game's backlog as you see it now (built-in items with your changes), and your progress. */
function useLists(games: GameContract[]) {
  const all = useAllUserData();
  const [builtIn, setBuiltIn] = useState<Record<string, BacklogItem[]> | null>(null);
  useEffect(() => {
    let alive = true;
    void Promise.all(games.map(async (g) => [g.id, await g.data.backlog()] as const)).then((pairs) => {
      if (alive) setBuiltIn(Object.fromEntries(pairs));
    });
    return () => {
      alive = false;
    };
  }, [games]);
  return useMemo(() => {
    void all; // read again when your data changes
    if (!builtIn) return null;
    const lists: Record<string, BacklogItem[]> = {};
    const progress: Record<string, Record<string, number>> = {};
    for (const g of games) {
      const user = gameData(g.id);
      lists[g.id] = mergeOwnItems('backlog', builtIn[g.id] ?? [], user.ownItems.backlog);
      progress[g.id] = user.backlog;
    }
    return { lists, progress };
  }, [all, builtIn, games]);
}

const premiumOf = (games: GameContract[]) => (id: string) => {
  const g = games.find((x) => x.id === id);
  return g?.currencies.find((c) => c.perPull && !c.paid)?.id ?? g?.currencies[0]?.id ?? '';
};

/**
 * The preview and Apply for one old-app export (T73). Shows what changes before anything does:
 * how many items get progress, that none is lowered, what has no match, and the file's own date.
 * Apply raises progress only; Undo puts the whole import back.
 */
export function OldImportPanel({ text, games, compact = false }: { text: string; games: GameContract[]; compact?: boolean }) {
  const parsed = useMemo(() => parseOldExport(text), [text]);
  const data = useLists(games);
  const [addUnmatched, setAddUnmatched] = useState(false);
  const [done, setDone] = useState<{ undo: ImportUndo; raised: number; added: number; undone: boolean } | null>(null);
  const plan = useMemo(() => (parsed.ok && data ? planImport(parsed.value.rows, data.lists, data.progress) : null), [parsed, data]);

  if (!parsed.ok)
    return (
      <p className={b.warn} role="alert">
        {parsed.error}
      </p>
    );
  if (!plan) return <p className={b.muted}>Reading your backlog…</p>;
  const { asOf, notes, rows } = parsed.value;
  const asOfLine = asOf ? `Progress in this file is from ${formatDate(Date.parse(asOf))} (the date the file gives).` : 'The file doesn’t say when its progress is from.';
  const games2 = [...new Set(rows.map((r) => r.game))].map((id) => games.find((g) => g.id === id)?.short ?? id.toUpperCase()).join(' and ');

  if (done)
    return (
      <div className={compact ? b.importCompact : b.importBox} role="status" aria-label="Import result">
        {done.undone ? (
          <p className={b.importLead}>Import undone: your backlog progress is back exactly as it was{done.added ? ', and the items it added are hidden' : ''}.</p>
        ) : (
          <>
            <p className={b.importLead}>
              Imported: {done.raised} {done.raised === 1 ? 'item got' : 'items got'} progress{done.added ? `, ${done.added} added as your own` : ''}. Nothing was lowered.
            </p>
            <div className={b.importActions}>
              <Button
                onClick={() => {
                  undoImport(done.undo);
                  setDone({ ...done, undone: true });
                }}
              >
                Undo this import
              </Button>
            </div>
          </>
        )}
      </div>
    );

  const nothing = plan.raise.length === 0 && !(addUnmatched && plan.unmatched.length);
  return (
    <div className={compact ? b.importCompact : b.importBox} aria-label="Import preview">
      <p className={b.importLead}>
        Old app backlog for {games2}: {rows.length} rows.
      </p>
      <ul className={b.importList}>
        <li>
          <strong>{plan.raise.length}</strong> {plan.raise.length === 1 ? 'item gets' : 'items get'} progress, <strong>0</strong> lowered.
        </li>
        {plan.lowerSkipped > 0 && <li>{plan.lowerSkipped} left as they are: you’re further along in HLITH than the file says.</li>}
        {plan.same > 0 && <li>{plan.same} already match.</li>}
        {plan.noProgress > 0 && <li>{plan.noProgress} have no progress in the file.</li>}
        {plan.otherGame > 0 && <li>{plan.otherGame} are for a game that isn’t switched on here.</li>}
        {plan.unmatched.length > 0 && (
          <li>
            {plan.unmatched.length} have no matching item in HLITH’s list.{' '}
            <label className={b.importCheck}>
              <input type="checkbox" checked={addUnmatched} onChange={(e: ChangeEvent<HTMLInputElement>) => setAddUnmatched(e.target.checked)} /> Add them as my own items
            </label>
          </li>
        )}
      </ul>
      <p className={b.muted}>{asOfLine} Only progress comes in; nothing is lowered or wiped, and Undo puts it all back.</p>
      {notes.length > 0 && !compact && (
        <details className={b.importNotes}>
          <summary>The file’s own notes</summary>
          <ul>
            {notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </details>
      )}
      <div className={b.importActions}>
        <Button
          variant="primary"
          disabled={nothing}
          onClick={() => {
            const undo = applyImport(plan, { addUnmatched, premium: premiumOf(games) });
            setDone({ undo, raised: plan.raise.length, added: addUnmatched ? plan.unmatched.length : 0, undone: false });
          }}
        >
          {nothing ? 'Nothing to import' : 'Apply'}
        </Button>
      </div>
    </div>
  );
}

/** Backlog → "Import from old app": pick the export file, see the preview, apply. */
export function OldImportButton({ games }: { games: GameContract[] }) {
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [error, setError] = useState('');
  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return setError('That file is too large for a backlog export.');
    try {
      setFile({ name: f.name, text: await f.text() });
      setError('');
    } catch {
      setError('Your browser couldn’t read that file.');
    }
  };
  return (
    <section className={b.card} aria-label="Import from old app">
      <div className={b.importHead}>
        <span className={b.importTitle}>Import from old app</span>
        <label className={b.importPick}>
          <input type="file" accept=".json,application/json" onChange={(e) => void onFile(e)} aria-label="Backlog export from the old app (.json)" />
          <span>{file ? 'Choose another file' : 'Choose the export file'}</span>
        </label>
      </div>
      {!file && !error && <p className={b.muted}>Bring your progress over from Gacha Tracker: pick its backlog export (.json). You’ll see what changes before anything does.</p>}
      {error && (
        <p className={b.warn} role="alert">
          {error}
        </p>
      )}
      {file && <OldImportPanel key={file.name + file.text.length} text={file.text} games={games} />}
    </section>
  );
}
