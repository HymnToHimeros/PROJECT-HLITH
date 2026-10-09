import { useState } from 'react';
import type { Character, GameContract, Material } from '../../core/contract';
import { known, type Known } from '../../core/contract/known';
import { setFarm, type GameUserData } from '../../core/data/userData';
import { formatNumber } from '../../core/time/format';
import { ExampleNotice, ExampleTag, GameTag, HowTo, NoData } from '../../core/ui';
import { artOf, CharArt } from '../roster/shared';
import { exampleNeeds } from './examples';
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
  /** Example "have" amounts, only on example rows. Real have isn't tracked yet. */
  exampleHave: number[];
  stamina: Known<number>;
  days: Known<number>;
}

function planOf(g: FarmGame): Plan {
  const { game, user, characters, materials } = g;
  const chosen = user.farm.map((id) => characters.find((c) => c.id === id) ?? { id, name: id, rarity: 'mid' as const, element: '', role: '' });
  const real = farmPlan(game, user.farm, materials);
  const example = chosen.length > 0 && !real.needs.known;
  const rows = real.needs.known ? real.needs.value : example ? exampleNeeds(game, chosen.length) : [];
  const exampleHave = rows.map((r, i) => Math.round(r.amount * ([0.17, 0.3, 0.6, 0.1][i % 4] ?? 0)));
  const stamina = example ? known(rows.reduce((sum, r, i) => sum + (r.stamina.known ? Math.round(r.stamina.value * (1 - (exampleHave[i] ?? 0) / r.amount)) : 0), 0), 'user') : real.stamina;
  return { g, chosen, rows, example, exampleHave, stamina, days: daysToFinish(stamina, game.stamina[0]) };
}

/** Farm (R40): pick characters → materials (have / need, runs, stamina), stamina total, days to finish, gear to farm. */
export function Farm({ games, openRoster }: Props) {
  const several = games.length > 1;
  const plans = games.map(planOf);
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
              {plans.flatMap((p) => p.rows.map((row, i) => <MaterialRow key={`${p.g.game.id}:${row.material}`} plan={p} row={row} index={i} several={several} />))}
              {plans.every((p) => p.rows.length === 0) && <NoData />}
            </section>
            <section className={f.card} aria-label="Gear to farm">
              <h3 className={f.cardTitle}>{several ? 'Gear to farm' : `${games[0]?.game.terms.gear ?? 'Gear'} to farm`}</h3>
              {/* ROSTER-LOGIC fills each character's recommended gear from their build. */}
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
                        <NoData dash={false} />
                        <span className={f.sub}>{p.g.game.terms.gear} come from this build, which isn’t in HLITH yet.</span>
                      </div>
                    </div>
                  );
                }),
              )}
              {openRoster && (
                <button type="button" className={f.linkButton} onClick={openRoster}>
                  Builds live on each character’s page in Roster →
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
          <span className={f.tileNoData}>No data yet · some materials have no drop rate</span>
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

function MaterialRow({ plan, row, index, several }: { plan: Plan; row: NeedRow; index: number; several: boolean }) {
  const { g, example } = plan;
  const have = example ? (plan.exampleHave[index] ?? 0) : null;
  const pct = have === null ? 0 : Math.min(100, (have / row.amount) * 100);
  return (
    <div className={f.matRow}>
      <span className={f.rowTitle}>
        {row.name}
        {several && <GameTag label={g.game.short} vent={g.game.vent} />}
        {example && <ExampleTag />}
      </span>
      <span className={f.matValue} data-done={have !== null && have >= row.amount}>
        {have === null ? `—/${formatNumber(row.amount)}` : `${formatNumber(have)}/${formatNumber(row.amount)}`}
      </span>
      <span className={f.track} aria-hidden="true">
        <span className={f.fill} style={{ width: `${pct}%`, background: g.game.vent }} />
      </span>
      <span className={f.matMeta}>
        {row.runs.known ? `${formatNumber(row.runs.value)} runs` : '— runs'} · {row.stamina.known ? formatNumber(row.stamina.value) : '—'} stamina
      </span>
      {have === null && <span className={f.tileNoData}>Have: no data yet</span>}
    </div>
  );
}

function Picker({ games, several, word }: { games: FarmGame[]; several: boolean; word: string }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const all = games.flatMap((g) => g.characters.map((c) => ({ g, c, on: g.user.farm.includes(c.id), wanted: Boolean(g.user.roster[c.id]?.wanted) })));
  const chosen = games.flatMap((g) => g.user.farm.map((id) => all.find((x) => x.g === g && x.c.id === id)).filter((x): x is (typeof all)[number] => Boolean(x)));
  const rest = all.filter((x) => !x.on);
  const wanted = rest.filter((x) => x.wanted);
  const pool = q ? rest.filter((x) => x.c.name.toLowerCase().includes(q)) : [...wanted, ...newest(rest.filter((x) => !x.wanted))];
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
        <span className={f.count}>{chosen.length} chosen</span>
      </div>
      {chosen.length > 0 && (
        <ul className={f.chips} aria-label="Chosen">
          {chosen.map(chip)}
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

