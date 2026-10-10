import { useState } from 'react';
import type { Character, GameContract, Material } from '../../core/contract';
import { known, type Known } from '../../core/contract/known';
import { useExamplesShown } from '../../core/data/prefs';
import { setFarm, type GameUserData } from '../../core/data/userData';
import { formatNumber } from '../../core/time/format';
import { ExampleNotice, ExampleTag, GameTag, HowTo, NoData } from '../../core/ui';
import { artOf, CharArt } from '../roster/shared';
import { exampleNeeds } from './examples';
import { useBuilds } from '../roster/useRosterData';
import { daysToFinish, farmPlan, perDay, type NeedRow } from './plan';
import f from './farm.module.css';

export interface FarmGame {
  game: GameContract;
  characters: Character[];
  materials: Material[];
  user: GameUserData;
}

interface Props {
  games: FarmGame[];
  openRoster?: () => void;
}

/*
 * Interface only for the material plan. Material amounts, drops per run and
 * gear from builds are filled by the logic workstreams (game.rules.materialsFor,
 * the materials list, ROSTER-LOGIC builds). Until then: example rows marked
 * EXAMPLE, and "No data yet" where nothing can be shown honestly.
 * Who you farm for is your own data and works now.
 */

const SUGGEST = 12;

interface Plan {
  g: FarmGame;
  chosen: Character[];
  rows: NeedRow[];
  example: boolean;
  /** The game's material amounts are known (else nothing can be added up). */
  amountsKnown: boolean;
  stamina: Known<number>;
  days: Known<number>;
}

function planOf(g: FarmGame, showExamples: boolean): Plan {
  const { game, user, characters, materials } = g;
  const chosen = user.farm.map((id) => characters.find((c) => c.id === id) ?? { id, name: id, rarity: 'mid' as const, element: '', role: '' });
  const real = farmPlan(game, user.farm, materials);
  const example = showExamples && chosen.length > 0 && !real.needs.known;
  const rows = real.needs.known ? real.needs.value : example ? exampleNeeds(game, chosen.length) : [];
  // What you have isn't tracked (not even in examples), so the stamina tile is exactly the sum of the rows below.
  const stamina = example ? known(rows.reduce((sum, r) => sum + (r.stamina.known ? r.stamina.value : 0), 0), 'user') : real.stamina;
  return { g, chosen, rows, example, amountsKnown: real.needs.known, stamina, days: daysToFinish(stamina, game.stamina[0]) };
}

/** Farm (R40): pick characters → materials (have / need, runs, stamina), stamina total, days to finish, gear to farm. */
export function Farm({ games, openRoster }: Props) {
  const several = games.length > 1;
  const showExamples = useExamplesShown();
  const plans = games.map((g) => planOf(g, showExamples));
  const anyChosen = plans.some((p) => p.chosen.length > 0);
  const anyExample = plans.some((p) => p.example);
  const word = several ? 'character' : (games[0]?.game.terms.character.toLowerCase() ?? 'character');

  return (
    <div className={f.stack}>
      <HowTo
        steps={[
          <>Under <strong>Farm for</strong>, tap the {word}s you’re building next. Tap again to stop farming for them.</>,
          <>Your wanted {word}s are suggested first. Search to find anyone else. You can also press “Farm for” on a {word}’s page in Roster.</>,
          <>HLITH adds up every material they need, how many runs that takes and how much stamina, and how many days at your daily refill.</>,
          <>Today then tells you what to spend stamina on first.</>,
        ]}
      >
        What you already have isn’t tracked yet, so totals are the full need. Crafting lower materials up: no data yet.
      </HowTo>

      {anyExample && (
        <ExampleNotice>
          Your picks are real, but the material rows, stamina and days marked EXAMPLE are made up: material amounts aren’t in HLITH yet (that part is on us, not you).
        </ExampleNotice>
      )}

      <Picker games={games} several={several} word={word} />

      {!anyChosen ? (
        <div className={f.nothing}>
          <span className={f.label}>NOTHING CHOSEN</span>
          <span className={f.nothingTitle}>Pick characters above</span>
          <span className={f.sub}>Their materials, stamina plan and gear appear here, and Today tells you what to spend stamina on.</span>
        </div>
      ) : (
        <>
          <section className={f.tiles} aria-label="Stamina plan">
            {plans
              .filter((p) => p.chosen.length > 0)
              .map((p) => (
                <Tiles key={p.g.game.id} plan={p} several={several} />
              ))}
          </section>
          <div className={f.columns}>
            <section className={f.card} aria-label="Materials">
              <h3 className={f.cardTitle}>Materials</h3>
              {plans.flatMap((p) => p.rows.map((row) => <MaterialRow key={`${p.g.game.id}:${row.material}`} plan={p} row={row} several={several} />))}
              {plans
                .filter((p) => p.chosen.length > 0 && p.amountsKnown && p.g.game.rules.materialsNote)
                .map((p) => (
                  <span key={`note-${p.g.game.id}`} className={f.sub}>
                    {several ? `${p.g.game.short}: ` : ''}
                    {p.g.game.rules.materialsNote}
                  </span>
                ))}
              {plans.every((p) => p.rows.length === 0) && (
                <span className={f.sub}>
                  <NoData dash={false} /> Material amounts for {plans.filter((p) => !p.amountsKnown && p.chosen.length > 0).map((p) => p.g.game.name).join(' and ') || 'these games'} aren’t in HLITH yet. That part is on us, not you.
                </span>
              )}
            </section>
            <section className={f.card} aria-label="Gear to farm">
              <h3 className={f.cardTitle}>{several ? 'Gear to farm' : `${games[0]?.game.terms.gear ?? 'Gear'} to farm`}</h3>
              {plans.flatMap((p) =>
                p.chosen.map((c) => {
                  const el = p.g.game.elements.find((e) => e.id === c.element);
                  return (
                    <div key={`${p.g.game.id}:${c.id}`} className={f.gearRow}>
                      <CharArt name={c.name} src={artOf(c, 'portrait')} elementColor={el?.color ?? 'var(--ink-4)'} className={f.gearArt} />
                      <div className={f.gearText}>
                        <span className={f.rowTitle}>
                          {c.name}
                          {several && <GameTag label={p.g.game.short} vent={p.g.game.vent} />}
                        </span>
                        <GearFor game={p.g.game} characterId={c.id} />
                      </div>
                    </div>
                  );
                }),
              )}
              {openRoster && (
                <button type="button" className={f.linkButton} onClick={openRoster}>
                  Open Roster →
                </button>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function Tiles({ plan, several }: { plan: Plan; several: boolean }) {
  const { g, stamina, days, example } = plan;
  const pool = g.game.stamina[0];
  const tag = several ? <GameTag label={g.game.short} vent={g.game.vent} /> : null;
  return (
    <>
      <div className={f.tile}>
        <span className={f.tileLabel}>
          {pool ? `${pool.name} needed` : 'Stamina needed'} {tag}
        </span>
        {stamina.known ? <span className={f.tileValue}>{formatNumber(stamina.value)}</span> : <span className={f.tileDash}>—</span>}
        {stamina.known ? (
          <span className={f.tileSub}>for every material listed {example && <ExampleTag />}</span>
        ) : (
          <span className={f.tileNoData}>{plan.amountsKnown ? 'No data yet · some materials have no drop rate' : `No data yet · material amounts for ${g.game.short} aren’t in HLITH yet`}</span>
        )}
      </div>
      <div className={f.tile}>
        <span className={f.tileLabel}>Days to finish {tag}</span>
        {days.known ? <span className={f.tileValue}>{formatNumber(days.value)}</span> : <span className={f.tileDash}>—</span>}
        {pool ? (
          <span className={f.tileSub}>
            at {formatNumber(perDay(pool))} {pool.name} a day {days.known && example && <ExampleTag />}
          </span>
        ) : (
          <span className={f.tileNoData}>No data yet</span>
        )}
      </div>
    </>
  );
}

function MaterialRow({ plan, row, several }: { plan: Plan; row: NeedRow; several: boolean }) {
  const { g, example } = plan;
  return (
    <div className={f.matRow}>
      <span className={f.rowTitle}>
        {row.name}
        {several && <GameTag label={g.game.short} vent={g.game.vent} />}
        {example && <ExampleTag />}
      </span>
      {/* What you have isn't tracked yet: "—" on real and example rows alike. */}
      <span className={f.matValue}>—/{formatNumber(row.amount)}</span>
      <span className={f.track} aria-hidden="true" />
      <span className={f.matMeta}>
        {row.runs.known ? `${formatNumber(row.runs.value)} runs` : '— runs'} · {row.stamina.known ? formatNumber(row.stamina.value) : '—'} stamina
      </span>
      <span className={f.tileNoData}>Have: no data yet</span>
    </div>
  );
}

function Picker({ games, several, word }: { games: FarmGame[]; several: boolean; word: string }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const all = games.flatMap((g) => g.characters.map((c) => ({ g, c, on: g.user.farm.includes(c.id), wanted: Boolean(g.user.roster[c.id]?.wanted) })));
  const chosen = games.flatMap((g) => g.user.farm.map((id) => all.find((x) => x.g === g && x.c.id === id)).filter((x): x is (typeof all)[number] => Boolean(x)));
  // Picks that aren't in the character list (any more): still yours, shown so you can remove them.
  const missing = games.flatMap((g) => g.user.farm.filter((id) => !g.characters.some((c) => c.id === id)).map((id) => ({ g, id })));
  const rest = all.filter((x) => !x.on);
  const wanted = rest.filter((x) => x.wanted);
  const pool = q ? rest.filter((x) => x.c.name.toLowerCase().includes(q)) : [...wanted, ...newestPerGame(rest.filter((x) => !x.wanted))];
  const suggestions = pool.slice(0, SUGGEST);
  const toggle = (x: (typeof all)[number]) => setFarm(x.g.game.id, x.on ? x.g.user.farm.filter((id) => id !== x.c.id) : [...x.g.user.farm, x.c.id]);

  const chip = (x: (typeof all)[number]) => {
    const el = x.g.game.elements.find((e) => e.id === x.c.element);
    return (
      <li key={`${x.g.game.id}:${x.c.id}`}>
        <button
          type="button"
          className={f.chip}
          aria-pressed={x.on}
          style={x.on ? { background: x.g.game.vent, borderColor: x.g.game.vent } : undefined}
          aria-label={`${x.on ? 'Remove' : 'Add'} ${x.c.name}`}
          onClick={() => toggle(x)}
        >
          <CharArt name={x.c.name} src={artOf(x.c, 'portrait')} elementColor={el?.color ?? 'var(--ink-4)'} className={f.chipArt} />
          {x.c.name}
          {several && <GameTag label={x.g.game.short} vent={x.g.game.vent} />}
          <span aria-hidden="true" className={f.chipMark}>
            {x.on ? '×' : '+'}
          </span>
        </button>
      </li>
    );
  };

  return (
    <section className={f.card} aria-labelledby="farm-for">
      <div className={f.cardHead}>
        <h3 className={f.cardTitle} id="farm-for">
          Farm for
        </h3>
        <span className={f.count}>{chosen.length + missing.length} chosen</span>
      </div>
      {chosen.length + missing.length > 0 && (
        <ul className={f.chips} aria-label="Chosen">
          {chosen.map(chip)}
          {missing.map(({ g, id }) => (
            <li key={`${g.game.id}:${id}`}>
              <button
                type="button"
                className={f.chip}
                aria-pressed="true"
                aria-label={`Remove ${id} (not in the ${word} list)`}
                title={`Not in the ${g.game.short} ${word} list any more`}
                onClick={() => setFarm(g.game.id, g.user.farm.filter((x) => x !== id))}
              >
                {id} · not in the list
                {several && <GameTag label={g.game.short} vent={g.game.vent} />}
                <span aria-hidden="true" className={f.chipMark}>
                  ×
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className={f.searchLabel}>
        <span className={f.label}>ADD A {word.toUpperCase()}</span>
        <input className={f.search} type="search" placeholder={`Search ${all.length} ${word}s`} value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
      </label>
      {suggestions.length > 0 ? (
        <>
          {!q && <span className={f.label}>{wanted.length ? 'YOUR WANTED FIRST, THEN NEWEST' : 'NEWEST'}</span>}
          <ul className={f.chips} aria-label="Suggestions">
            {suggestions.map(chip)}
          </ul>
        </>
      ) : (
        <p className={f.sub}>{all.length === 0 ? `The ${word} list is empty.` : q ? `No ${word} matches “${query}”.` : `Every ${word} is on your list.`}</p>
      )}
    </section>
  );
}

const newest = <T extends { c: Character }>(xs: T[]) => [...xs].sort((a, b) => (b.c.releasedAt ?? '').localeCompare(a.c.releasedAt ?? '') || a.c.name.localeCompare(b.c.name));

/**
 * Newest first within each game (no release dates: by name), then the games
 * take turns, so one game's dates never push another game off the list.
 */
export function newestPerGame<T extends { g: { game: { id: string } }; c: Character }>(xs: T[]): T[] {
  const byGame = new Map<string, T[]>();
  for (const x of xs) byGame.set(x.g.game.id, [...(byGame.get(x.g.game.id) ?? []), x]);
  const lists = [...byGame.values()].map(newest);
  const out: T[] = [];
  for (let i = 0; out.length < xs.length; i++) for (const l of lists) if (l[i]) out.push(l[i] as T);
  return out;
}


/** A character's recommended gear sets from the game's recommended build (game.data.builds), or "No data yet". */
function GearFor({ game, characterId }: { game: GameContract; characterId: string }) {
  const builds = useBuilds(game);
  if (builds === null) return <span className={f.sub}>Loading…</span>;
  const b = builds.find((x) => x.characterId === characterId);
  const sets = b?.sets.filter((s) => s.options.length) ?? [];
  if (!b || !sets.length)
    return (
      <>
        <NoData dash={false} />
        <span className={f.sub}>{game.terms.gear}: no recommended build for them yet.</span>
      </>
    );
  return (
    <span className={f.sub}>
      {sets.map((s) => `${s.pieces}-piece: ${s.options.join(' or ')}`).join(' · ')} ({b.source})
    </span>
  );
}
