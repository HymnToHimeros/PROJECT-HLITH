import { useCallback, useState, type FormEvent } from 'react';
import type { Character, GameContract, TeamPreset } from '../../core/contract';
import { saveTeam, type UserTeam } from '../../core/data/userData';
import type { RosterEntry } from '../../core/data/userData';
import { BottomSheet, Button, ExampleTag, NoData } from '../../core/ui';
import { KitCheck } from './KitCheck';
import r from './roster.module.css';
import { byNewest, entryOf, WhoChip } from './shared';
import type { RosterData } from './useRosterData';

interface Props {
  game: GameContract;
  data: RosterData;
  onOpen: (id: string) => void;
  openCharacters: () => void;
}

/*
 * Interface only. Logic is filled by the ROSTER-LOGIC workstream: scoring
 * presets against your roster (owned / wanted / gaps), who fills which slot
 * and team ideas. Until then the score spot shows "No data yet".
 */

const statusOf = (e: RosterEntry): 'owned' | 'wanted' | 'gap' => (e.owned ? 'owned' : e.wanted ? 'wanted' : 'gap');

/** Teams: recommended presets (with a spot for their score), your own teams, and Kit check for any team. */
export function Teams({ game, data, onOpen, openCharacters }: Props) {
  const [kitFor, setKitFor] = useState<{ name: string; members: string[] } | null>(null);
  const [editing, setEditing] = useState<UserTeam | 'new' | null>(null);
  const closeKit = useCallback(() => setKitFor(null), []);
  const closeEditor = useCallback(() => setEditing(null), []);
  const nameOf = (id: string | null) => (id ? (data.byId.get(id)?.name ?? id) : '');
  const presets = data.presets.list;
  const stateOf = (id: string) => statusOf(entryOf(data.user.roster, id));

  return (
    <div className={r.stack}>
      <section className={r.stack} aria-label="Recommended teams">
        <div className={r.sectionHead}>
          <h3 className={r.sectionTitle}>Recommended teams</h3>
          <span className={r.muted}>Each slot lists who fits it, best first, with whether you own them.</span>
        </div>
        {presets.length === 0 ? (
          <p className={r.muted}>No recommended teams yet.</p>
        ) : (
          <div className={r.teamGrid}>
            {presets.map((preset) => (
              <PresetCard
                key={preset.id}
                preset={preset}
                example={data.presets.example}
                nameOf={nameOf}
                stateOf={stateOf}
                onOpen={onOpen}
                onKit={() => setKitFor({ name: preset.name, members: preset.slots.map((s) => s.characters[0]).filter((x): x is string => Boolean(x)) })}
              />
            ))}
          </div>
        )}
      </section>

      <section className={r.stack} aria-label="Your teams">
        <div className={r.sectionHead}>
          <h3 className={r.sectionTitle}>Your teams</h3>
          <Button variant="primary" onClick={() => setEditing('new')}>
            New team
          </Button>
        </div>
        {data.user.teams.length === 0 ? (
          <p className={r.muted}>You haven’t made a team yet. Pick up to {data.teamSize} of the {game.terms.character.toLowerCase()}s you own.</p>
        ) : (
          <div className={r.teamGrid}>
            {data.user.teams.map((t) => {
              return (
                <article key={t.id} className={r.card}>
                  <div className={r.cardHead}>
                    <h4 className={r.cardTitle}>{t.name}</h4>
                  </div>
                  <span className={r.chips}>
                    {t.members.map((id) => (
                      <button key={id} type="button" className={r.chipButton} onClick={() => onOpen(id)}>
                        <WhoChip name={nameOf(id)} status={stateOf(id)} />
                      </button>
                    ))}
                  </span>
                  <div className={r.cardActions}>
                    <Button onClick={() => setKitFor({ name: t.name, members: t.members })}>Kit check</Button>
                    <Button variant="quiet" onClick={() => setEditing(t)}>
                      Edit
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <BottomSheet open={kitFor !== null} side title={kitFor ? `Kit check · ${kitFor.name}` : 'Kit check'} onClose={closeKit}>
        {kitFor && (
          <div className={r.sheetBar}>
            <span className={r.muted}>{kitFor.members.length} in this team</span>
            <Button variant="quiet" onClick={closeKit}>
              Close
            </Button>
          </div>
        )}
        {kitFor && <KitCheck game={game} characters={kitFor.members.map((id) => data.byId.get(id)).filter((x): x is Character => Boolean(x))} />}
      </BottomSheet>

      <BottomSheet open={editing !== null} side title={editing === 'new' ? 'New team' : 'Edit team'} onClose={closeEditor}>
        {editing !== null && (
          <TeamEditor
            key={editing === 'new' ? 'new' : editing.id}
            game={game}
            data={data}
            team={editing === 'new' ? null : editing}
            onDone={closeEditor}
            openCharacters={() => {
              setEditing(null);
              openCharacters();
            }}
          />
        )}
      </BottomSheet>
    </div>
  );
}

function PresetCard({
  preset,
  example,
  nameOf,
  stateOf,
  onOpen,
  onKit,
}: {
  preset: TeamPreset;
  example: boolean;
  nameOf: (id: string | null) => string;
  stateOf: (id: string) => 'owned' | 'wanted' | 'gap';
  onOpen: (id: string) => void;
  onKit: () => void;
}) {
  return (
    <article className={r.card}>
      <div className={r.cardHead}>
        <div>
          <h4 className={r.cardTitle}>
            {preset.name} {example && <ExampleTag />}
          </h4>
          {!example && <span className={r.muted}>Source: {preset.source}</span>}
        </div>
      </div>
      <div className={r.scoreSlot} aria-label="Fit with your roster">
        <span className={r.label}>FIT WITH YOUR ROSTER</span>
        <NoData />
      </div>
      <ol className={r.slots}>
        {preset.slots.map((slot, i) => {
          const [first, ...others] = slot.characters;
          return (
            <li key={i} className={r.slot}>
              <span className={r.slotNo}>{i + 1}</span>
              {first ? (
                <button type="button" className={r.chipButton} onClick={() => onOpen(first)}>
                  <WhoChip name={nameOf(first)} status={stateOf(first)} />
                </button>
              ) : (
                <span className={r.muted}>Nobody listed</span>
              )}
              {others.length > 0 && <span className={r.slotAlt}>or {others.map(nameOf).join(', ')}</span>}
            </li>
          );
        })}
      </ol>
      <div className={r.cardActions}>
        <Button onClick={onKit}>Kit check</Button>
      </div>
    </article>
  );
}

function TeamEditor({ game, data, team, onDone, openCharacters }: { game: GameContract; data: RosterData; team: UserTeam | null; onDone: () => void; openCharacters: () => void }) {
  const [name, setName] = useState(team?.name ?? `Team ${data.user.teams.length + 1}`);
  const [members, setMembers] = useState<string[]>(team?.members ?? []);
  const [query, setQuery] = useState('');
  const owned = data.characters.filter((c) => entryOf(data.user.roster, c.id).owned || members.includes(c.id)).sort(byNewest);
  const q = query.trim().toLowerCase();
  const shown = owned.filter((c) => !q || c.name.toLowerCase().includes(q));
  const full = members.length >= data.teamSize;

  const toggle = (id: string) => setMembers((m) => (m.includes(id) ? m.filter((x) => x !== id) : m.length >= data.teamSize ? m : [...m, id]));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!members.length || !name.trim()) return;
    saveTeam(game.id, { id: team?.id ?? `team-${Date.now().toString(36)}`, name: name.trim(), members });
    onDone();
  };

  if (owned.length === 0) {
    return (
      <div className={r.stack}>
        <p className={r.muted}>Teams are made from the {game.terms.character.toLowerCase()}s you own. Mark them as owned in Characters first.</p>
        <Button variant="primary" onClick={openCharacters}>
          Go to Characters
        </Button>
      </div>
    );
  }
  return (
    <form className={r.stack} onSubmit={submit}>
      <label className={r.field}>
        Team name
        <input className={r.input} value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <p className={r.summary}>
        <span>
          Picked <strong>{members.length}</strong> of {data.teamSize}
        </span>
        {members.length > 0 && <span className={r.muted}>{members.map((id) => data.byId.get(id)?.name ?? id).join(', ')}</span>}
      </p>
      <label className={r.field}>
        Search
        <input className={r.input} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`${game.terms.character} name`} />
      </label>
      <ul className={r.pickList} aria-label="Your characters">
        {shown.map((c) => {
          const on = members.includes(c.id);
          return (
            <li key={c.id}>
              <button type="button" className={r.pick} aria-pressed={on} disabled={!on && full} onClick={() => toggle(c.id)}>
                <span className={r.pickMark} aria-hidden="true">
                  {on ? '✓' : ''}
                </span>
                {c.name}
              </button>
            </li>
          );
        })}
      </ul>
      <div className={r.cardActions}>
        <Button type="submit" variant="primary" disabled={!members.length}>
          Save team
        </Button>
        <Button onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}
