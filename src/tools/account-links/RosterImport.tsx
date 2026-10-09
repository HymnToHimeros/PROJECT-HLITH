import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Character, GameContract } from '../../core/contract';
import { useSession } from '../../core/auth/session';
import { backend } from '../../core/data/backend';
import { useGameData } from '../../core/data/userData';
import { BottomSheet, Button, ExampleTag, HowTo, UnverifiedTag } from '../../core/ui';
import c from './connections.module.css';
import { askHoyolab, hoyolabLink, rememberLogin, type HoyoAccount } from './hoyolab';
import { HoyolabLoginForm, HoyolabSteps, type LoginChoice } from './HoyolabLogin';
import { linkBlocker } from './LinkAccount';
import { applyImport, planImport, type ImportRow } from './rosterImport';

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

/**
 * Roster → "Import from HoYoLAB": find the characters you own on HoYoLAB,
 * preview them, then add them to your roster. Only adds; never removes.
 */
export function RosterImport({ game }: { game: GameContract }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const link = hoyolabLink(game);
  const roster = link?.supports.includes('roster');
  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={!roster} title={roster ? undefined : 'This game has no HoYoLAB character import'}>
        Import from HoYoLAB
      </Button>
      <BottomSheet open={open} side title={`Import ${game.terms.character.toLowerCase()}s from HoYoLAB`} onClose={close}>
        {open && <ImportSheet game={game} onClose={close} />}
      </BottomSheet>
    </>
  );
}

function ImportSheet({ game, onClose }: { game: GameContract; onClose: () => void }) {
  const signedIn = Boolean(useSession(backend));
  const characters = useCharacters(game);
  const roster = useGameData(game.id).roster;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<{ list: HoyoAccount[]; choice: LoginChoice } | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [imported, setImported] = useState<Parameters<typeof planImport>[1] | null>(null);
  const blocker = linkBlocker(signedIn);
  const who = game.terms.character.toLowerCase();

  // Re-plan whenever the roster changes, so the preview always matches what "Add" will do.
  const rows = useMemo(() => (imported && characters ? planImport(game, imported, characters, roster) : null), [imported, characters, roster, game]);

  const run = async (choice: LoginChoice) => {
    if (!backend) return;
    setBusy(true);
    setError(null);
    setAccounts(null);
    setDone(null);
    const res = await askHoyolab(backend, game, { login: choice.login, uid: choice.uid, want: ['roster'] });
    setBusy(false);
    if (!res.ok) {
      if (res.accounts?.length) setAccounts({ list: res.accounts, choice });
      return setError(res.text);
    }
    if (res.answer.problems.roster) return setError(res.answer.problems.roster.text);
    if (choice.remember) rememberLogin(game.id, choice.login, res.answer.account.uid);
    setImported(res.answer.roster ?? []);
  };

  const add = () => {
    if (!rows) return;
    const { added, updated } = applyImport(game.id, rows, roster);
    setDone(`Added ${added} and raised ${game.dupes?.name ?? 'dupes'} for ${updated}. Nothing was removed.`);
  };

  const changes = rows?.filter((r) => r.status === 'new' || r.status === 'update').length ?? 0;

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
          <>Paste your HoYoLAB login values below (the guide under this one shows where to find them), or use the login remembered on this device.</>,
          <>Press “Find my {who}s”. HLITH asks HoYoLAB which {who}s your account has, with their {game.dupes?.name ?? 'dupes'} and level.</>,
          <>Check the list. NEW = not marked as owned yet. RAISE = a higher {game.dupes?.name ?? 'dupe'} count than in HLITH.</>,
          <>Press “Add to my roster”. It only adds and raises: nothing you marked is removed or lowered, and wanted marks stay.</>,
        ]}
      >
        <p className={c.body}>HoYoLAB only shows {who}s you own. Anyone HoYoLAB lists that isn’t in HLITH’s list yet is shown but not added. Level and {game.terms.weapon} are shown here but not saved yet: HLITH doesn’t store builds yet.</p>
      </HowTo>
      <HoyolabSteps game={game} />
      <HoyolabLoginForm game={game} submitLabel={`Find my ${who}s`} busy={busy} disabledReason={blocker} onSubmit={(choice) => void run(choice)} />
      {error && (
        <span className={c.error} role="alert">
          {error}
        </span>
      )}
      {accounts && (
        <div className={c.row}>
          {accounts.list.map((a) => (
            <Button key={a.uid} onClick={() => void run({ ...accounts.choice, uid: a.uid })}>
              UID {a.uid} · {a.server}
            </Button>
          ))}
        </div>
      )}

      {rows ? (
        <section className={c.tight} aria-label="Found on HoYoLAB">
          <div className={c.cardHead}>
            <span className={c.label}>Found on HoYoLAB · {rows.length}</span>
            <Button variant="primary" disabled={changes === 0} onClick={add}>
              Add to my roster{changes ? ` (${changes})` : ''}
            </Button>
          </div>
          {done && (
            <span className={c.message} role="status">
              {done}
            </span>
          )}
          {rows.length === 0 ? <span className={c.muted}>HoYoLAB listed no {who}s for this account.</span> : <Rows game={game} rows={rows} />}
        </section>
      ) : (
        <ExamplePreview game={game} characters={characters} />
      )}
    </div>
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

/** Before any link: what the preview looks like, built from the game's own list and marked EXAMPLE. */
function ExamplePreview({ game, characters }: { game: GameContract; characters: Character[] | null }) {
  if (!characters || characters.length === 0) return <span className={c.muted}>No data yet: the {game.terms.character.toLowerCase()} list hasn’t loaded.</span>;
  const pick = [...characters].sort((a, b) => (a.rarity === b.rarity ? a.name.localeCompare(b.name) : a.rarity === 'top' ? -1 : 1)).slice(0, 4);
  const statuses: ImportRow['status'][] = ['new', 'update', 'same', 'new'];
  const rows: ImportRow[] = pick.map((ch, i) => ({ id: ch.id, name: ch.name, status: statuses[i] ?? 'same', dupesBefore: i === 1 ? 0 : null, dupesAfter: i === 1 ? 1 : 0, level: 80 - i * 10, weapon: null }));
  return (
    <section className={`${c.card} ${c.example}`} aria-label="Example preview">
      <div className={c.row}>
        <ExampleTag />
        <span className={c.muted}>What the list looks like after “Find my {game.terms.character.toLowerCase()}s”. Example, not your account.</span>
      </div>
      <Rows game={game} rows={rows} />
    </section>
  );
}
