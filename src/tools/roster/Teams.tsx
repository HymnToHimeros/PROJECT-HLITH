import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import type { Character, TeamPreset } from '../../core/contract';
import { deleteTeam, saveTeam, type UserTeam } from '../../core/data/userData';
import { BottomSheet, Button, ExampleNotice, ExampleTag, GameTag, HowTo, NoData } from '../../core/ui';
import { exampleScore } from './examples';
import { ShareTeam } from '../share/ShareTeam';
import { KitCheck } from './KitCheck';
import r from './roster.module.css';
import { artOf, byNewest, CharArt, elementOf, entryOf, SectionHead, tagOf } from './shared';
import { Member, Score, teamAccount, useVerdict, WhyScore } from './TeamParts';
import type { RosterData } from './useRosterData';

/** A preset to start the editor with (copied from a recommended team, or from a character page). */
export interface PresetDraft {
  game: string;
  name?: string;
  members: string[];
}

interface Props {
  data: RosterData[];
  several: boolean;
  onOpen: (game: string, id: string) => void;
  openCharacters: () => void;
  /** Open Account (to link HoYoLAB). */
  openAccount?: (() => void) | undefined;
  /** Open the preset editor pre-filled, once, when Teams appears. */
  draft?: PresetDraft | null | undefined;
  onDraftUsed?: (() => void) | undefined;
}

interface Editing {
  data: RosterData;
  team: UserTeam | null;
  draft?: { name?: string | undefined; members: string[] } | undefined;
}

/*
 * Interface only. Logic is filled by the ROSTER-LOGIC workstream: scoring
 * presets against your roster (owned / wanted / gaps), who fills which slot,
 * team ideas from what you own, "if you pull" and the endgame record. Until
 * then real teams show "No data yet" in the score spot, and example teams
 * show example numbers next to an EXAMPLE badge.
 */

/** Recommended teams shown at first, and how many more each "Show more" adds: the rest stay one tap away. */
const TEAMS_FIRST = 6;
const TEAMS_MORE = 12;

const firsts = (p: TeamPreset) => p.slots.map((s) => s.characters[0]).filter((x): x is string => Boolean(x));
/** A game team as you'd field it: per slot, the first listed character you own (the game's team rules); else each slot's first pick. */
const membersOf = (d: RosterData, p: TeamPreset) => (d.presets.example ? firsts(p) : (d.game.rules.teams?.fill?.(p, teamAccount(d)) ?? firsts(p)));

/** Roster → Teams (design): preset cards with portraits and a score, your own presets, ideas and Kit check. */
export function Teams({ data, several, onOpen, openCharacters, openAccount, draft, onDraftUsed }: Props) {
  const [kitFor, setKitFor] = useState<{ data: RosterData; name: string; members: string[] } | null>(null);
  const [editing, setEditing] = useState<Editing | null>(() => {
    const d = draft && data.find((x) => x.game.id === draft.game);
    return d && draft ? { data: d, team: null, draft: { name: draft.name, members: draft.members } } : null;
  });
  // The draft is used once; clear it so coming back to Teams doesn't open the editor again.
  useEffect(() => {
    if (draft) onDraftUsed?.();
  }, [draft, onDraftUsed]);
  const [removed, setRemoved] = useState<{ game: string; team: UserTeam } | null>(null);
  const closeKit = useCallback(() => setKitFor(null), []);
  const closeEditor = useCallback(() => setEditing(null), []);
  const copyPreset = (d: RosterData, p: TeamPreset) => setEditing({ data: d, team: null, draft: { name: p.name, members: membersOf(d, p) } });
  const anyExample = data.some((d) => d.presets.example && d.presets.list.length > 0);
  const ownsAnyone = data.some((d) => Object.values(d.user.roster).some((e) => e.owned));
  const mine = data.flatMap((d) => d.user.teams.map((t) => ({ d, t })));
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(TEAMS_FIRST);
  const allRecommended = data.flatMap((d) => d.presets.list.map((p, i) => ({ d, p, i, members: membersOf(d, p), missing: missingFrom(d, membersOf(d, p)) })));
  // Ready-to-play teams first, then the fewest missing; the game's own order inside each.
  const q = query.trim().toLowerCase();
  const matching = allRecommended
    .filter(({ d, p }) => !q || p.name.toLowerCase().includes(q) || p.slots.some((sl) => sl.characters.some((id) => (d.byId.get(id)?.name ?? '').toLowerCase().includes(q))))
    .sort((a, b) => a.missing - b.missing);
  const recommended = matching.slice(0, shown);
  const first = data[0];
  const word = several ? 'character' : (first?.game.terms.character.toLowerCase() ?? 'character');
  const size = [...new Set(data.map((d) => d.teamSize))].join(' or ');

  return (
    <div className={r.stack}>
      {anyExample && (
        <ExampleNotice actions={ownsAnyone ? [] : [{ label: 'Mark who I own', onClick: openCharacters }]}>
          The recommended teams, their numbers and the ideas below are examples built from the {word} list, not advice. Real recommended teams and scoring still have to be added by us. Your roster and your own presets are always yours.
        </ExampleNotice>
      )}

      <section className={r.stack} aria-labelledby="recommended-teams">
        <SectionHead title="Recommended teams" id="recommended-teams" note="Each place lists who fits it, best first, with whether you own them.">
          <span className={r.howSmall}>
            <HowTo
              steps={[
                <>A preset is a team you play: up to {size} {word}s. Press <strong>New preset</strong> (or <strong>Save as my preset</strong> on a recommended team), name it and pick who’s in it. Your owned {word}s come first; you can add anyone.</>,
                <>Recommended teams list who fits each place, best first, and whether you own them.</>,
                <>The number on each team is how well it fits your roster. It fills in once team scoring is added; until then it says “No data yet” (example teams show an example number).</>,
                <><strong>Kit check</strong> on any team shows what each member’s skills really do, with the game’s own text as proof.</>,
                <>Mark who you own in Characters first: that is what every team here is checked against.</>,
              ]}
            />
          </span>
        </SectionHead>
        {allRecommended.length > TEAMS_FIRST && (
          <div className={r.teamFilter}>
            <label className={`${r.field} ${r.searchField}`}>
              <span className={r.fieldLabel}>Find a team</span>
              <input
                className={r.input}
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShown(TEAMS_FIRST);
                }}
                placeholder={`Team or ${word} name`}
              />
            </label>
            <span className={r.muted} aria-live="polite">
              {q ? `${matching.length} of ${allRecommended.length} teams` : `${allRecommended.length} teams`} · ready to play first
            </span>
          </div>
        )}
        {allRecommended.length === 0 ? (
          <p className={r.muted}>No recommended teams yet.</p>
        ) : matching.length === 0 ? (
          <p className={r.muted}>No recommended team has “{query}” in it.</p>
        ) : (
          <div className={r.teamGrid}>
            {recommended.map(({ d, p, i, members }) => (
              <TeamCard
                key={`${d.game.id}:${p.id}`}
                data={d}
                several={several}
                name={p.name}
                members={members}
                preset={p}
                example={d.presets.example}
                score={d.presets.example ? exampleScore(i) : null}
                onOpen={(id) => onOpen(d.game.id, id)}
                actions={
                  <>
                    <Button onClick={() => setKitFor({ data: d, name: p.name, members })}>Kit check</Button>
                    <Button onClick={() => copyPreset(d, p)}>Save as my preset</Button>
                  </>
                }
              />
            ))}
          </div>
        )}
        {matching.length > recommended.length && (
          <Button onClick={() => setShown((n) => n + TEAMS_MORE)}>
            Show {Math.min(TEAMS_MORE, matching.length - recommended.length)} more ({matching.length - recommended.length} hidden)
          </Button>
        )}
      </section>

      <section className={r.stack} aria-labelledby="your-presets">
        <SectionHead title="Your presets" id="your-presets" note={`Teams you made · up to ${size} each`}>
          {first && (
            <Button variant="primary" onClick={() => setEditing({ data: first, team: null })}>
              New preset
            </Button>
          )}
        </SectionHead>
        {removed && (
          <p className={r.undoRow} role="status">
            <span className={r.grow}>Deleted “{removed.team.name}”.</span>
            <Button
              onClick={() => {
                saveTeam(removed.game, removed.team);
                setRemoved(null);
              }}
            >
              Undo
            </Button>
          </p>
        )}
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
                    <ShareTeam game={d.game} team={t} />
                  </>
                }
              />
            ))}
          </div>
        )}
      </section>

      <details className={r.fold}>
        <summary className={r.foldSummary}>
          Ideas from your roster <span className={r.foldNote}>teams you can build, if you pull, endgame record</span>
        </summary>
        <div className={r.foldBody}>
          <div className={r.cards}>
            {data.map((d) => (
              <Ideas key={d.game.id} data={d} several={several} onPick={(p) => copyPreset(d, p)} openAccount={openAccount} />
            ))}
          </div>
        </div>
      </details>

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
            draft={editing.draft}
            onGame={(d) => setEditing({ data: d, team: null })}
            onDone={closeEditor}
            onDelete={(team) => {
              const gone = deleteTeam(editing.data.game.id, team.id);
              if (gone) setRemoved({ game: editing.data.game.id, team: gone });
              setEditing(null);
            }}
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
  const verdict = useVerdict(data, members, example);
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
        <Score score={score} example={example} big verdict={verdict} />
      </div>
      {!example && <WhyScore verdict={verdict} data={data} />}
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

/** How many of a team's first picks you don't own yet (checked against your real roster). */
const missingFrom = (data: RosterData, members: string[]) => members.filter((id) => !entryOf(data.user.roster, id).owned).length;

const readiness = (missing: number, word: string) => (missing === 0 ? 'Ready to play' : missing === 1 ? `One ${word} away` : `${missing} ${word}s away`);

/**
 * Who "If you pull" talks about: a character you want and don't own, else one you
 * don't own from the teams shown. Never someone you own, and never "X makes X's own team better".
 */
function pullIdea(data: RosterData, teams: TeamPreset[]): { id: string; line: string } | null {
  const notOwned = (id: string) => !entryOf(data.user.roster, id).owned;
  const wanted = new Set(
    Object.entries(data.user.roster)
      .filter(([, e]) => e.wanted && !e.owned)
      .map(([id]) => id),
  );
  const inTeams = teams.flatMap((p) => p.slots.flatMap((s, i) => s.characters.map((id) => ({ id, p, lead: i === 0 }))));
  const pick = inTeams.find((x) => wanted.has(x.id) && !x.lead) ?? inTeams.find((x) => wanted.has(x.id)) ?? inTeams.find((x) => notOwned(x.id) && !x.lead);
  if (!pick) return null;
  return { id: pick.id, line: pick.lead ? `leads ${pick.p.name}` : `fits ${pick.p.name}` };
}

/** Team ideas and "if you pull" come from the game's team rules (LOGIC-CORE) where it has them; the endgame record from the HoYoLAB link. Example rows otherwise, always true to your roster. */
function Ideas({ data, several, onPick, openAccount }: { data: RosterData; several: boolean; onPick: (p: TeamPreset) => void; openAccount?: (() => void) | undefined }) {
  const { game, presets } = data;
  const tag = tagOf(game, several);
  const ex = presets.example ? presets.list : [];
  const ranked = ex.map((p) => ({ p, missing: missingFrom(data, firsts(p)) })).sort((a, b) => a.missing - b.missing);
  const pull = pullIdea(data, ex);
  const pullName = pull ? (data.byId.get(pull.id)?.name ?? pull.id) : null;
  const ready = ranked.find((x) => x.missing === 0)?.p;
  const head = (title: string) => (
    <div className={r.cardHead}>
      <h4 className={r.cardTitle}>{title}</h4>
      {tag && <GameTag {...tag} />}
    </div>
  );
  const rules = game.rules.teams;
  return (
    <>
      {rules ? (
        <RatedIdeas data={data} several={several} head={head} onPick={(members) => onPick({ id: 'line-up', name: `${members.map((id) => data.byId.get(id)?.name ?? id)[0] ?? ''} team`, slots: members.map((id) => ({ characters: [id] })), source: rules.method })} />
      ) : (
        <ExampleIdeas data={data} several={several} head={head} ranked={ranked} pull={pull} pullName={pullName} onPick={onPick} />
      )}
      <EndgameRecord data={data} several={several} head={head} ready={ready} openAccount={openAccount} />
    </>
  );
}

/** Line-ups and "If you pull…" from the game's team rules: real, explained, from your roster. */
function RatedIdeas({ data, several, head, onPick }: { data: RosterData; several: boolean; head: (t: string) => ReactNode; onPick: (members: string[]) => void }) {
  const { game } = data;
  const rules = game.rules.teams;
  const word = game.terms.character.toLowerCase();
  const name = (id: string) => data.byId.get(id)?.name ?? id;
  const roster = data.user.roster;
  const ideas = useMemo(() => (rules ? rules.lineUps(teamAccount(data)) : []), [rules, roster]); // eslint-disable-line react-hooks/exhaustive-deps
  const pulls = useMemo(() => {
    if (!rules) return [];
    const account = teamAccount(data);
    const notOwned = data.characters.filter((c) => !entryOf(roster, c.id).owned && rules.rated(c.id));
    const wanted = notOwned.filter((c) => entryOf(roster, c.id).wanted);
    return (wanted.length ? wanted : notOwned)
      .map((c) => ({ c, v: rules.ifYouPull(c.id, account) }))
      .filter((x): x is { c: Character; v: NonNullable<typeof x.v> } => x.v !== null)
      .sort((a, b) => b.v.percent - a.v.percent)
      .slice(0, 3);
  }, [rules, roster]); // eslint-disable-line react-hooks/exhaustive-deps
  const rated = data.characters.filter((c) => rules?.rated(c.id)).length;
  const coverage = `Only ${word}s whose kits have been read count: ${rated} of ${data.characters.length} so far.`;
  return (
    <>
      <section className={r.card} aria-label={`Teams you can build${several ? ` · ${game.short}` : ''}`}>
        {head('Teams you can build')}
        <span className={r.cardText}>Your best teams from the {word}s you own, no {word} twice, checked kit by kit. Tap one to make it a preset.</span>
        {ideas.length ? (
          ideas.map((t) => (
            <button key={t.members.join()} type="button" className={`${r.ideaRow} ${r.ideaBtn}`} onClick={() => onPick(t.members)} aria-label={`${t.members.map(name).join(', ')}: count ${t.count}. Make it a preset`} title={t.why}>
              <span className={r.lineLabel}>{t.members.map(name).join(' > ')}</span>
              <span className={r.ideaState}>count {t.count}</span>
            </button>
          ))
        ) : (
          <NoData />
        )}
        <span className={r.muted}>{coverage}</span>
      </section>
      <section className={r.card} aria-label={`If you pull${several ? ` · ${game.short}` : ''}`}>
        {head('If you pull…')}
        <span className={r.cardText}>What {/^[aeiou]/i.test(word) ? 'an' : 'a'} {word} you don’t own would add to your teams, tested at no extra copies. 0% means no gain.</span>
        {pulls.length ? (
          pulls.map(({ c, v }) => (
            <details key={c.id} className={r.why}>
              <summary className={r.whySummary}>
                <span className={r.lineLabel}>{c.name}</span>&nbsp;<span className={r.ideaState}>{v.percent ? `${v.percent}%` : 'No gain'}</span>
              </summary>
              <ul className={r.whyList}>
                {v.why.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </details>
          ))
        ) : (
          <NoData />
        )}
        <span className={r.muted}>{coverage}</span>
      </section>
    </>
  );
}

function ExampleIdeas({
  data,
  several,
  head,
  ranked,
  pull,
  pullName,
  onPick,
}: {
  data: RosterData;
  several: boolean;
  head: (t: string) => ReactNode;
  ranked: { p: TeamPreset; missing: number }[];
  pull: { id: string; line: string } | null;
  pullName: string | null;
  onPick: (p: TeamPreset) => void;
}) {
  const { game } = data;
  const word = game.terms.character.toLowerCase();
  return (
    <>
      <section className={r.card} aria-label={`Teams you can build${several ? ` · ${game.short}` : ''}`}>
        {head('Teams you can build')}
        <span className={r.cardText}>Recommended teams checked against the {word}s you own. Tap one to make it a preset.</span>
        {/* ROSTER-LOGIC: who fits each place, from your owned characters. */}
        {ranked.length ? (
          ranked.slice(0, 3).map(({ p, missing }) => (
            <button key={p.id} type="button" className={`${r.ideaRow} ${r.ideaBtn}`} onClick={() => onPick(p)} aria-label={`${p.name}: ${readiness(missing, word)}. Make it a preset`}>
              <span className={r.lineLabel}>{p.name}</span>
              <span className={r.ideaState}>{readiness(missing, word)}</span>
              <ExampleTag />
            </button>
          ))
        ) : (
          <NoData />
        )}
      </section>
      <section className={r.card} aria-label={`If you pull${several ? ` · ${game.short}` : ''}`}>
        {head('If you pull…')}
        <span className={r.cardText}>Characters you’re saving for, checked against your roster: the best team they make, and which of your presets they make better.</span>
        {pull && pullName ? (
          <div className={r.ideaRow}>
            <span className={r.lineLabel}>{pullName}</span>
            <span className={r.ideaState}>{pull.line}</span>
            <ExampleTag />
          </div>
        ) : (
          <NoData />
        )}
      </section>
    </>
  );
}

function EndgameRecord({ data, several, head, ready, openAccount }: { data: RosterData; several: boolean; head: (t: string) => ReactNode; ready: TeamPreset | undefined; openAccount?: (() => void) | undefined }) {
  const { game } = data;
  return (
    <>
      <section className={r.card} aria-label={`Endgame record${several ? ` · ${game.short}` : ''}`}>
        {head('Endgame record')}
        <span className={r.cardText}>The teams you used in {game.terms.endgame.slice(0, 2).join(' and ') || 'endgame'}, read from your HoYoLAB profile. A team that matches a preset shows its name.</span>
        {/* Endgame import mounts here (account-links builder: HoYoLAB link). The example only names a team you could really field. */}
        {ready ? (
          <div className={r.ideaRow}>
            <span className={r.lineLabel}>{game.terms.endgame[0] ?? 'Endgame'}</span>
            <span className={r.ideaState}>{ready.name}</span>
            <ExampleTag />
          </div>
        ) : (
          <NoData />
        )}
        {openAccount ? (
          <button type="button" className={r.linkButton} onClick={openAccount}>
            Link HoYoLAB in Account to import it →
          </button>
        ) : (
          <span className={r.muted}>Link HoYoLAB in Account to import it.</span>
        )}
      </section>
    </>
  );
}

function TeamEditor({
  all,
  data,
  team,
  draft,
  onGame,
  onDone,
  onDelete,
  openCharacters,
}: {
  all: RosterData[];
  data: RosterData;
  team: UserTeam | null;
  draft?: { name?: string | undefined; members: string[] } | undefined;
  onGame: (d: RosterData) => void;
  onDone: () => void;
  onDelete: (team: UserTeam) => void;
  openCharacters: () => void;
}) {
  const { game } = data;
  const [name, setName] = useState(team?.name ?? draft?.name ?? `Team ${data.user.teams.length + 1}`);
  const [members, setMembers] = useState<string[]>(team?.members ?? draft?.members.slice(0, data.teamSize) ?? []);
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  // 0 owned, 1 wanted (not owned), 2 everyone else.
  const rank = (id: string) => {
    const e = entryOf(data.user.roster, id);
    return e.owned ? 0 : e.wanted ? 1 : 2;
  };
  // Owned first, then wanted, then everyone else. A preset may include anyone, owned or not.
  const sorted = [...data.characters].sort((a, b) => rank(a.id) - rank(b.id) || byNewest(a, b));
  const ownsAnyone = sorted.some((c) => rank(c.id) === 0);
  const q = query.trim().toLowerCase();
  const shown = sorted.filter((c) => (q ? c.name.toLowerCase().includes(q) : showAll || rank(c.id) < 2 || members.includes(c.id)));
  const hidden = q ? 0 : sorted.length - shown.length;
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
      {!ownsAnyone && (
        <p className={r.summary}>
          <span className={r.muted}>You haven’t marked anyone as owned yet, so everyone shows as not owned. You can still pick them.</span>
          <button type="button" className={r.linkButton} onClick={openCharacters}>
            Mark who I own
          </button>
        </p>
      )}
      <label className={r.field}>
        <span className={r.fieldLabel}>Search</span>
        <input className={r.input} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`${game.terms.character} name`} />
      </label>
      <ul className={r.pickList} aria-label={`${game.terms.character}s to pick`}>
        {shown.map((c) => {
          const on = members.includes(c.id);
          const el = elementOf(game, c.element);
          const k = rank(c.id);
          const label = k === 0 ? 'owned' : k === 1 ? 'wanted · not owned' : 'not owned';
          return (
            <li key={c.id}>
              <button type="button" className={r.pick} aria-pressed={on} aria-label={`${c.name}, ${label}`} disabled={!on && full} onClick={() => toggle(c.id)}>
                <CharArt name={c.name} src={artOf(c, 'portrait')} elementColor={el?.color ?? 'var(--ink-4)'} className={r.memberArtSm} />
                <span className={r.pickText}>
                  <span>{c.name}</span>
                  <span className={r.memberState} data-status={k === 0 ? 'owned' : k === 1 ? 'wanted' : 'gap'}>
                    {label}
                  </span>
                </span>
                <span className={r.pickMark} aria-hidden="true">
                  {on ? '✓' : ''}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {shown.length === 0 && <p className={r.muted}>{q ? `No ${word} matches “${query}”.` : `No ${word}s owned or wanted yet.`}</p>}
      {hidden > 0 && (
        <button type="button" className={r.linkButton} onClick={() => setShowAll(true)}>
          Show all ({hidden} more, not owned)
        </button>
      )}
      <div className={r.cardActions}>
        <Button type="submit" variant="primary" disabled={!members.length}>
          Save preset
        </Button>
        <Button onClick={onDone}>Cancel</Button>
        {team && (
          <Button variant="quiet" onClick={() => onDelete(team)}>
            Delete preset
          </Button>
        )}
      </div>
    </form>
  );
}
