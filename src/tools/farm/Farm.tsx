import { useState } from 'react';
import type { Character, GameContract, Material } from '../../core/contract';
import { known, unknown } from '../../core/contract/known';
import { setFarm, useGameData } from '../../core/data/userData';
import { formatNumber } from '../../core/time/format';
import { ExampleNotice, ExampleTag, NoData, StatTile } from '../../core/ui';
import { exampleNeeds } from './examples';
import { daysToFinish, farmPlan, perDay } from './plan';
import f from './farm.module.css';

interface Props {
  game: GameContract;
  characters: Character[];
  materials: Material[];
  tag?: { label: string; vent: string } | undefined;
}

const MAX_RESULTS = 12;

/** Farm (R40): pick characters → total materials, stamina plan, days to finish, gear to farm. */
export function Farm({ game, characters, materials, tag }: Props) {
  const user = useGameData(game.id);
  const chosen = user.farm.map((id) => characters.find((c) => c.id === id) ?? { id, name: id, rarity: 'mid' as const, element: '', role: '' });
  const real = farmPlan(game, user.farm, materials);
  // No material amounts for this game yet: show example rows (clearly marked) once you've picked someone.
  const example = chosen.length > 0 && !real.needs.known;
  const rows = real.needs.known ? real.needs.value : example ? exampleNeeds(game, chosen.length) : [];
  const stamina = example ? known(rows.reduce((sum, r) => sum + (r.stamina.known ? r.stamina.value : 0), 0), 'user') : real.stamina;
  const pool = game.stamina[0];
  const days = daysToFinish(stamina, pool);
  const who = game.terms.character.toLowerCase();

  return (
    <div className={f.stack}>
      {example && (
        <ExampleNotice>
          Your picks are real, but the material rows, stamina needed and days to finish marked EXAMPLE are made up: material amounts for {game.name} aren’t in
          HLITH yet (that part is on us, not you).
        </ExampleNotice>
      )}
      <Picker game={game} characters={characters} chosen={chosen} />

      <div className={f.columns}>
        <section className={f.card} aria-label="Materials">
          <div className={f.cardHead}>
            <h3 className={f.cardTitle}>Materials</h3>
          </div>
          {chosen.length === 0 ? (
            <p className={f.sub}>Pick a {who} above and their materials are added up here.</p>
          ) : (
            <div className={f.tableWrap}>
              <table className={f.table}>
                <thead>
                  <tr>
                    <th>MATERIAL</th>
                    <th className={f.num}>NEED</th>
                    <th className={f.num}>HAVE</th>
                    <th className={f.num}>RUNS</th>
                    <th className={f.num}>STAMINA</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.material}>
                      <td>
                        {r.name} {example && <ExampleTag />}
                      </td>
                      <td className={f.num}>{formatNumber(r.amount)}</td>
                      <td className={f.num}>
                        <NoData />
                      </td>
                      <td className={f.num}>{r.runs.known ? formatNumber(r.runs.value) : <NoData />}</td>
                      <td className={f.num}>{r.stamina.known ? formatNumber(r.stamina.value) : <NoData />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className={f.sub}>What you already have isn’t tracked yet, so every amount is the full need. Crafting lower materials up: no data yet.</p>
        </section>

        <section className={f.card} aria-label="Stamina plan">
          <div className={f.cardHead}>
            <h3 className={f.cardTitle}>Stamina plan</h3>
          </div>
          <div className={f.tiles}>
            {pool ? (
              <StatTile label={`${pool.name} per day`} tag={tag} value={known(formatNumber(perDay(pool)), 'official')} caption={`1 point every ${pool.minutesPerPoint} min · cap ${formatNumber(pool.max)}`} />
            ) : (
              <StatTile label="Stamina per day" tag={tag} value={unknown()} />
            )}
            <StatTile
              label="Stamina needed"
              tag={tag}
              value={stamina.known ? known(formatNumber(stamina.value), stamina.source) : unknown()}
              caption={stamina.known && example ? <ExampleTag /> : undefined}
            />
            <StatTile
              label="Days to finish"
              tag={tag}
              value={days.known ? known(formatNumber(days.value), days.source) : unknown()}
              caption={days.known ? <>spending every point {example && <ExampleTag />}</> : undefined}
            />
          </div>
          <p className={f.sub}>
            Runs × stamina per run ÷ what refills each day. A real total shows only when every material has its drop rate: a partial total would look finished.
          </p>
        </section>
      </div>

      <section className={f.card} aria-label={`${game.terms.gear} to farm`}>
        <div className={f.cardHead}>
          <h3 className={f.cardTitle}>{game.terms.gear} to farm</h3>
        </div>
        {chosen.length === 0 ? (
          <p className={f.sub}>Pick a {who} above to see which {game.terms.gear} to farm for them.</p>
        ) : (
          <div className={f.missing}>
            <NoData />
            <p>
              Recommended {game.terms.gear} come from each {who}’s build, and build data isn’t in HLITH yet. Nothing is suggested rather than guessed.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function Picker({ game, characters, chosen }: { game: GameContract; characters: Character[]; chosen: Character[] }) {
  const user = useGameData(game.id);
  const [query, setQuery] = useState('');
  const ids = new Set(user.farm);
  const q = query.trim().toLowerCase();
  const wanted = characters.filter((c) => user.roster[c.id]?.wanted && !ids.has(c.id));
  const pool = q ? characters.filter((c) => !ids.has(c.id) && c.name.toLowerCase().includes(q)) : wanted.length ? wanted : newest(characters).filter((c) => !ids.has(c.id));
  const results = pool.slice(0, MAX_RESULTS);
  const who = game.terms.character.toLowerCase();
  const element = (c: Character) => game.elements.find((e) => e.id === c.element);
  const role = (c: Character) => game.roles.find((r) => r.id === c.role)?.label;
  const searchId = `farm-search-${game.id}`;

  return (
    <section className={f.card} aria-label={`${game.terms.character}s to farm for`}>
      <div className={f.cardHead}>
        <h3 className={f.cardTitle}>{game.terms.character}s to farm for</h3>
        <span className={f.count}>{chosen.length} chosen</span>
      </div>
      {chosen.length > 0 ? (
        <ul className={f.chosen} aria-label="Chosen">
          {chosen.map((c) => (
            <li key={c.id} className={f.chip}>
              {c.name}
              <button type="button" className={f.remove} aria-label={`Remove ${c.name}`} onClick={() => setFarm(game.id, user.farm.filter((id) => id !== c.id))}>
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={f.sub}>Choose who you’re building next. HLITH adds up what they need and how long it takes to farm.</p>
      )}
      <label className={f.label} htmlFor={searchId}>
        Add a {who}
      </label>
      <input id={searchId} className={f.search} type="search" placeholder={`Search ${characters.length} ${who}s`} value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
      {!q && results.length > 0 && <span className={f.label}>{wanted.length ? 'On your wanted list' : 'Newest'}</span>}
      {results.length > 0 ? (
        <ul className={f.results}>
          {results.map((c) => (
            <li key={c.id}>
              <button type="button" className={f.pick} onClick={() => setFarm(game.id, [...user.farm, c.id])} aria-label={`Add ${c.name}`} title={[element(c)?.label, role(c)].filter(Boolean).join(' · ')}>
                <span className={f.dot} style={{ background: element(c)?.color ?? 'var(--line-empty)' }} aria-hidden="true" />
                <span className={f.pickName}>{c.name}</span>
                <span className={f.rarity} style={{ color: c.rarity === 'top' ? 'var(--rarity-top)' : 'var(--rarity-mid)' }}>
                  {game.terms.rarity[c.rarity]}
                </span>
                <span className={f.plus} aria-hidden="true">
                  +
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={f.sub}>{characters.length === 0 ? `The ${who} list for this game is empty.` : q ? `No ${who} matches “${query}”.` : `Every ${who} is on your list.`}</p>
      )}
    </section>
  );
}

const newest = (cs: Character[]) => [...cs].sort((a, b) => (b.releasedAt ?? '').localeCompare(a.releasedAt ?? '') || a.name.localeCompare(b.name));
