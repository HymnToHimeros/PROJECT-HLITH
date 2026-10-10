import { useState, type FormEvent } from 'react';
import type { TeamPreset } from '../../core/contract';
import { resetTeamList, setTeamList } from '../../core/data/userData';
import { Button } from '../../core/ui';
import r from './roster.module.css';
import { artOf, byNewest, CharArt, elementOf, entryOf } from './shared';
import type { RosterData } from './useRosterData';

/** The game's own lists for a team, one per slot, in the card's order. */
export const gameSlots = (p: TeamPreset): string[][] => p.slots.map((s) => s.characters);

/** The lists a team card uses: your edit when you made one (T29), else the game's. */
export const slotsOf = (data: RosterData, p: TeamPreset): string[][] => data.user.teamLists?.[p.id]?.slots ?? gameSlots(p);

const same = (a: string[][], b: string[][]) => a.length === b.length && a.every((s, i) => s.length === b[i]?.length && s.every((id, j) => id === b[i]?.[j]));

/**
 * Edit a game team's lists (owner, T29): per slot, who may play there, best first. Add anyone,
 * move one earlier or later, remove one. "Reset to the game's list" puts the game's lists back in
 * the form; Save keeps it (saving the game's own lists removes your edit). Cancel changes nothing.
 */
export function TeamListEditor({ data, preset, onDone }: { data: RosterData; preset: TeamPreset; onDone: () => void }) {
  const { game } = data;
  const [slots, setSlots] = useState<string[][]>(() => slotsOf(data, preset).map((s) => [...s]));
  const [adding, setAdding] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const nameOf = (id: string) => data.byId.get(id)?.name ?? id;
  const word = game.terms.character.toLowerCase();
  const change = (i: number, next: (s: string[]) => string[]) => setSlots((all) => all.map((s, j) => (j === i ? next(s) : s)));
  const move = (i: number, at: number, by: number) =>
    change(i, (s) => {
      const to = at + by;
      if (to < 0 || to >= s.length) return s;
      const copy = [...s];
      [copy[at], copy[to]] = [copy[to] as string, copy[at] as string];
      return copy;
    });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (same(slots, gameSlots(preset))) resetTeamList(game.id, preset.id);
    else setTeamList(game.id, preset.id, slots);
    onDone();
  };

  // Owned first, then wanted, then the newest; a search finds anyone.
  const rank = (id: string) => {
    const e = entryOf(data.user.roster, id);
    return e.owned ? 0 : e.wanted ? 1 : 2;
  };
  const q = query.trim().toLowerCase();
  const inSlot = adding === null ? [] : (slots[adding] ?? []);
  const options = [...data.characters]
    .filter((c) => !inSlot.includes(c.id) && (!q || c.name.toLowerCase().includes(q)))
    .sort((a, b) => rank(a.id) - rank(b.id) || byNewest(a, b))
    .slice(0, q ? 40 : 12);

  return (
    <form className={r.stack} onSubmit={submit}>
      <p className={r.muted}>
        Who may play in each slot of {preset.name}, best first. HLITH fills the team from your roster in this order, and every team score and suggestion uses your lists instead of the game’s.
      </p>
      {slots.map((s, i) => (
        <fieldset key={i} className={r.listSlot}>
          <legend className={r.fieldLabel}>Slot {i + 1}</legend>
          {s.length === 0 && <p className={r.muted}>Nobody yet: this slot stays empty.</p>}
          <ol className={r.listRows}>
            {s.map((id, at) => {
              const c = data.byId.get(id);
              const owned = entryOf(data.user.roster, id).owned;
              return (
                <li key={id} className={r.listRow}>
                  <CharArt name={nameOf(id)} src={c ? artOf(c, 'portrait') : undefined} elementColor={(c && elementOf(game, c.element)?.color) ?? 'var(--ink-4)'} className={r.memberArtSm} />
                  <span className={r.pickText}>
                    <span>{nameOf(id)}</span>
                    <span className={r.memberState} data-status={owned ? 'owned' : 'gap'}>
                      {owned ? 'owned' : 'not owned'}
                    </span>
                  </span>
                  <span className={r.listTools}>
                    <Button variant="quiet" aria-label={`Move ${nameOf(id)} earlier in slot ${i + 1}`} disabled={at === 0} onClick={() => move(i, at, -1)}>
                      ↑
                    </Button>
                    <Button variant="quiet" aria-label={`Move ${nameOf(id)} later in slot ${i + 1}`} disabled={at === s.length - 1} onClick={() => move(i, at, 1)}>
                      ↓
                    </Button>
                    <Button variant="quiet" aria-label={`Remove ${nameOf(id)} from slot ${i + 1}`} onClick={() => change(i, (list) => list.filter((x) => x !== id))}>
                      ✕
                    </Button>
                  </span>
                </li>
              );
            })}
          </ol>
          {adding === i ? (
            <div className={r.stack}>
              <label className={r.field}>
                <span className={r.fieldLabel}>Add to slot {i + 1}</span>
                <input className={r.input} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`${game.terms.character} name`} autoFocus />
              </label>
              <ul className={r.pickList} aria-label={`${game.terms.character}s to add to slot ${i + 1}`}>
                {options.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={r.pick}
                      onClick={() => {
                        change(i, (list) => [...list, c.id]);
                        setQuery('');
                      }}
                    >
                      <CharArt name={c.name} src={artOf(c, 'portrait')} elementColor={elementOf(game, c.element)?.color ?? 'var(--ink-4)'} className={r.memberArtSm} />
                      <span className={r.pickText}>
                        <span>{c.name}</span>
                        <span className={r.memberState} data-status={rank(c.id) === 0 ? 'owned' : 'gap'}>
                          {rank(c.id) === 0 ? 'owned' : 'not owned'}
                        </span>
                      </span>
                      <span className={r.pickMark} aria-hidden="true">
                        +
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {options.length === 0 && (
                <p className={r.muted}>
                  No {word} matches “{query}”.
                </p>
              )}
              <Button variant="quiet" onClick={() => setAdding(null)}>
                Done adding
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => {
                setAdding(i);
                setQuery('');
              }}
            >
              + Add to slot {i + 1}
            </Button>
          )}
        </fieldset>
      ))}
      <div className={r.cardActions}>
        <Button type="submit" variant="primary">
          Save team list
        </Button>
        <Button onClick={onDone}>Cancel</Button>
        <Button variant="quiet" disabled={same(slots, gameSlots(preset))} onClick={() => setSlots(gameSlots(preset).map((s) => [...s]))}>
          Reset to the game’s list
        </Button>
      </div>
    </form>
  );
}
