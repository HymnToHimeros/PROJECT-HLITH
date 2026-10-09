import type { GameContract, PullRecord } from '../../core/contract';
import { formatNumber } from '../../core/time/format';
import { ExampleTag } from '../../core/ui';
import { luck } from '../pity/pity';
import { EmptyTile, Tile } from './shared';
import k from './kit.module.css';
import p from './pulls.module.css';

/**
 * Luck report (Override 3: a card inside History). The design's four tiles:
 * average pity, 50/50 won, free vs paid pulls, cost per top result; then a row
 * per banner type. Free vs paid stays empty: history files don't say which
 * pulls were paid for.
 */
export function LuckReport({ game, history, example }: { game: GameContract; history: PullRecord[]; example: boolean }) {
  const top = game.terms.rarity.top;
  const rows = game.bannerTypes
    .map((t) => ({ type: t, stats: luck(history, t.id), count: history.filter((h) => h.bannerType === t.id).length }))
    .filter((r) => r.count > 0);
  // Averages over every banner type together.
  const tops = rows.reduce((a, r) => a + r.stats.tops, 0);
  const pullsToTops = rows.reduce((a, r) => a + (r.stats.averagePity.known ? r.stats.averagePity.value * r.stats.tops : 0), 0);
  const avg = tops > 0 ? pullsToTops / tops : null;
  const won = rows.reduce((a, r) => a + r.stats.fiftyFifty.won, 0);
  const lost = rows.reduce((a, r) => a + r.stats.fiftyFifty.lost, 0);
  const premium = game.currencies.find((c) => c.perPull && !c.paid);

  return (
    <section className={p.card} aria-label="Luck report">
      <div className={p.calcHead}>
        <h3 className={p.cardTitle}>Luck report</h3>
        {example && history.length > 0 && <ExampleTag />}
      </div>
      <div className={k.tiles}>
        {avg === null ? <EmptyTile label={`Average ${top} pity`} why="needs History" /> : <Tile label={`Average ${top} pity`} value={avg.toFixed(1)} caption={`pulls per ${top} · ${tops} so far`} />}
        {won + lost === 0 ? (
          <EmptyTile label="50/50 won" why="needs History" />
        ) : (
          <Tile label="50/50 won" value={`${won}/${won + lost}`} caption={`${Math.round((won / (won + lost)) * 100)}% · guaranteed results don't count`} />
        )}
        <EmptyTile label="Free vs paid pulls" why="history files don't say which pulls were paid" />
        {avg === null || !premium?.perPull ? (
          <EmptyTile label={`Cost per ${top}`} why="needs History" />
        ) : (
          <Tile label={`Cost per ${top}`} value={formatNumber(Math.round(avg * premium.perPull))} caption={`${premium.name} on average (${premium.perPull} per pull)`} />
        )}
      </div>
      {rows.length > 0 && (
        <div className={p.tableWrap} tabIndex={0} role="region" aria-label="Luck per banner">
          <table className={p.table}>
            <thead>
              <tr>
                <th scope="col">BANNER</th>
                <th scope="col" className={p.num}>
                  PULLS
                </th>
                <th scope="col" className={p.num}>
                  {top}
                </th>
                <th scope="col" className={p.num}>
                  AVG PITY
                </th>
                <th scope="col" className={p.num}>
                  50/50 WON · LOST
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ type, stats, count }) => {
                const ff = stats.fiftyFifty;
                const played = ff.won + ff.lost;
                return (
                  <tr key={type.id}>
                    <td>{type.label}</td>
                    <td className={p.num}>{count}</td>
                    <td className={p.num}>{stats.tops}</td>
                    <td className={p.num}>{stats.averagePity.known ? stats.averagePity.value.toFixed(1) : '—'}</td>
                    <td className={p.num}>
                      {played === 0 ? '—' : `${ff.won} · ${ff.lost}`}
                      {ff.unknown > 0 && <span className={p.muted}> ({ff.unknown} unknown)</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <span className={p.muted}>Average pity = pulls per {top} result. Guaranteed results don't count as a 50/50.</span>
    </section>
  );
}
