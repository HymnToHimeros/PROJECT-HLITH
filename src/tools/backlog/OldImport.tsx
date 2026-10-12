import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import type { BacklogItem, GameContract } from '../../core/contract';
import { gameData, useAllUserData } from '../../core/data/userData';
import { formatDate } from '../../core/time/reset';
import { Button } from '../../core/ui';
import { mergeOwnItems } from '../edit-mode/merge';
import b from './backlog.module.css';
import { applyImport, exportBacklog, parseBacklogFile, planImport, TEMPLATE, undoImport, type ImportUndo } from './backlogFile';

const premiumOf = (games: GameContract[]) => (id: string) => {
  const g = games.find((x) => x.id === id);
  return g?.currencies.find((c) => c.perPull && !c.paid)?.id ?? g?.currencies[0]?.id ?? '';
};

/** Your own items and progress per game, read again when your data changes. */
function useOwn(games: GameContract[]) {
  const all = useAllUserData();
  return useMemo(() => {
    void all;
    return Object.fromEntries(games.map((g) => [g.id, { own: gameData(g.id).ownItems.backlog, progress: gameData(g.id).backlog }]));
  }, [all, games]);
}

/**
 * The preview and Apply for one backlog file (T73). Every row becomes one of your own items in
 * full; the same file again only raises progress. Nothing changes before Apply; Undo hides what
 * the import added and puts progress back.
 */
export function ImportPanel({ text, games, compact = false }: { text: string; games: GameContract[]; compact?: boolean }) {
  const parsed = useMemo(() => parseBacklogFile(text), [text]);
  const own = useOwn(games);
  const [done, setDone] = useState<{ undo: ImportUndo; added: number; raised: number; undone: boolean } | null>(null);
  const plan = useMemo(() => (parsed.ok ? planImport(parsed.value.rows, own) : null), [parsed, own]);

  if (!parsed.ok || !plan)
    return (
      <p className={b.warn} role="alert">
        {parsed.ok ? 'This file can’t be read.' : parsed.error}
      </p>
    );
  const { asOf, notes, rows } = parsed.value;
  const date = asOf ? `progress from ${formatDate(Date.parse(asOf))} (the file’s date)` : 'the file doesn’t say when its progress is from';

  if (done)
    return (
      <div className={compact ? b.importCompact : b.importBox} role="status" aria-label="Import result">
        {done.undone ? (
          <p className={b.importLead}>Import undone: the items it added are hidden (Edit → Show hidden brings them back) and your progress is back as it was.</p>
        ) : (
          <>
            <p className={b.importLead}>
              Imported: {done.added} {done.added === 1 ? 'item' : 'items'} added to your backlog{done.raised ? `, ${done.raised} got more progress` : ''}. Nothing was lowered.
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

  const nothing = plan.add.length === 0 && plan.raise.length === 0 && plan.showAgain.length === 0;
  const before = rows.length - plan.add.length - plan.otherGame;
  return (
    <div className={compact ? b.importCompact : b.importBox} aria-label="Import preview">
      <p className={b.importLead}>
        {plan.add.length} {plan.add.length === 1 ? 'item' : 'items'} to add · {plan.addWithProgress} with progress · {date}
      </p>
      <ul className={b.importList}>
        <li>They become your own backlog items, in full: name, category, total, progress, reward, unit, step, place and note.</li>
        {before > 0 && (
          <li>
            {before} {before === 1 ? 'is' : 'are'} already in your backlog from an earlier import
            {plan.raise.length ? `: ${plan.raise.length} get more progress` : ''}. Nothing is added twice or lowered.
          </li>
        )}
        {plan.otherGame > 0 && <li>{plan.otherGame} are for a game that isn’t switched on here, so they’re left out.</li>}
      </ul>
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
            const undo = applyImport(plan, premiumOf(games));
            setDone({ undo, added: plan.add.length, raised: plan.raise.length, undone: false });
          }}
        >
          {nothing ? 'Nothing new to import' : 'Apply'}
        </Button>
      </div>
    </div>
  );
}

/** Built-in lists, for Export (what you see: built-in items with your changes, and your own). */
function useBuiltIn(games: GameContract[]) {
  const [lists, setLists] = useState<Record<string, BacklogItem[]> | null>(null);
  useEffect(() => {
    let alive = true;
    void Promise.all(games.map(async (g) => [g.id, await g.data.backlog()] as const)).then((pairs) => alive && setLists(Object.fromEntries(pairs)));
    return () => {
      alive = false;
    };
  }, [games]);
  return lists;
}

const download = (name: string, text: string) => {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Backlog → import from the old app or any backlog file, export yours, and the file format. */
export function OldImportButton({ games }: { games: GameContract[] }) {
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [error, setError] = useState('');
  const builtIn = useBuiltIn(games);
  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return setError('That file is too large for a backlog file (5 MB at most).');
    try {
      setFile({ name: f.name, text: await f.text() });
      setError('');
    } catch {
      setError('Your browser couldn’t read that file.');
    }
  };
  const exportMine = () => {
    if (!builtIn) return;
    const text = exportBacklog(
      games.map((g) => {
        const user = gameData(g.id);
        return { id: g.id, items: mergeOwnItems('backlog', builtIn[g.id] ?? [], user.ownItems.backlog), progress: user.backlog };
      }),
    );
    download(`hlith-backlog-${new Date().toISOString().slice(0, 10)}.json`, text);
  };
  return (
    <section className={b.card} aria-label="Import from old app">
      <div className={b.importHead}>
        <span className={b.importTitle}>Import from old app</span>
        <span className={b.importActions}>
          <label className={b.importPick}>
            <input type="file" accept=".json,application/json" onChange={(e) => void onFile(e)} aria-label="Backlog file (.json)" />
            <span>{file ? 'Choose another file' : 'Choose file'}</span>
          </label>
          <Button variant="quiet" onClick={exportMine} disabled={!builtIn}>
            Export my backlog
          </Button>
        </span>
      </div>
      {!file && !error && <p className={b.muted}>Pick the backlog export from Gacha Tracker, or any file in HLITH’s backlog format. Its items become yours, with their progress; you see what changes first.</p>}
      {error && (
        <p className={b.warn} role="alert">
          {error}
        </p>
      )}
      {file && <ImportPanel key={file.name + file.text.length} text={file.text} games={games} />}
      <FileFormat />
    </section>
  );
}

/** The documented format, with an example and a template to download. */
export function FileFormat() {
  return (
    <details className={b.importNotes}>
      <summary>File format</summary>
      <p className={b.muted}>
        A JSON file with <code>"format": "hlith-backlog-export"</code>, <code>"version": 1</code> and a <code>"backlog"</code> list. Each row: <code>id</code>, <code>game</code> (hsr, zzz), <code>label</code> and{' '}
        <code>total</code> (required), and optionally <code>category</code> (a new name makes a new category), <code>done</code>, <code>rewardEach</code> (premium currency per unit),{' '}
        <code>rewardUnknown</code>, <code>unit</code>, <code>step</code> (how much − / + changes it), <code>where</code> and <code>note</code>. <code>dataAsOf</code> says when the progress is from.
        Export my backlog writes the same format, so a file can go from one account to another.
      </p>
      <pre className={b.importCode}>{`{ "format": "hlith-backlog-export", "version": 1,
  "backlog": [
    { "id": "my_chests", "game": "zzz", "category": "Exploration",
      "label": "Chests in a new area", "total": 40, "done": 12,
      "rewardEach": 5, "unit": "chest" }
  ] }`}</pre>
      <Button variant="quiet" onClick={() => download('hlith-backlog-template.json', TEMPLATE)}>
        Download a template
      </Button>
    </details>
  );
}
