import { useEffect, useRef, useState } from 'react';
import type { Character, Material, TeamPreset } from '../../core/contract';
import { useExamplesShown } from '../../core/data/prefs';
import { setFarm, setRosterEntry } from '../../core/data/userData';
import { formatNumber } from '../../core/time/format';
import { ExampleTag, GameTag, HowTo, NoData, UnverifiedTag } from '../../core/ui';
import { exampleNeeds } from '../farm/examples';
import { farmPlan } from '../farm/plan';
import { exampleBuild, exampleScore } from './examples';
import { KitCheck } from './KitCheck';
import r from './roster.module.css';
import { artOf, CharArt, dupesLabel, elementOf, entryOf, isUpcoming, rarityColor, roleLabel } from './shared';
import { TeamRow } from './TeamParts';
import type { RosterData } from './useRosterData';

interface Props {
  data: RosterData;
  character: Character;
  several: boolean;
  onBack: () => void;
  /** Open Pulls on a tab (Planner, History). */
  openPulls?: ((tab: 'planner' | 'history') => void) | undefined;
  openFarm?: (() => void) | undefined;
  /** Open Teams with a new preset that already has this character in it. */
  makePreset?: (() => void) | undefined;
}

/*
 * Interface only for build score, team fit, materials and gear. Logic is
 * filled by the ROSTER-LOGIC workstream; until then those slots show
 * "No data yet", with an EXAMPLE preview where the design shows numbers.
 * Owned / wanted / copies / farm-for are your own data and work now.
 */

/** The character page (design): art, chips, name, Level · copies · Build score, then the cards. */
export function CharacterPage({ data, character: c, several, onBack, openPulls, openFarm, makePreset }: Props) {
  const { game, user } = data;
  const entry = entryOf(user.roster, c.id);
  const el = elementOf(game, c.element);
  const save = (change: Partial<typeof entry>) => setRosterEntry(game.id, c.id, { ...entry, ...change });
  const dupes = game.dupes;
  const farming = user.farm.includes(c.id);
  const addToFarm = () => {
    if (!farming) setFarm(game.id, [...user.farm, c.id]);
  };
  const who = game.terms.character.toLowerCase();
  const top = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (typeof window.scrollTo === 'function' && top.current && top.current.getBoundingClientRect().top < 0) window.scrollTo({ top: 0 });
  }, []);

  return (
    <article className={r.page} ref={top} aria-label={c.name}>
      <div className={r.pageBar}>
        <button type="button" className={r.backBtn} onClick={onBack}>
          ← Roster
        </button>
        {several && <GameTag label={game.short} vent={game.vent} />}
        <span className={r.grow} />
        <span className={r.howSmall}>
          <HowTo
            steps={[
              <>
                Press <strong>Owned</strong> if you have this {who}, <strong>Wanted</strong> if you’re saving for them. Press again to undo.
              </>,
              dupes ? (
                <>
                  Use − and + under {dupes.name} to set how many extra copies you have (0 to {dupes.max}).
                </>
              ) : (
                <>This game has no extra copies to track.</>
              ),
              <>
                <strong>Farm for {c.name}</strong> adds their materials to Farm, and Today then tells you what to spend stamina on.
              </>,
              <>HLITH can’t save a {who}’s level or build yet, so Level and Build score say “No data yet”, never a guess.</>,
              <>
                <strong>Kit check</strong> (further down, folded) shows what each skill really does, with the game’s own text as proof.
              </>,
            ]}
          />
        </span>
      </div>

      <div className={r.hero}>
        <CharArt name={c.name} src={artOf(c, 'art')} elementColor={el?.color ?? 'var(--ink-4)'} className={r.heroArt} label>
          <span className={r.heroEdge} style={{ background: rarityColor(c) }} aria-hidden="true" />
        </CharArt>
        <div className={r.heroInfo}>
          <div className={r.chips}>
            <span className={r.chip} style={{ color: rarityColor(c) }}>
              {game.terms.rarity[c.rarity]}
            </span>
            <span className={r.chip}>
              <span className={r.chipDot} style={{ background: el?.color ?? 'var(--ink-4)' }} aria-hidden="true" />
              {el?.label ?? c.element}
            </span>
            <span className={r.chip}>{roleLabel(game, c.role)}</span>
            <span className={r.chipVent} style={{ background: game.vent }}>
              {game.short}
            </span>
            {isUpcoming(c) && <UnverifiedTag source={c.source ?? 'game files'} />}
          </div>
          <h2 className={r.heroName}>{c.name}</h2>
          <div className={r.markRow} role="group" aria-label="Your roster">
            <button
              type="button"
              className={r.markBtn}
              aria-pressed={entry.owned}
              onClick={() =>
                // Owning someone means you're no longer saving for them.
                save(entry.owned ? { owned: false } : { owned: true, wanted: false })
              }
            >
              {entry.owned ? '✓ ' : ''}Owned
            </button>
            <button type="button" className={r.markBtn} aria-pressed={entry.wanted} onClick={() => save({ wanted: !entry.wanted })}>
              {entry.wanted ? '✓ ' : ''}Wanted
            </button>
            {game.modules.includes('farm') && (
              <button type="button" className={r.markBtn} aria-pressed={farming} onClick={() => setFarm(game.id, farming ? user.farm.filter((id) => id !== c.id) : [...user.farm, c.id])}>
                {farming ? '✓ ' : ''}Farm for {c.name}
              </button>
            )}
            {farming && openFarm && (
              <button type="button" className={r.linkButton} onClick={openFarm}>
                Open Farm →
              </button>
            )}
          </div>
          <div className={r.heroStats}>
            <div className={r.stat}>
              <span className={r.statLabel}>Level</span>
              <span className={r.statValue} data-empty="true">
                —
              </span>
              {/* ROSTER-LOGIC adds a build store; until then no level is saved anywhere. */}
              <span className={entry.owned ? r.statNoData : r.statSub}>{entry.owned ? 'No data yet · levels aren’t saved yet' : 'Not owned'}</span>
            </div>
            {dupes && (
              <div className={r.stat}>
                <span className={r.statLabel}>{dupes.name}</span>
                <div className={r.stepper} role="group" aria-label={`${dupes.name}s`}>
                  <button
                    type="button"
                    className={r.stepBtn}
                    aria-label={`One ${dupes.name} less`}
                    disabled={!entry.owned || entry.dupes <= 0}
                    onClick={() => save({ dupes: Math.max(0, entry.dupes - 1) })}
                  >
                    −
                  </button>
                  <span className={r.statValue} data-empty={!entry.owned} aria-live="polite">
                    {entry.owned ? dupesLabel(game, entry.dupes) : '—'}
                  </span>
                  <button
                    type="button"
                    className={r.stepBtn}
                    aria-label={`One ${dupes.name} more`}
                    disabled={!entry.owned || entry.dupes >= dupes.max}
                    onClick={() => save({ dupes: Math.min(dupes.max, entry.dupes + 1) })}
                  >
                    +
                  </button>
                </div>
                <span className={r.statSub}>{entry.owned ? (entry.dupes >= dupes.max ? 'Maxed' : `${dupes.max - entry.dupes} to max`) : 'Mark as owned first'}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Design order: Build score (or If you pull), Team fit, Materials. Secondary cards fold away below. */}
      <div className={r.cards}>
        {entry.owned ? <BuildCard data={data} /> : <IfYouPull data={data} openPulls={openPulls} />}
        <TeamFit data={data} character={c} makePreset={makePreset} />
        <Materials
          data={data}
          character={c}
          openFarm={
            openFarm
              ? () => {
                  addToFarm();
                  openFarm();
                }
              : undefined
          }
          farming={farming}
        />
        {isUpcoming(c) && (
          <section className={r.card} aria-labelledby={`known-${c.id}`}>
            <h3 className={r.cardTitle} id={`known-${c.id}`}>
              What’s known
            </h3>
            <p className={r.cardText}>Not released yet. Everything here is from the game files and can still change before release.</p>
            <div className={r.lineRow}>
              <span className={r.lineLabel}>Release date in the files</span>
              <span className={r.mono}>
                {c.releasedAt
                  ? new Date(c.releasedAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : '—'}
              </span>
            </div>
            <UnverifiedTag source={c.source ?? 'game files'} />
          </section>
        )}
      </div>

      <div className={r.cards}>
        <details className={r.fold}>
          <summary className={r.foldSummary}>
            Kit check <span className={r.foldNote}>what each skill really does</span>
          </summary>
          <div className={r.foldBody}>
            <section className={r.card} aria-label="Kit check">
              <KitCheck game={game} characters={[c]} title={false} />
            </section>
          </div>
        </details>
        <details className={r.fold}>
          <summary className={r.foldSummary}>
            Recommended build{' '}
            <span className={r.foldNote}>
              {game.terms.gear}, {game.terms.weapon}, stats
            </span>
          </summary>
          <div className={r.foldBody}>
            <section className={r.card} aria-label="Recommended build">
              {/* ROSTER-LOGIC fills recommended gear, weapon and stats from the build guides. */}
              {[`${game.terms.gear} sets`, game.terms.weapon, 'Main stats', `${game.terms.skill}: level first`].map((label) => (
                <div key={label} className={r.lineRow}>
                  <span className={r.lineLabel}>{label}</span>
                  <NoData dash={false} />
                </div>
              ))}
            </section>
          </div>
        </details>
      </div>
    </article>
  );
}

function BuildCard({ data }: { data: RosterData }) {
  const { game } = data;
  const ex = exampleBuild(game);
  const showExamples = useExamplesShown();
  return (
    <section className={r.card} aria-labelledby="build-score">
      <div className={r.cardHead}>
        <h3 className={r.cardTitle} id="build-score">
          Build score
        </h3>
      </div>
      {/* ROSTER-LOGIC fills the real score (game.rules.scoreBuild) from an imported build. */}
      <div className={r.noBuild}>
        <span className={r.bigDash} aria-hidden="true">
          —
        </span>
        <span className={r.noBuildTitle}>No build data yet</span>
        <span className={r.cardText}>
          HLITH can’t save builds ({game.terms.gear}, {game.terms.weapon}, level) yet, so there’s nothing to score. It shows nothing rather than a guess.
        </span>
        {/* Import build mounts here once ROSTER-LOGIC adds a build store (HoYoLAB import / screenshot scan). */}
      </div>
      {showExamples && (
        <div className={r.preview} role="group" aria-label="Example build score">
          <div className={r.previewHead}>
            <ExampleTag />
            <span className={r.muted}>What a score looks like once a build is imported</span>
          </div>
          <div className={r.scoreRow}>
            <span className={r.scoreBig}>{ex.score}</span>
            <span className={r.scoreOf}>/100</span>
            <span className={r.grade}>{ex.grade}</span>
          </div>
          {ex.parts.map((p) => (
            <div key={p.label} className={r.partRow}>
              <span className={r.lineLabel}>{p.label}</span>
              <span className={r.track} aria-hidden="true">
                <span className={r.fill} style={{ width: `${p.value}%` }} />
              </span>
              <span className={r.mono}>{p.value}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function IfYouPull({ data, openPulls }: { data: RosterData; openPulls: Props['openPulls'] }) {
  const { game } = data;
  const banner = game.bannerTypes.find((b) => b.target === 'character' && b.pity.kind === 'hard-pity');
  const worst = banner && banner.pity.kind === 'hard-pity' ? banner.pity.hardPity * (banner.pity.featured?.guaranteeAfterLoss ? 2 : 1) : null;
  return (
    <section className={r.card} aria-labelledby="if-you-pull">
      <h3 className={r.cardTitle} id="if-you-pull">
        If you pull
      </h3>
      {/* The Pulls workstream fills "pulls you hold" from the shared pull budget. */}
      <div className={r.pullRow}>
        <span className={r.pullBig} aria-hidden="true">
          —
        </span>
        <span className={r.pullOf}>{worst ? `/ ${worst} worst case` : '/ worst case: no data yet'}</span>
      </div>
      <span className={r.track} aria-hidden="true" />
      <span className={r.cardText}>Pulls you hold: no data yet. Log what you have in Pulls → Bank log and this shows whether you can get them even after a lost 50/50.</span>
      <div className={r.pityRow}>
        <span className={r.dashSmall} aria-hidden="true">
          —
        </span>
        <span className={r.grow}>Current pity and 50/50: no data yet</span>
        {openPulls && (
          <button type="button" className={r.linkButton} onClick={() => openPulls('history')}>
            Import
          </button>
        )}
      </div>
      {openPulls && (
        <button type="button" className={r.linkButton} onClick={() => openPulls('planner')}>
          Plan pulls →
        </button>
      )}
    </section>
  );
}

function TeamFit({ data, character: c, makePreset }: { data: RosterData; character: Character; makePreset?: (() => void) | undefined }) {
  const { game, user, presets } = data;
  const inPreset = (p: TeamPreset) => p.slots.some((s) => s.characters.includes(c.id));
  const recommended = presets.list.map((p, i) => ({ p, i })).filter(({ p }) => inPreset(p));
  const mine = user.teams.filter((t) => t.members.includes(c.id));
  return (
    <section className={r.card} aria-labelledby="team-fit">
      <h3 className={r.cardTitle} id="team-fit">
        Team fit
      </h3>
      {/* ROSTER-LOGIC fills "who fits" and the real synergy scores. */}
      {recommended.length === 0 && mine.length === 0 && <p className={r.cardText}>No preset uses this {game.terms.character.toLowerCase()} yet.</p>}
      {recommended.length === 0 && mine.length === 0 && makePreset && (
        <button type="button" className={r.linkButton} onClick={makePreset}>
          Make a preset with them →
        </button>
      )}
      {recommended.map(({ p, i }) => (
        <TeamRow
          key={p.id}
          data={data}
          name={p.name}
          members={p.slots.map((s) => s.characters[0]).filter((x): x is string => Boolean(x))}
          example={presets.example}
          score={presets.example ? exampleScore(i) : null}
        />
      ))}
      {mine.map((t) => (
        <TeamRow key={t.id} data={data} name={t.name} members={t.members} example={false} score={null} />
      ))}
    </section>
  );
}

function useMaterials(data: RosterData): Material[] | null {
  const [state, setState] = useState<{ id: string; list: Material[] } | null>(null);
  const { game } = data;
  const needed = Boolean(game.rules.materialsFor);
  useEffect(() => {
    if (!needed) return;
    let alive = true;
    void game.data.materials().then((list) => {
      if (alive) setState({ id: game.id, list });
    });
    return () => {
      alive = false;
    };
  }, [game, needed]);
  if (!needed) return [];
  return state?.id === game.id ? state.list : null;
}

function Materials({
  data,
  character: c,
  openFarm,
  farming,
}: {
  data: RosterData;
  character: Character;
  /** Adds them to Farm (if they aren't there yet), then opens it. */
  openFarm?: (() => void) | undefined;
  farming: boolean;
}) {
  const { game } = data;
  const materials = useMaterials(data);
  const real = materials ? farmPlan(game, [c.id], materials) : null;
  const showExamples = useExamplesShown();
  const example = showExamples && real !== null && !real.needs.known;
  return (
    <section className={r.card} aria-labelledby="materials-max">
      <div className={r.cardHead}>
        <h3 className={r.cardTitle} id="materials-max">
          Materials to max
        </h3>
        {example && <ExampleTag />}
      </div>
      {/* Material amounts come from game.rules.materialsFor; what you have isn't tracked yet. */}
      {real === null ? (
        <p className={r.muted}>Loading…</p>
      ) : real.needs.known ? (
        real.needs.value.map((m) => (
          <div key={m.material} className={r.matRow}>
            <div className={r.matTop}>
              <span className={r.lineLabel}>{m.name}</span>
              <span className={r.mono}>need {formatNumber(m.amount)}</span>
            </div>
            <span className={r.track} aria-hidden="true" />
            <span className={r.statNoData}>Have: no data yet</span>
          </div>
        ))
      ) : !example ? (
        <p className={r.cardText}>
          Material amounts for {game.name}: <NoData dash={false} /> That part is on us, not you.
        </p>
      ) : (
        <>
          <p className={r.cardText}>Material amounts for {game.name} aren’t in HLITH yet (that part is on us). These rows only show what it will look like.</p>
          {/* Same example rows as Farm; what you have isn't tracked, so it's "—" just like real data. */}
          {exampleNeeds(game, 1).map((m) => (
            <div key={m.material} className={r.matRow}>
              <div className={r.matTop}>
                <span className={r.lineLabel}>{m.name}</span>
                <span className={r.mono}>—/{formatNumber(m.amount)}</span>
              </div>
              <span className={r.track} aria-hidden="true" />
              <span className={r.statNoData}>Have: no data yet</span>
            </div>
          ))}
        </>
      )}
      {openFarm && (
        <button type="button" className={r.linkButton} onClick={openFarm}>
          {farming ? 'Open Farm →' : 'Plan it in Farm →'}
        </button>
      )}
    </section>
  );
}
