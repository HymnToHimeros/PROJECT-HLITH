import { useCallback, useState, type FormEvent, type ReactNode } from 'react';
import type { Character, TeamPreset } from '../../core/contract';
import { saveTeam, type UserTeam } from '../../core/data/userData';
import { BottomSheet, Button, ExampleNotice, ExampleTag, GameTag, HowTo, NoData } from '../../core/ui';
import { exampleScore } from './examples';
import { KitCheck } from './KitCheck';
import r from './roster.module.css';
import { artOf, byNewest, CharArt, elementOf, entryOf, SectionHead, tagOf } from './shared';
import { Member, Score } from './TeamParts';
import type { RosterData } from './useRosterData';

interface Props {
  data: RosterData[];
  several: boolean;
  onOpen: (game: string, id: string) => void;
  openCharacters: () => void;
}

/*
 * Interface only. Logic is filled by the ROSTER-LOGIC workstream: scoring
 * presets against your roster (owned / wanted / gaps), who fills which slot,
 * team ideas from what you own, "if you pull" and the endgame record. Until
 * then real teams show "No data yet" in the score spot, and example teams
 * show example numbers next to an EXAMPLE badge.
 */

const firsts = (p: TeamPreset) => p.slots.map((s) => s.characters[0]).filter((x): x is string => Boolean(x));

/** Roster → Teams (design): preset cards with portraits and a score, your own presets, ideas and Kit check. */
export function Teams({ data, several, onOpen, openCharacters }: Props) {
  const [kitFor, setKitFor] = useState<{ data: RosterData; name: string; members: string[] } | null>(null);
  const [editing, setEditing] = useState<{ data: RosterData; team: UserTeam | null } | null>(null);
  const closeKit = useCallback(() => setKitFor(null), []);
  const closeEditor = useCallback(() => setEditing(null), []);
  const anyExample = data.some((d) => d.presets.example && d.presets.list.length > 0);
  const ownsAnyone = data.some((d) => Object.values(d.user.roster).some((e) => e.owned));
  const mine = data.flatMap((d) => d.user.teams.map((t) => ({ d, t })));
  const recommended = data.flatMap((d) => d.presets.list.map((p, i) => ({ d, p, i })));
  const first = data[0];
  const word = several ? 'character' : (first?.game.terms.character.toLowerCase() ?? 'character');
  const size = [...new Set(data.map((d) => d.teamSize))].join(' or ');

  return (
    <div className={r.stack}>
      <HowTo
        steps={[
          <>A preset is a team you play: up to {size} {word}s. Press <strong>New preset</strong>, name it and pick {word}s you own.</>,
          <>Recommended teams list who fits each place, best first, and whether you own them.</>,
          <>The number on each team is how well it fits your roster. It fills in once team scoring is added; until then it says “No data yet” (example teams show an example number).</>,
          <><strong>Kit check</strong> on any team shows what each member’s skills really do, with the game’s own text as proof.</>,
          <>Mark who you own in Characters first: that is what every team here is checked against.</>,
        ]}
      />

      {anyExample && (
        <ExampleNotice actions={ownsAnyone ? [] : [{ label: 'Mark who I own', onClick: openCharacters }]}>
          The recommended teams, their numbers and the ideas below are examples built from the {word} list, not advice. Real recommended teams and scoring still have to be added by us. Your roster and your own presets are always yours.
        </ExampleNotice>
      )}

      <section className={r.stack} aria-labelledby="your-presets">
        <SectionHead title="Your presets" id="your-presets" note={`Teams you made · up to ${size} each`}>
          {first && (
            <Button variant="primary" onClick={() => setEditing({ data: first, team: null })}>
              New preset
            </Button>
          )}
        </SectionHead>
        {mine.length === 0 ? (
          <div className={r.emptyCard}>
            <span className={r.label}>NO DATA YET</span>
            <span className={r.emptyTitle}>No team presets yet</span>
            <span className={r.cardText}>Build a team from your roster and HLITH scores it against recommended teams.</span>
          </div>
        ) : (
          <div className={r.teamGrid}>
            {mine.map(({ d, t }) => (
              <TeamCard
                key={`${d.game.id}:${t.id}`}
                data={d}
                several={several}
                name={t.name}
                members={t.members}
                example={false}
                score={null}
                onOpen={(id) => onOpen(d.game.id, id)}
                actions={
                  <>
                    <Button onClick={() => setKitFor({ data: d, name: t.name, members: t.members })}>Kit check</Button>
                    <Button onClick={() => setEditing({ data: d, team: t })}>Edit</Button>
                    {/* ShareTeam mounts here (connections builder: copy as text, save a picture). */}
                  </>
                }
              />
            ))}
          </div>
        )}
      </section>

      <section className={r.stack} aria-labelledby="recommended-teams">
        <SectionHead title="Recommended teams" id="recommended-teams" note="Each place lists who fits it, best first, with whether you own them." />
        {recommended.length === 0 ? (
          <p className={r.muted}>No recommended teams yet.</p>
        ) : (
          <div className={r.teamGrid}>
            {recommended.map(({ d, p, i }) => (
              <TeamCard
                key={`${d.game.id}:${p.id}`}
                data={d}
                several={several}
                name={p.name}
                members={firsts(p)}
                preset={p}
                example={d.presets.example}
                score={d.presets.example ? exampleScore(i) : null}
                onOpen={(id) => onOpen(d.game.id, id)}
                actions={<Button onClick={() => setKitFor({ data: d, name: p.name, members: firsts(p) })}>Kit check</Button>}
              />
            ))}
          </div>
        )}
      </section>

      <section className={r.stack} aria-labelledby="team-ideas">
        <SectionHead title="Ideas from your roster" id="team-ideas" />
        <div className={r.cards}>
          {data.map((d) => (
            <Ideas key={d.game.id} data={d} several={several} />
          ))}
        </div>
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
        {kitFor && <KitCheck game={kitFor.data.game} title={false} characters={kitFor.members.map((id) => kitFor.data.byId.get(id)).filter((x): x is Character => Boolean(x))} />}
      </BottomSheet>

      <BottomSheet open={editing !== null} side title={editing?.team ? 'Edit preset' : 'New preset'} onClose={closeEditor}>
        {editing !== null && (
          <TeamEditor
            key={editing.team ? editing.team.id : `new-${editing.data.game.id}`}
            all={data}
            data={editing.data}
            team={editing.team}
            onGame={(d) => setEditing({ data: d, team: null })}
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

function TeamCard({
  data,
  several,
  name,
  members,
  preset,
  example,
  score,
  onOpen,
  actions,
}: {
  data: RosterData;
  several: boolean;
  name: string;
  members: string[];
  preset?: TeamPreset;
  example: boolean;
  score: number | null;
  onOpen: (id: string) => void;
  actions: ReactNode;
}) {
  const tag = tagOf(data.game, several);
  const nameOf = (id: string) => data.byId.get(id)?.name ?? id;
  return (
    <article className={r.teamCard} aria-label={name}>
      <div className={r.teamTop}>
        <div className={r.teamMain}>
          <h4 className={r.teamName}>
            <span>{name}</span>
            {example && <ExampleTag />}
            {tag && <GameTag {...tag} />}
          </h4>
          <div className={r.members}>
            {members.map((id) => (
              <Member key={id} data={data} id={id} example={example} showName onOpen={onOpen} />
            ))}
          </div>
        </div>
        <Score score={score} example={example} big />
      </div>
      {preset && preset.slots.some((s) => s.characters.length > 1) && (
        <ol className={r.alts} aria-label="Who else fits">
          {preset.slots.map((s, i) =>
            s.characters.length > 1 ? (
              <li key={i}>
                <span className={r.altNo}>{i + 1}</span>
                <span className={r.muted}>or {s.characters.slice(1).map(nameOf).join(', ')}</span>
              </li>
            ) : null,
          )}
        </ol>
      )}
      {preset && !example && <span className={r.muted}>Source: {preset.source}</span>}
      <div className={r.cardActions}>{actions}</div>
    </article>
  );
}

/** Team ideas, "if you pull" and the endgame record: ROSTER-LOGIC and the HoYoLAB link fill these. Example rows until then. */
function Ideas({ data, several }: { data: RosterData; several: boolean }) {
  const { game, presets } = data;
  const tag = tagOf(game, several);
  const ex = presets.example ? presets.list : [];
  const wantedId = Object.entries(data.user.roster).find(([, e]) => e.wanted && !e.owned)?.[0];
  const pullName = (wantedId && data.byId.get(wantedId)?.name) ?? ex[0]?.name.replace(/ team$/, '');
  const head = (title: string) => (
    <div className={r.cardHead}>
      <h4 className={r.cardTitle}>{title}</h4>
      {tag && <GameTag {...tag} />}
    </div>
  );
  return (
    <>
      <section className={r.card} aria-label={`Teams you can build${several ? ` · ${game.short}` : ''}`}>
        {head('Teams you can build')}
        <span className={r.cardText}>Real recommended teams made only of {game.terms.character.toLowerCase()}s you own. Tap one to make it a preset.</span>
        {/* ROSTER-LOGIC: who fits each place, from your owned characters. */}
        {ex.length ? (
          ex.slice(0, 2).map((p, i) => (
            <div key={p.id} className={r.ideaRow}>
              <span className={r.lineLabel}>{p.name}</span>
              <span className={r.ideaState}>{i === 0 ? 'Ready to play' : 'One character away'}</span>
              <ExampleTag />
            </div>
          ))
        ) : (
          <NoData />
        )}
      </section>
      <section className={r.card} aria-label={`If you pull${several ? ` · ${game.short}` : ''}`}>
        {head('If you pull…')}
        <span className={r.cardText}>Characters you’re saving for, checked against your roster: the best team they make, and which of your presets they make better.</span>
        {ex.length && pullName ? (
          <div className={r.ideaRow}>
            <span className={r.lineLabel}>{pullName}</span>
            <span className={r.ideaState}>makes {ex[1]?.name ?? ex[0]?.name} better</span>
            <ExampleTag />
          </div>
        ) : (
          <NoData />
        )}
      </section>
      <section className={r.card} aria-label={`Endgame record${several ? ` · ${game.short}` : ''}`}>
        {head('Endgame record')}
        <span className={r.cardText}>The teams you used in {game.terms.endgame.slice(0, 2).join(' and ') || 'endgame'}, read from your HoYoLAB profile. A team that matches a preset shows its name.</span>
        {/* Endgame import mounts here (account-links builder: HoYoLAB link). */}
        {ex[0] ? (
          <div className={r.ideaRow}>
            <span className={r.lineLabel}>{game.terms.endgame[0] ?? 'Endgame'}</span>
            <span className={r.ideaState}>{ex[0].name}</span>
            <ExampleTag />
          </div>
        ) : (
          <NoData />
        )}
        <span className={r.muted}>Link HoYoLAB in Account to import it.</span>
      </section>
    </>
  );
}

function TeamEditor({
  all,
  data,
  team,
  onGame,
  onDone,
  openCharacters,
}: {
  all: RosterData[];
  data: RosterData;
  team: UserTeam | null;
  onGame: (d: RosterData) => void;
  onDone: () => void;
  openCharacters: () => void;
}) {
  const { game } = data;
  const [name, setName] = useState(team?.name ?? `Team ${data.user.teams.length + 1}`);
  const [members, setMembers] = useState<string[]>(team?.members ?? []);
  const [query, setQuery] = useState('');
  const owned = data.characters.filter((c) => entryOf(data.user.roster, c.id).owned || members.includes(c.id)).sort(byNewest);
  const q = query.trim().toLowerCase();
  const shown = owned.filter((c) => !q || c.name.toLowerCase().includes(q));
  const full = members.length >= data.teamSize;
  const word = game.terms.character.toLowerCase();

  const toggle = (id: string) => setMembers((m) => (m.includes(id) ? m.filter((x) => x !== id) : m.length >= data.teamSize ? m : [...m, id]));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!members.length || !name.trim()) return;
    saveTeam(game.id, { id: team?.id ?? `team-${Date.now().toString(36)}`, name: name.trim(), members });
    onDone();
  };

  const gamePicker = !team && all.length > 1 && (
    <label className={r.field}>
      <span className={r.fieldLabel}>Game</span>
      <select className={r.input} value={game.id} onChange={(e) => onGame(all.find((d) => d.game.id === e.target.value) ?? data)}>
        {all.map((d) => (
          <option key={d.game.id} value={d.game.id}>
            {d.game.name}
          </option>
        ))}
      </select>
    </label>
  );

  if (owned.length === 0) {
    return (
      <div className={r.stack}>
        {gamePicker}
        <p className={r.muted}>Presets are made from the {word}s you own. Mark them as owned in Characters first.</p>
        <Button variant="primary" onClick={openCharacters}>
          Go to Characters
        </Button>
      </div>
    );
  }
  return (
    <form className={r.stack} onSubmit={submit}>
      {gamePicker}
      <label className={r.field}>
        <span className={r.fieldLabel}>Preset name</span>
        <input className={r.input} value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <p className={r.summary}>
        <span>
          Picked <strong>{members.length}</strong> of {data.teamSize}
        </span>
        {members.length > 0 && <span className={r.muted}>{members.map((id) => data.byId.get(id)?.name ?? id).join(', ')}</span>}
      </p>
      <label className={r.field}>
        <span className={r.fieldLabel}>Search</span>
        <input className={r.input} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`${game.terms.character} name`} />
      </label>
      <ul className={r.pickList} aria-label="Your characters">
        {shown.map((c) => {
          const on = members.includes(c.id);
          const el = elementOf(game, c.element);
          return (
            <li key={c.id}>
              <button type="button" className={r.pick} aria-pressed={on} aria-label={c.name} disabled={!on && full} onClick={() => toggle(c.id)}>
                <CharArt name={c.name} src={artOf(c, 'portrait')} elementColor={el?.color ?? 'var(--ink-4)'} className={r.memberArtSm} />
                <span className={r.grow}>{c.name}</span>
                <span className={r.pickMark} aria-hidden="true">
                  {on ? '✓' : ''}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className={r.cardActions}>
        <Button type="submit" variant="primary" disabled={!members.length}>
          Save preset
        </Button>
        <Button onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}
