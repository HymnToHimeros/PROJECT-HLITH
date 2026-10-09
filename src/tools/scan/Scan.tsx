import { useCallback, useEffect, useId, useState, type ClipboardEvent, type DragEvent, type FormEvent } from 'react';
import type { GameContract } from '../../core/contract';
import { useGameData } from '../../core/data/userData';
import { BottomSheet, Button, ExampleTag, HowTo, Segmented } from '../../core/ui';
import c from '../account-links/connections.module.css';
import { useCharacters } from '../account-links/RosterImport';
import { checkValues, fieldsFor, saveScan, type ScanReader, type ScanValues } from './scan';

/**
 * Roster → ONE "Scan a screenshot" button for every game in view. The sheet asks
 * which game the screenshot is from (when there's more than one), and saves only
 * to that game's roster.
 */
export function ScanEntry({ games, reader }: { games: GameContract[]; reader?: ScanReader | undefined }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const scannable = games.filter((g) => g.scan);
  const [gameId, setGameId] = useState(scannable[0]?.id ?? '');
  const game = scannable.find((g) => g.id === gameId) ?? scannable[0];
  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={!game} title={game ? undefined : 'None of these games has a screenshot scan'}>
        Scan a screenshot
      </Button>
      <BottomSheet open={open} side title="Scan a screenshot" onClose={close}>
        {open && game && (
          <>
            <div className={c.sheetBar}>
              {scannable.length > 1 ? (
                <Segmented label="Which game is the screenshot from" value={game.id} onChange={setGameId} options={scannable.map((g) => ({ id: g.id, label: g.short }))} />
              ) : (
                <span className={c.muted}>{game.name}</span>
              )}
              <Button variant="quiet" onClick={close}>
                Close
              </Button>
            </div>
            <Scan key={game.id} game={game} reader={reader} />
          </>
        )}
      </BottomSheet>
    </>
  );
}

/**
 * Screenshot scan (R50): pick, drop or paste a screenshot of a character screen,
 * see it next to a form of the fields the game record lists, confirm or correct,
 * then save. Manual entry works now; "Read it for me" needs the Assistant key.
 */
export function Scan({ game, reader, characterId }: { game: GameContract; reader?: ScanReader | undefined; characterId?: string }) {
  const id = useId();
  const characters = useCharacters(game);
  const roster = useGameData(game.id).roster;
  const fields = fieldsFor(game);
  const [shot, setShot] = useState<{ image: Blob; url: string } | null>(null);
  const image = shot?.image ?? null;
  const url = shot?.url ?? null;
  const [dragging, setDragging] = useState(false);
  const [who, setWho] = useState(characterId ?? '');
  const [values, setValues] = useState<ScanValues>({});
  const [read, setRead] = useState<{ character?: string } | null>(null);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error' | 'busy'; text: string } | null>(null);
  const term = game.terms.character.toLowerCase();

  // The picture stays in this browser; its preview address is released when it changes or the sheet closes.
  useEffect(() => (shot ? () => URL.revokeObjectURL(shot.url) : undefined), [shot]);

  const take = (file: File | Blob | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setStatus({ kind: 'error', text: 'That isn’t a picture. Pick a screenshot (PNG or JPG).' });
    setStatus(null);
    setRead(null);
    setShot({ image: file, url: URL.createObjectURL(file) });
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    take(e.dataTransfer.files[0]);
  };
  const onPaste = (e: ClipboardEvent) => {
    const item = [...e.clipboardData.items].find((i) => i.type.startsWith('image/'));
    if (item) take(item.getAsFile());
  };

  const readIt = async () => {
    if (!reader || !image) return;
    setStatus({ kind: 'busy', text: 'Reading…' });
    try {
      const res = await reader(image, fields);
      setValues((v) => ({ ...v, ...res.values }));
      setRead(res.character ? { character: res.character } : {});
      setStatus(null);
    } catch {
      setStatus({ kind: 'error', text: 'Nothing could be read. Try a sharper, full-screen screenshot, or type the values.' });
    }
  };

  const problems = checkValues(fields, values);
  const chosen = characters?.find((ch) => ch.id === who);
  const mismatch = read?.character && chosen && read.character.toLowerCase() !== chosen.name.toLowerCase();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!who || Object.keys(problems).length) return;
    const entry = saveScan(game, who, values, roster);
    setStatus({ kind: 'ok', text: `Saved: ${chosen?.name ?? who} is owned${game.dupes ? `, ${game.dupes.prefix}${entry.dupes}` : ''}.` });
  };

  if (!game.scan) return <p className={c.muted}>No data yet: this game’s record doesn’t list which fields a screenshot scan reads.</p>;

  return (
    <div className={c.stack} onPaste={onPaste}>
      <HowTo
        title="How to scan a screenshot"
        steps={[
          <>In the game, open the {term} screen of the {term} you want: the page that shows their level{game.dupes ? ` and ${game.dupes.name}` : ''}.</>,
          <>Take a screenshot. Windows: Win + Shift + S, or Print Screen. Mac: Cmd + Shift + 4. Phone: your phone’s screenshot buttons.</>,
          <>Here, press “Choose a screenshot”, drop the picture on the box, or paste it (Ctrl + V / Cmd + V).</>,
          <>Pick who it is. Type what you see into the fields, or use “Read it for me” once your Assistant key is set.</>,
          <>Check every field against the game, then press Save. Empty fields stay as they were.</>,
        ]}
      >
        <p className={c.body}>
          The picture stays in this browser and isn’t uploaded. With “Read it for me”, the picture goes to the Assistant with your own key, only to read it. For gear, two screenshots are fine: a later reading only fills what it shows.
        </p>
      </HowTo>

      <div
        className={`${c.drop} ${dragging ? c.dropActive : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        {url ? <img className={c.shot} src={url} alt={`Your screenshot${chosen ? ` of ${chosen.name}` : ''}`} /> : <span>Drop a screenshot here, or paste one.</span>}
        <input
          id={`${id}-file`}
          type="file"
          accept="image/*"
          aria-label="Choose a screenshot"
          tabIndex={-1}
          className={c.visuallyHidden}
          onChange={(e) => {
            take(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <Button onClick={() => document.getElementById(`${id}-file`)?.click()}>{url ? 'Choose another' : 'Choose a screenshot'}</Button>
      </div>

      <div className={c.tight}>
        <div className={c.row}>
          <Button disabled={!reader || !image || status?.kind === 'busy'} onClick={() => void readIt()}>
            Read it for me (uses your Assistant key)
          </Button>
        </div>
        {!reader && <span className={c.muted}>Not available yet: reading pictures needs the Assistant with your own key, which isn’t set up. Type the values below for now.</span>}
        {reader && !image && <span className={c.muted}>Choose a screenshot first.</span>}
      </div>

      {read?.character && (
        <span className={mismatch ? c.error : c.muted}>
          {mismatch ? `The screenshot looks like ${read.character}, not ${chosen?.name}. Saving would put it on ${chosen?.name}.` : `Read from the screenshot: ${read.character}.`}
        </span>
      )}

      <form className={c.tight} onSubmit={submit} aria-label="Confirm what the screenshot shows">
        <label className={c.field} htmlFor={`${id}-who`}>
          {game.terms.character}
        </label>
        <select id={`${id}-who`} className={c.input} value={who} onChange={(e) => setWho(e.target.value)} required>
          <option value="">Pick who it is…</option>
          {[...(characters ?? [])]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.name}
              </option>
            ))}
        </select>
        <div className={c.grid}>
          {fields.map((f) => (
            <div key={f.id} className={c.tight}>
              <label className={c.field} htmlFor={`${id}-${f.id}`}>
                {f.label}
                {f.max !== undefined && f.kind === 'dupes' ? ` (0–${f.max})` : ''}
              </label>
              <input
                id={`${id}-${f.id}`}
                className={c.input}
                inputMode={f.kind === 'text' ? 'text' : 'numeric'}
                value={values[f.id] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
                placeholder={f.kind === 'text' ? 'As shown in game' : 'Leave empty to keep'}
                aria-invalid={problems[f.id] ? true : undefined}
              />
              {problems[f.id] && <span className={c.error}>{problems[f.id]}</span>}
              {!f.saved && <span className={c.muted}>Not saved yet (HLITH doesn’t store builds yet).</span>}
            </div>
          ))}
        </div>
        <div className={c.row}>
          <Button type="submit" variant="primary" disabled={!who || Object.keys(problems).length > 0}>
            Save to my roster
          </Button>
          <span className={c.muted}>Marks them as owned{game.dupes ? ` and sets their ${game.dupes.name}` : ''}.</span>
        </div>
        {status && (
          <span className={status.kind === 'error' ? c.error : status.kind === 'ok' ? c.message : c.muted} role={status.kind === 'error' ? 'alert' : 'status'}>
            {status.text}
          </span>
        )}
      </form>

      {!url && (
        <div className={`${c.notBuilt}`}>
          <span className={c.row}>
            <ExampleTag /> <span className={c.label}>What a reading looks like</span>
          </span>
          <span>
            Read from the screenshot: {fields.map((f) => `${f.label} ${f.kind === 'dupes' ? '2' : f.kind === 'level' ? '80' : '…'}`).join(' · ')}
          </span>
          <span className={c.muted}>Check it against the game before saving: a reading is only as good as the screenshot.</span>
        </div>
      )}
    </div>
  );
}
