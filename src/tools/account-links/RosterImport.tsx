import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Character, GameContract } from '../../core/contract';
import { backend } from '../../core/data/backend';
import { gameData, setRosterEntry, useGameData, type RosterEntry } from '../../core/data/userData';
import { BottomSheet, Button, ExampleTag, GameTag, HowTo, Segmented, UnverifiedTag } from '../../core/ui';
import { accountsFor, importSources, type LinkedAccount } from './accounts';
import c from './connections.module.css';
import { askHoyolab, hoyolabLink, type HoyoAccount, type HoyoCharacter, type HoyoLogin } from './hoyolab';
import { HoyolabSteps, PasteLogin } from './HoyolabLogin';
import { applyImport, planImport, type ImportRow } from './rosterImport';
import { useAccounts } from './useAccounts';
import { useExamplesShown } from '../../core/data/prefs';

/** The game's character list, loaded once. */
export function useCharacters(game: GameContract): Character[] | null {
  const [list, setList] = useState<Character[] | null>(null);
  useEffect(() => {
    let alive = true;
    void game.data
      .characters()
      .then((l) => alive && setList(l))
      .catch(() => alive && setList([]));
    return () => {
      alive = false;
    };
  }, [game]);
  return list;
}

const canImport = (g: GameContract) => Boolean(hoyolabLink(g)?.supports.includes('roster'));

/**
 * Roster → ONE "Import from HoYoLAB" button for every game in view. The sheet lets
 * the player pick a game (and which linked account reads it), or import every
 * connected game at once, each into its own roster. Only adds; never removes.
 */
export function RosterImport({ games }: { games: GameContract[] }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const importable = games.filter(canImport);
  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={importable.length === 0} title={importable.length ? undefined : 'None of these games has a HoYoLAB character import'}>
        Import from HoYoLAB
      </Button>
      <BottomSheet open={open} side title="Import from HoYoLAB" onClose={close}>
        {open && <ImportSheet games={importable} onClose={close} />}
      </BottomSheet>
    </>
  );
}

type Found = { status: 'ok'; list: HoyoCharacter[]; who: string } | { status: 'error'; text: string; accounts?: HoyoAccount[] };

function ImportSheet({ games, onClose }: { games: GameContract[]; onClose: () => void }) {
  const { accounts, blocker } = useAccounts(games);
  const several = games.length > 1;
  const [target, setTarget] = useState<string>(several ? 'all' : (games[0]?.id ?? ''));
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<Record<string, Found>>({});
  // A pasted login, held only while the player picks between several UIDs, then dropped.
  const [pending, setPending] = useState<HoyoLogin | null>(null);

  const targets = target === 'all' ? games : games.filter((g) => g.id === target);
  const sources = importSources(accounts, targets, picked);
  const single = target !== 'all' ? targets[0] : undefined;
  const pasteOnly = single ? accountsFor(accounts, single.id).length === 0 || picked[single.id] === 'paste' : false;

  const fetchOne = async (game: GameContract, source: { account: LinkedAccount; uid: string | undefined } | { login: HoyoLogin; uid?: string }): Promise<Found> => {
    if (!backend) return { status: 'error', text: 'HLITH’s server isn’t available on this device.' };
    const args =
      'login' in source
        ? { login: source.login, uid: source.uid, want: ['roster' as const] }
        : source.account.where === 'server'
          ? { linkId: source.account.id, uid: source.uid, want: ['roster' as const] }
          : { login: source.account.login as HoyoLogin, uid: source.uid, want: ['roster' as const] };
    const res = await askHoyolab(backend, game, args);
    if (!res.ok) return { status: 'error', text: res.text, ...(res.accounts ? { accounts: res.accounts } : {}) };
    if (res.answer.problems.roster) return { status: 'error', text: res.answer.problems.roster.text };
    return { status: 'ok', list: res.answer.roster ?? [], who: `${'login' in source ? 'pasted login' : source.account.label} · UID ${res.answer.account.uid}` };
  };

  const findFromAccounts = async () => {
    setBusy(true);
    const next: Record<string, Found> = {};
    for (const s of sources) next[s.game.id] = await fetchOne(s.game, { account: s.account, uid: s.uid });
    setFound((f) => ({ ...f, ...next }));
    setBusy(false);
  };
  const findFromPaste = async (game: GameContract, login: HoyoLogin, uid?: string) => {
    setBusy(true);
    const r = await fetchOne(game, { login, ...(uid ? { uid } : {}) });
    setPending(r.status === 'error' && r.accounts?.length ? login : null);
    setFound((f) => ({ ...f, [game.id]: r }));
    setBusy(false);
  };

  const missing = targets.filter((g) => !sources.some((s) => s.game.id === g.id));
  const shown = targets.filter((g) => found[g.id]);

  return (
    <div className={c.stack}>
      <div className={c.sheetBar}>
        <UnverifiedTag source="community docs" />
        <Button variant="quiet" onClick={onClose}>
          Close
        </Button>
      </div>
      <span className={c.muted}>HoYoLAB has no official API. This import follows community tools (genshin.py) and hasn’t been tested with a live account yet.</span>
      <HowTo
        title="How the import works"
        steps={[
          <>Pick the game, or “Every connected game”. Each game is imported into its own roster; games never mix.</>,
          <>Pick which HoYoLAB account reads each game (if you linked more than one, e.g. a main and an alt). Accounts are added in Account → Connected accounts. For one game you can also paste a login just for this import.</>,
          <>Press “Find my characters”. HLITH asks HoYoLAB which characters each account has, with their dupes and level.</>,
          <>Check each list. NEW = not marked as owned yet. RAISE = a higher dupe count than in HLITH.</>,
          <>Press “Add” under a game. It only adds and raises: nothing you marked is removed or lowered. Characters you now own leave your wanted list.</>,
        ]}
      >
        <p className={c.body}>HoYoLAB only shows characters you own. Anyone HoYoLAB lists that isn’t in HLITH’s list yet is shown but not added. Level and weapon are shown but not saved yet: HLITH doesn’t store builds yet.</p>
      </HowTo>

      {several && (
        <Segmented
          label="Which game to import"
          value={target}
          onChange={setTarget}
          options={[{ id: 'all', label: 'Every connected game' }, ...games.map((g) => ({ id: g.id, label: g.short }))]}
        />
      )}

      {blocker && <span className={c.muted}>{blocker}</span>}

      {sources.length > 0 && (
        <section className={c.tight} aria-label="Accounts to read">
          <span className={c.label}>Read from</span>
          <ul className={c.list}>
            {sources.map((s) => (
              <li key={s.game.id} className={c.listRow}>
                <span className={c.row}>
                  <GameTag label={s.game.short} vent={s.game.vent} /> {s.game.name}
                </span>
                <select
                  className={c.input}
                  style={{ maxWidth: 260 }}
                  aria-label={`Account for ${s.game.name}`}
                  value={picked[s.game.id] ?? s.account.id}
                  onChange={(e) => setPicked((p) => ({ ...p, [s.game.id]: e.target.value }))}
                >
                  {s.choices.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                      {a.games.find((g) => g.gameId === s.game.id)?.uid ? ` · UID ${a.games.find((g) => g.gameId === s.game.id)?.uid}` : ''}
                    </option>
                  ))}
                  {target !== 'all' && <option value="paste">Paste a login just for this</option>}
                </select>
              </li>
            ))}
          </ul>
          {!pasteOnly && (
            <div className={c.row}>
              <Button variant="primary" disabled={busy || blocker !== null} onClick={() => void findFromAccounts()}>
                {busy ? 'Asking HoYoLAB…' : 'Find my characters'}
              </Button>
            </div>
          )}
        </section>
      )}

      {target === 'all' && missing.length > 0 && (
        <span className={c.muted}>
          No linked account covers {missing.map((g) => g.name).join(' or ')}. Add one in Account → Connected accounts, or pick that game above to paste a login just for this import.
        </span>
      )}

      {single && pasteOnly && (
        <div className={c.tight}>
          <HoyolabSteps />
          <PasteLogin submitLabel="Find my characters" busy={busy} disabledReason={blocker} onSubmit={(l) => void findFromPaste(single, l)} />
          <span className={c.muted}>Used once for this import, then forgotten. To keep a login, add it in Account → Connected accounts.</span>
        </div>
      )}

      {shown.map((g) => {
        const f = found[g.id];
        if (!f) return null;
        if (f.status === 'error')
          return (
            <section key={g.id} className={c.tight} aria-label={`${g.name}: problem`}>
              <span className={c.row}>
                <GameTag label={g.short} vent={g.vent} />
                <span className={c.error} role="alert">
                  {f.text}
                </span>
              </span>
              {f.accounts && pending && (
                <div className={c.row}>
                  {f.accounts.map((a) => (
                    <Button key={a.uid} onClick={() => void findFromPaste(g, pending, a.uid)}>
                      UID {a.uid} · {a.server}
                    </Button>
                  ))}
                </div>
              )}
            </section>
          );
        return <GameImport key={g.id} game={g} imported={f.list} who={f.who} />;
      })}

      {shown.length === 0 && targets[0] && <ExamplePreview game={targets[0]} />}
    </div>
  );
}

/** One game's preview and its own "Add" button, writing only to that game's roster. */
export function GameImport({ game, imported, who }: { game: GameContract; imported: HoyoCharacter[]; who: string }) {
  const characters = useCharacters(game);
  const roster = useGameData(game.id).roster;
  const [done, setDone] = useState<string | null>(null);
  // What "Add" changed: each entry before and after, so Undo can put the earlier ones back.
  const [undo, setUndo] = useState<{ id: string; before: RosterEntry | undefined; after: RosterEntry }[] | null>(null);
  // Re-plan whenever the roster changes, so the preview always matches what "Add" will do.
  const rows = useMemo(() => (characters ? planImport(game, imported, characters, roster) : null), [imported, characters, roster, game]);
  const changes = rows?.filter((r) => r.status === 'new' || r.status === 'update').length ?? 0;
  const word = game.terms.character.toLowerCase();
  const add = () => {
    if (!rows) return;
    const touched = rows.flatMap((r) => (r.id && (r.status === 'new' || r.status === 'update') ? [r.id] : []));
    const before = touched.map((id) => ({ id, before: roster[id] }));
    const { added, updated } = applyImport(game.id, rows, roster);
    const now = gameData(game.id).roster;
    setUndo(before.flatMap((b) => (now[b.id] ? [{ ...b, after: now[b.id] as RosterEntry }] : [])));
    setDone(`Added ${added} and raised ${game.dupes?.name ?? 'dupes'} for ${updated} in your ${game.short} roster. Nothing was removed.`);
  };
  const undoAdd = () => {
    if (!undo) return;
    const now = gameData(game.id).roster;
    let changedSince = 0;
    for (const u of undo) {
      const cur = now[u.id];
      // Only put back what this import set; anything you changed since stays as you left it.
      if (!cur || cur.owned !== u.after.owned || cur.wanted !== u.after.wanted || cur.dupes !== u.after.dupes) {
        changedSince++;
        continue;
      }
      setRosterEntry(game.id, u.id, u.before ?? { owned: false, wanted: false, dupes: 0 });
    }
    setUndo(null);
    setDone(`Undone: your ${game.short} roster is back as it was before this import.${changedSince ? ` ${changedSince === 1 ? 'One you changed since stays' : `${changedSince} you changed since stay`} as you set ${changedSince === 1 ? 'it' : 'them'}.` : ''}`);
  };
  return (
    <section className={c.card} aria-label={`Found on HoYoLAB for ${game.name}`}>
      <div className={c.cardHead}>
        <span className={c.listName}>
          <span className={c.row}>
            <GameTag label={game.short} vent={game.vent} />
            <span className={c.label}>Found on HoYoLAB · {rows?.length ?? 0}</span>
          </span>
          <span className={c.listSub}>{who}</span>
        </span>
        <Button variant="primary" disabled={changes === 0} onClick={add}>
          Add to my {game.short} roster{changes ? ` (${changes})` : ''}
        </Button>
      </div>
      {done && (
        <span className={c.row}>
          <span className={c.message} role="status">
            {done}
          </span>
          {undo && undo.length > 0 && <Button onClick={undoAdd}>Undo</Button>}
        </span>
      )}
      {!rows ? <span className={c.muted}>Loading the {word} list…</span> : rows.length === 0 ? <span className={c.muted}>HoYoLAB listed no {word}s for this account.</span> : <Rows game={game} rows={rows} />}
    </section>
  );
}

const STATUS_WORD: Record<ImportRow['status'], string> = { new: 'new', update: 'raise', same: 'no change', unknown: 'not in HLITH' };

function Rows({ game, rows }: { game: GameContract; rows: ImportRow[] }) {
  const prefix = game.dupes?.prefix;
  return (
    <ul className={c.list}>
      {rows.map((r, i) => (
        <li key={`${r.id ?? r.name}-${i}`} className={c.listRow}>
          <span className={c.listName}>
            {r.name}
            <span className={c.listSub}>{[r.level !== null ? `Lv ${r.level}` : '', r.weapon ?? ''].filter(Boolean).join(' · ') || ' '}</span>
          </span>
          <span className={c.row}>
            {prefix && (
              <span className={c.num}>
                {r.status === 'update' && r.dupesBefore !== null ? `${prefix}${r.dupesBefore} → ` : ''}
                {prefix}
                {r.dupesAfter}
              </span>
            )}
            <span className={`${c.status} ${c[`status_${r.status}`] ?? ''}`}>{STATUS_WORD[r.status]}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Before any import: what the preview looks like, built from the game's own list and marked EXAMPLE. */
function ExamplePreview({ game }: { game: GameContract }) {
  const characters = useCharacters(game);
  const shown = useExamplesShown();
  if (!shown) return null; // Account → Example data: off
  if (!characters || characters.length === 0) return <span className={c.muted}>No data yet: the {game.terms.character.toLowerCase()} list hasn’t loaded.</span>;
  const pick = [...characters].sort((a, b) => (a.rarity === b.rarity ? a.name.localeCompare(b.name) : a.rarity === 'top' ? -1 : 1)).slice(0, 4);
  const statuses: ImportRow['status'][] = ['new', 'update', 'same', 'new'];
  const rows: ImportRow[] = pick.map((ch, i) => ({ id: ch.id, name: ch.name, status: statuses[i] ?? 'same', dupesBefore: i === 1 ? 0 : null, dupesAfter: i === 1 ? 1 : 0, level: 80 - i * 10, weapon: null }));
  return (
    <section className={`${c.card} ${c.example}`} aria-label="Example preview">
      <div className={c.row}>
        <ExampleTag />
        <span className={c.muted}>
          What the {game.short} list looks like after “Find my characters”. Example, not your account.
        </span>
      </div>
      <Rows game={game} rows={rows} />
    </section>
  );
}
