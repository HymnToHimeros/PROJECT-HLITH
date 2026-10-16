import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Character, Material, SavedBuild, TeamPreset } from '../../core/contract';
import { MIN_PARTS } from '../../core/rules/buildScore';
import { useExamplesShown } from '../../core/data/prefs';
import { clearBuild, setBuild, setFarm, setRosterEntry } from '../../core/data/userData';
import { formatNumber } from '../../core/time/format';
import { Button, ExampleTag, GameTag, HowTo, NoData, UnverifiedTag } from '../../core/ui';
import { exampleNeeds } from '../farm/examples';
import { farmPlan } from '../farm/plan';
import { exampleBuild, exampleScore } from './examples';
import { BuildEditor } from './BuildEditor';
import { StatTargets } from './StatTargets';
import { BuildWants } from './BuildWants';
import { KitCheck } from './KitCheck';
import r from './roster.module.css';
import { artOf, CharArt, dupesLabel, elementOf, entryOf, isUpcoming, rarityColor, roleLabel, toCharacterBuild } from './shared';
import { Line, ReadSoFar, TeamRow, teamAccount, useTeamAccount } from './TeamParts';
import { useBuilds, useKits, type RosterData } from './useRosterData';
import { formatFullDate } from '../../core/time/reset';
import { MyLabels } from './MyLabels';
import { feedback } from '../../core/ui/feedback';
import { hardPityOf, worstCase } from '../pity/pity';

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
  const save = (change: Partial<typeof entry>) => {
    setRosterEntry(game.id, c.id, { ...entry, ...change });
    feedback(change.owned === false || change.wanted === false ? 'undo' : 'done');
  };
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
              {game.terms.rarity[c.rarity] ?? c.rarity}
            </span>
            <span className={r.chip}>
              <span className={r.chipDot} style={{ background: el?.color ?? 'var(--ink-4)' }} aria-hidden="true" />
              {el?.label ?? c.element}
            </span>
            <span className={r.chip}>{roleLabel(game, c.role)}</span>
            <span className={r.chipVent} style={{ background: game.vent }}>
              {game.short}
            </span>
            {c.leak && <UnverifiedTag source={c.leak.source} />}
          </div>
          <h2 className={r.heroName}>
            {c.name}
            {user.nicknames?.[c.id] && <span className={r.heroNick}> “{user.nicknames[c.id]}”</span>}
          </h2>
          <div className={r.markRow} role="group" aria-label="Your roster">
            <button
              type="button"
              className={r.markBtn}
              aria-pressed={entry.owned}
              // A leaked character isn't out yet: it can be wanted, not owned (un-owning stays possible).
              disabled={Boolean(c.leak) && !entry.owned}
              title={c.leak && !entry.owned ? 'Leaked, not released yet: you can mark it wanted, not owned.' : undefined}
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
          <MyLabels game={game.id} user={user} character={c} />
          <div className={r.heroStats}>
            <div className={r.stat}>
              <span className={r.statLabel}>Level</span>
              <span className={r.statValue} data-empty={user.builds?.[c.id]?.level === undefined}>
                {user.builds?.[c.id]?.level ?? '—'}
              </span>
              <span className={entry.owned && user.builds?.[c.id]?.level === undefined ? r.statNoData : r.statSub}>
                {!entry.owned ? 'Not owned' : user.builds?.[c.id]?.level !== undefined ? `of ${game.build?.levelMax ?? '…'}` : game.build ? 'No data yet · enter it in Build score' : 'No data yet · levels aren’t saved yet'}
              </span>
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
            <PotentialStat data={data} character={c} />
          </div>
        </div>
      </div>

      {/* Design order: Build score (or If you pull), Team fit, Materials. Secondary cards fold away below. */}
      <div className={r.cards}>
        {/* A leak can't be owned: it always gets If you pull (pre-pull, T39). */}
        {entry.owned && !c.leak ? <BuildCard data={data} character={c} /> : <IfYouPull data={data} character={c} openPulls={openPulls} />}
        <TeamFit data={data} character={c} makePreset={makePreset} />
        <BuildWants data={data} character={c} />
        <StatTargets data={data} character={c} />
        <section className={r.card} aria-labelledby={`how-to-build-${c.id}`}>
          <h3 className={r.cardTitle} id={`how-to-build-${c.id}`}>
            How to build {c.name}
          </h3>
          <BuildGuide data={data} character={c} />
        </section>
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
            {c.leak ? (
              <p className={r.cardText}>Not released yet. Everything here is from the game files and can still change before release.</p>
            ) : (
              <p className={r.cardText}>Not released yet. An official banner has been announced.</p>
            )}
            <div className={r.lineRow}>
              <span className={r.lineLabel}>{c.leak ? 'Release date in the files' : 'Release date'}</span>
              <span className={r.mono}>
                {c.releasedAt
                  ? new Date(c.releasedAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : <NoData />}
              </span>
            </div>
            {c.leak && <UnverifiedTag source={c.source ?? 'game files'} />}
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
      </div>
    </article>
  );
}

/** One numbered step of How to build. */
function BuildStep({ n, title, source, why, note, children }: { n: number; title: string; source?: string | undefined; why?: string[] | undefined; note?: string | undefined; children: ReactNode }) {
  return (
    <section className={r.buildStep}>
      <h4 className={r.buildStepTitle}>
        <span className={r.buildStepNum}>{n}</span>
        {title}
      </h4>
      {children}
      {source && <span className={r.muted}>Source: {source}.</span>}
      {why && why.length > 0 && (
        <details className={r.why}>
          <summary className={r.whySummary}>Why</summary>
          <ul className={r.whyList}>
            {why.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </details>
      )}
      {note && <span className={r.cardText}>Note: {note}</span>}
    </section>
  );
}

/** A set or weapon picture; nothing when the source has none (the name stays). */
function ItemIcon({ src, size = 'md' }: { src: string | undefined; size?: 'sm' | 'md' }) {
  if (!src) return null;
  return <img className={size === 'sm' ? r.itemIconSm : r.itemIcon} src={src} alt="" loading="lazy" decoding="async" />;
}

/**
 * How to build (game.data.builds): step by step, with pictures. Gear sets with
 * what they do, the weapon and its effect, main stat per slot, sub stats in
 * order, skills to level first, and where it came from.
 */
function BuildGuide({ data, character: c }: { data: RosterData; character: Character }) {
  const { game } = data;
  const builds = useBuilds(game);
  const b = builds?.find((x) => x.characterId === c.id);
  const t = game.terms;
  if (builds === null) return <p className={r.muted}>Loading…</p>;
  if (!b)
    return (
      <>
        {[`${t.gear} sets`, t.weapon, 'Main stats', `${t.skill}: level first`].map((label) => (
          <div key={label} className={r.lineRow}>
            <span className={r.lineLabel}>{label}</span>
            <NoData dash={false} />
          </div>
        ))}
      </>
    );
  const sets = b.sets.filter((s) => s.options.length);
  // Every step is shown in this order, numbered; one the source has nothing for says "No data yet" (honest data).
  // Only a step the game doesn't have is left out (Endfield gear has no main stat to pick).
  const steps = { sets: true, weapon: true, main: b.hasMainStats !== false, sub: true, skills: true };
  const order = (Object.keys(steps) as (keyof typeof steps)[]).filter((k) => steps[k]);
  const num = (k: keyof typeof steps) => order.indexOf(k) + 1;
  const ranked = b.ranked !== false;
  // An unranked list someone put in order (Endfield: HLITH by kit match) is numbered, but never "best first".
  const numbered = ranked || !!b.orderedBy;
  const weaponTitle = b.weapons.length < 2 ? t.weapon : b.orderedBy ? `${t.weapon}: ${b.orderedBy}'s order` : ranked ? `${t.weapon}: best first` : t.weapon;
  // Builds whose steps come from different sources say so under each step; others name one source at the end.
  const perStep = b.stepSources !== undefined;
  const empty = (what: string) => (
    <span className={r.cardText}>
      <NoData dash={false} /> No recommendation yet for {what}.
    </span>
  );
  return (
    <>
      {sets.length === 0 ? (
        <BuildStep n={num('sets')} title={`${t.gear} sets`} why={b.stepWhy?.sets} note={b.stepNotes?.sets}>
          {empty(`${t.gear.toLowerCase()} sets`)}
        </BuildStep>
      ) : (
        <BuildStep n={num('sets')} title={`${t.gear} sets: ${sets.map((s) => `${s.pieces} piece${s.pieces === 1 ? '' : 's'}`).join(' + ')}`} source={b.stepSources?.sets} why={b.stepWhy?.sets} note={b.stepNotes?.sets}>
          {sets.map((s) => (
            <div key={s.pieces} className={r.stack}>
              <span className={r.label}>
                {s.pieces} PIECE{s.pieces === 1 ? '' : 'S'}
                {s.options.length > 1 ? ' · BEST FIRST, ANY ONE' : ''}
              </span>
              <ul className={r.itemList}>
                {s.options.map((o, i) => {
                  const item = b.items?.[o];
                  // A 2-piece slot only gets the 2-piece effect; 4 pieces get both.
                  const effects = (item?.effects ?? []).filter((e) => Number.parseInt(e.label, 10) <= s.pieces || Number.isNaN(Number.parseInt(e.label, 10)));
                  return (
                    <li key={o} className={r.item}>
                      <ItemIcon src={item?.icon} />
                      <div className={r.itemBody}>
                        <span className={r.itemName}>
                          {o}
                          {i === 0 && s.options.length > 1 && <span className={r.itemBest}>best</span>}
                        </span>
                        {effects.map((e) => (
                          <span key={e.label} className={r.itemEffect}>
                            <strong>{e.label}:</strong> {e.text}
                          </span>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </BuildStep>
      )}
      <BuildStep n={num('weapon')} title={weaponTitle} source={perStep ? b.source : undefined} why={b.stepWhy?.weapons}>
        {b.weapons.length ? (
          <ul className={r.itemList}>
            {b.weapons.map((w, i) => {
              const item = b.items?.[w];
              return (
                <li key={w} className={r.item}>
                  <ItemIcon src={item?.icon} />
                  <div className={r.itemBody}>
                    <span className={r.itemName}>
                      {b.weapons.length > 1 && numbered && <span className={r.mono}>{i + 1}. </span>}
                      {w}
                    </span>
                    {item?.effects.map((e) => (
                      <span key={e.label} className={r.itemEffect}>
                        <strong>{e.label}:</strong> {e.text}
                      </span>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <span className={r.cardText}>
            <NoData dash={false} /> The source doesn’t name a {t.weapon} for them.
          </span>
        )}
      </BuildStep>
      {steps.main && Object.keys(b.mainStats).length === 0 && (
        <BuildStep n={num('main')} title="Main stats">
          {empty('main stats')}
        </BuildStep>
      )}
      {steps.main && Object.keys(b.mainStats).length > 0 && (
        <BuildStep n={num('main')} title="Main stat on each slot">
          <div>
            {Object.entries(b.mainStats).map(([slot, stats]) => (
              <div key={slot} className={r.lineRow}>
                <span className={r.lineLabel}>{slot}</span>
                <span className={r.buildValue}>{stats.join(' or ')}</span>
              </div>
            ))}
          </div>
          <span className={r.muted}>Slots not listed have a fixed main stat.</span>
        </BuildStep>
      )}
      {b.subStats.length === 0 && (
        <BuildStep n={num('sub')} title="Sub stats" why={b.stepWhy?.subStats}>
          {empty('sub stats')}
        </BuildStep>
      )}
      {b.subStats.length > 0 && (
        <BuildStep n={num('sub')} title="Sub stats to look for, best first" source={b.stepSources?.subStats} why={b.stepWhy?.subStats}>
          <ol className={r.subList}>
            {b.subStats.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ol>
        </BuildStep>
      )}
      {b.skillsFirst.length === 0 && (
        <BuildStep n={num('skills')} title={`${t.skill}: level first`} why={b.stepWhy?.skills} note={b.stepNotes?.skills}>
          {empty(`which ${t.skill.toLowerCase()} to level first`)}
        </BuildStep>
      )}
      {b.skillsFirst.length > 0 && (
        <BuildStep n={num('skills')} title={`${t.skill}: level first`} source={b.stepSources?.skills} why={b.stepWhy?.skills} note={b.stepNotes?.skills}>
          <ol className={r.subList}>
            {b.skillsFirst.map((tier) => (
              <li key={tier.join()}>{tier.join(' and ')}</li>
            ))}
          </ol>
        </BuildStep>
      )}
      {!perStep && <span className={r.muted}>Source: {b.source}.</span>}
    </>
  );
}

function BuildCard({ data, character: c }: { data: RosterData; character: Character }) {
  const { game, user } = data;
  const ex = exampleBuild(game);
  const showExamples = useExamplesShown();
  const saved = user.builds?.[c.id];
  const [editing, setEditing] = useState(false);
  const [cleared, setCleared] = useState<SavedBuild | null>(null);
  const entry = entryOf(user.roster, c.id);
  const score = useMemo(() => {
    const rate = game.rules.scoreBuild;
    if (!rate || !saved || saved.level === undefined) return null;
    const build = toCharacterBuild(saved, c.id, entry.dupes);
    return rate(build);
  }, [game.rules, saved, c.id, entry.dupes]);
  const t = game.terms;
  return (
    <section className={r.card} aria-labelledby="build-score">
      <div className={r.cardHead}>
        <h3 className={r.cardTitle} id="build-score">
          Build score
        </h3>
        {game.build && saved && (
          <Button variant="quiet" onClick={() => setEditing(true)}>
            Edit build
          </Button>
        )}
      </div>
      {cleared && (
        <p className={r.undoRow} role="status">
          <span className={r.grow}>Build cleared.</span>
          <Button
            onClick={() => {
              setBuild(game.id, c.id, cleared);
              setCleared(null);
            }}
          >
            Undo
          </Button>
        </p>
      )}
      {saved ? (
        <>
          {score?.known ? (
            <>
              <div className={r.scoreRow}>
                <span className={r.scoreBig}>{score.value.score}</span>
                <span className={r.scoreOf}>/100</span>
                <span className={r.grade}>{score.value.grade}</span>
              </div>
              {/* Every checked part with what it compared (LOGIC-CORE); parts with no data yet aren't counted. */}
              {score.value.parts && (
                <details className={r.why}>
                  <summary className={r.whySummary}>Why {score.value.score}: {score.value.basis}</summary>
                  <ul className={r.whyList}>
                    {score.value.parts.map((p) => (
                      <li key={p.label} className={r.partRow}>
                        <span className={r.lineLabel}>{p.label}</span>
                        <span className={r.track} aria-hidden="true">
                          {p.value !== null && <span className={r.fill} style={{ width: `${p.value}%` }} />}
                        </span>
                        <span className={r.mono}>{p.value ?? '—'}</span>
                        <span className={r.muted}>{p.value === null ? `No data yet · ${p.detail}` : p.detail}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          ) : (
            <p className={r.statNoData}>{saved.level === undefined
                ? 'No score yet · add the level to score this build'
                : !game.rules.scoreBuild
                  ? 'No score yet · scoring is being built'
                  : score && !score.known && score.fix === 'enter-manually'
                    ? `No score yet · add sets, main stats or sub stats (a score needs ${MIN_PARTS} checked parts)`
                    : 'No score yet · there’s no recommended build for them to compare with'}</p>
          )}
          <dl className={r.buildSummary}>
            <div>
              <dt>Level</dt>
              <dd>{saved.level ?? '—'}</dd>
            </div>
            <div>
              <dt>{t.weapon}</dt>
              <dd>
                {saved.weapon
                  ? [saved.weapon.name, saved.weapon.level !== undefined && `Lv ${saved.weapon.level}`, saved.weapon.refine !== undefined && game.build && `${game.build.refine.name} ${saved.weapon.refine}`]
                      .filter(Boolean)
                      .join(' · ')
                  : '—'}
              </dd>
            </div>
            {(game.build?.slots ?? []).map((slot) => {
              const g = saved.gear.find((x) => x.slot === slot.id);
              return (
                <div key={slot.id}>
                  <dt>{slot.label}</dt>
                  <dd>
                    {g ? [g.set, g.main, g.subs.map((x) => `${x.stat} ${x.value}`).join(', ')].filter(Boolean).join(' · ') : '—'}
                  </dd>
                </div>
              );
            })}
            {saved.skills && (
              <div>
                <dt>{t.skill}</dt>
                <dd>
                  {Object.entries(saved.skills)
                    .map(([k, v]) => `${k} ${v}`)
                    .join(' · ')}
                </dd>
              </div>
            )}
          </dl>
          <div className={r.tapRow}>
            <span className={`${r.muted} ${r.grow}`}>
              Saved {formatFullDate(Date.parse(saved.updatedAt))} · {saved.source === 'scan' ? 'from a screenshot scan' : saved.source === 'hoyolab' ? 'from HoYoLAB' : 'entered by you'}
            </span>
            <Button variant="quiet" onClick={() => setCleared(clearBuild(game.id, c.id))}>
              Clear build
            </Button>
          </div>
        </>
      ) : (
        <div className={r.noBuild}>
          <span className={r.bigDash} aria-hidden="true">
            —
          </span>
          <span className={r.noBuildTitle}>No build saved yet</span>
          <span className={r.cardText}>
            {game.build
              ? `Enter ${c.name}’s level, ${t.weapon} and ${t.gear} and HLITH keeps them here. It shows nothing rather than a guess.`
              : `HLITH can’t save builds for this game yet, so there’s nothing to score. It shows nothing rather than a guess.`}
          </span>
          {game.build && (
            <Button variant="primary" onClick={() => setEditing(true)}>
              Enter build
            </Button>
          )}
        </div>
      )}
      {!saved && showExamples && (
        <div className={r.preview} role="group" aria-label="Example build score">
          <div className={r.previewHead}>
            <ExampleTag />
            <span className={r.muted}>What a score looks like once a build is saved</span>
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
      <BuildEditor game={game} character={c} saved={saved} open={editing} onClose={() => setEditing(false)} />
    </section>
  );
}

function IfYouPull({ data, character, openPulls }: { data: RosterData; character: Character; openPulls: Props['openPulls'] }) {
  const { game } = data;
  const banner = game.bannerTypes.find((b) => b.target === 'character' && hardPityOf(b.pity) !== null);
  // From a fresh start with the 50/50 still to play; null when the game has no ceiling.
  const sure = banner ? worstCase(banner.pity, { pulls: 0, guaranteed: false, extra: { banner: 0, got: 0 } }) : null;
  const worst = sure?.known ? sure.value : null;
  return (
    <section className={r.card} aria-labelledby="if-you-pull">
      <h3 className={r.cardTitle} id="if-you-pull">
        If you pull
      </h3>
      {character.leak && <UnverifiedTag source={character.leak.source} />}
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
      <PullValueLine data={data} character={character} />
      {openPulls && (
        <button type="button" className={r.linkButton} onClick={() => openPulls('planner')}>
          Plan pulls →
        </button>
      )}
    </section>
  );
}

/** Teams shown at first on a character page; the rest stay one tap away. */
const FIT_FIRST = 3;

function TeamFit({ data, character: c, makePreset }: { data: RosterData; character: Character; makePreset?: (() => void) | undefined }) {
  const { game, user, presets } = data;
  const [all, setAll] = useState(false);
  const inPreset = (p: TeamPreset) => p.slots.some((s) => s.characters.includes(c.id));
  // A game team as you'd field it (the game's team rules fill each slot from your roster); else each slot's first pick.
  const firstsOf = (p: TeamPreset) => (!presets.example && game.rules.teams?.fill?.(p, teamAccount(data))) || p.slots.map((s) => s.characters[0]).filter((x): x is string => Boolean(x));
  const missing = (ids: string[]) => ids.filter((id) => !entryOf(user.roster, id).owned).length;
  // Their own team first (they lead it), then teams they're a first pick in, then fewest missing.
  const recommended = presets.list
    .map((p, i) => ({ p, i, members: firstsOf(p) }))
    .filter(({ p }) => inPreset(p))
    .map((x) => ({
      ...x,
      rank: (x.members[0] === c.id ? 0 : x.members.includes(c.id) ? 1 : 2) * 10 + missing(x.members),
    }))
    .sort((a, b) => a.rank - b.rank);
  const mine = user.teams.filter((t) => t.members.includes(c.id));
  const shown = all ? recommended : recommended.slice(0, Math.max(0, FIT_FIRST - mine.length));
  const hidden = recommended.length - shown.length;
  return (
    <section className={r.card} aria-labelledby="team-fit">
      <h3 className={r.cardTitle} id="team-fit">
        Team fit
      </h3>
      {!presets.example && <ReadSoFar rules={game.rules.teams} word={game.terms.character.toLowerCase()} />}
      {recommended.length === 0 && mine.length === 0 && <p className={r.cardText}>No team uses this {game.terms.character.toLowerCase()} yet.</p>}
      {recommended.length === 0 && mine.length === 0 && makePreset && (
        <button type="button" className={r.linkButton} onClick={makePreset}>
          Make a team with them →
        </button>
      )}
      {mine.map((t) => (
        <TeamRow key={t.id} data={data} name={t.name} members={t.members} example={false} score={null} />
      ))}
      {shown.map(({ p, i, members }) => (
        <TeamRow key={p.id} data={data} name={p.name} members={members} example={presets.example} score={presets.example ? exampleScore(i) : null} />
      ))}
      {hidden > 0 && (
        <button type="button" className={r.linkButton} onClick={() => setAll(true)}>
          Show {hidden} more team{hidden === 1 ? '' : 's'} with {c.name}
        </button>
      )}
      {all && recommended.length > FIT_FIRST && (
        <button type="button" className={r.linkButton} onClick={() => setAll(false)}>
          Show fewer
        </button>
      )}
      <WhoFits data={data} character={c} />
    </section>
  );
}

/** Who fits with this character, from the game's team rules: only characters whose kits really connect, with how. */
function WhoFits({ data, character: c }: { data: RosterData; character: Character }) {
  const rules = data.game.rules.teams;
  const roster = data.user.roster;
  const account = useTeamAccount(data);
  const fits = useMemo(() => (rules?.rated(c.id) ? rules.whoFits([c.id], account, { includeUnowned: true }).slice(0, 5) : null), [rules, c.id, account]);
  if (!rules) return null;
  const word = data.game.terms.character.toLowerCase();
  return (
    <div className={r.stack}>
      <span className={r.label}>WHO FITS</span>
      {fits === null ? (
        <span className={r.cardText}>
          <NoData dash={false} /> This {word}’s kit hasn’t been read yet, so the check can’t say who fits.
        </span>
      ) : fits.length === 0 ? (
        <span className={r.cardText}>No {word} whose kit has been read connects with them yet.</span>
      ) : (
        fits.map((f) => (
          <details key={f.id} className={r.why}>
            <summary className={r.whySummary}>
              <span className={r.lineLabel}>{data.byId.get(f.id)?.name ?? f.id}</span>
              &nbsp;
              <span className={r.ideaState}>
                count {f.count} · {entryOf(roster, f.id).owned ? 'owned' : 'not owned'}
              </span>
            </summary>
            <ul className={r.whyList}>
              {f.how.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </details>
        ))
      )}
    </div>
  );
}

/** What this character would add to your teams (game's team rules), shown in "If you pull". */
function PullValueLine({ data, character: c }: { data: RosterData; character: Character }) {
  const rules = data.game.rules.teams;
  const account = useTeamAccount(data);
  const v = useMemo(() => (rules ? rules.ifYouPull(c.id, account) : null), [rules, c.id, account]);
  if (!rules) return null;
  if (!v)
    return (
      <span className={r.cardText}>
        For your teams: <NoData dash={false} /> (kit not read yet)
      </span>
    );
  // With nobody marked owned there are no teams of yours to compare: unknown, never "No gain".
  if (!data.characters.some((x) => x.id !== c.id && account.owned(x.id)))
    return (
      <span className={r.cardText}>
        For your teams: <NoData dash={false} /> (mark who you own in Roster)
      </span>
    );
  return (
    <details className={r.why}>
      <summary className={r.whySummary}>For your teams: {v.percent ? `${v.percent}%` : 'No gain'}</summary>
      <ul className={r.whyList}>
        {v.why.map((w) => (
          <li key={w}>
            <Line text={w} />
          </li>
        ))}
      </ul>
    </details>
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
      ) : real.needs.known && real.needs.value.length === 0 ? (
        <p className={r.cardText}>
          Material amounts for {c.name}: <NoData dash={false} /> The source doesn’t list them yet.
        </p>
      ) : real.needs.known ? (
        real.needs.value.map((m) => (
          <div key={m.material} className={r.matRow}>
            <div className={r.matTop}>
              <span className={r.matName}>
                <ItemIcon src={m.icon} size="sm" />
                <span className={r.lineLabel}>{m.name}</span>
              </span>
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
      {real?.needs.known && real.needs.value.length > 0 && game.rules.materialsNote && <span className={r.muted}>{game.rules.materialsNote}</span>}
      {openFarm && (
        <button type="button" className={r.linkButton} onClick={openFarm}>
          {farming ? 'Open Farm →' : 'Plan it in Farm →'}
        </button>
      )}
    </section>
  );
}

/**
 * The game's second upgrade track (HSR Enhanced kit, ZZZ Agent Potential), only for
 * characters whose kit has pieces that need it. Kit check and team scores read it;
 * "Not set" keeps those pieces locked, as the honest default.
 */
function PotentialStat({ data, character: c }: { data: RosterData; character: Character }) {
  const { game, user } = data;
  const track = game.potential;
  const kits = useKits(game);
  const kit = kits?.find((k) => k.characterId === c.id);
  if (!track || !kit?.skills.some((s) => s.unlock?.potential || s.replacedAt)) return null;
  const entry = entryOf(user.roster, c.id);
  const onOff = track.max === 1;
  const label = (n: number) => (onOff ? (n ? 'Yes' : 'No') : String(n));
  const id = `potential-${c.id}`;
  return (
    <div className={r.stat}>
      <label className={r.statLabel} htmlFor={id}>
        {track.name}
      </label>
      <select
        id={id}
        className={r.input}
        value={entry.potential ?? ''}
        disabled={!entry.owned}
        onChange={(e) => {
          const rest = { owned: entry.owned, wanted: entry.wanted, dupes: entry.dupes };
          setRosterEntry(game.id, c.id, e.target.value === '' ? rest : { ...rest, potential: Number(e.target.value) });
        }}
      >
        <option value="">Not set</option>
        {Array.from({ length: track.max + 1 }, (_, n) => (
          <option key={n} value={n}>
            {label(n)}
          </option>
        ))}
      </select>
      <span className={r.statSub}>
        {!entry.owned ? 'Mark as owned first' : entry.potential === undefined ? `Kit check keeps ${track.name} parts locked until you set it` : 'Kit check and team scores use this'}
      </span>
    </div>
  );
}
