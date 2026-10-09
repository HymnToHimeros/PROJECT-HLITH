import type { GameContract, PullRecord } from '../../core/contract';
import { NoData } from '../../core/ui';
import { luck } from '../pity/pity';
import { Ex } from './shared';
import p from './pulls.module.css';

/** Luck report (Override 3: a card inside History): average pity and 50/50 record per banner type. */
export function LuckReport({ game, history, example }: { game: GameContract; history: PullRecord[]; example: boolean }) {
  const rows = game.bannerTypes
    .map((t) => ({
      type: t,
      stats: luck(history, t.id),
      count: history.filter((h) => h.bannerType === t.id).length,
    }))
    .filter((r) => r.count > 0);
  return (
    <article className={p.card} aria-label="Luck report">
      <div className={p.cardHead}>
        <div>
          <div className={p.kind}>Luck report</div>
          <h3 className={p.cardTitle}>
            <Ex example={example}>How lucky you've been</Ex>
          </h3>
        </div>
      </div>
      {rows.length === 0 ? (
        <NoData fix="import-history" />
      ) : (
        <div className={p.tableWrap}>
          <table className={p.table}>
            <thead>
              <tr>
                <th>Banner</th>
                <th className={p.num}>Pulls</th>
                <th className={p.num}>{game.terms.rarity.top}</th>
                <th className={p.num}>Avg pity</th>
                <th className={p.num}>50/50 won · lost</th>
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
      <span className={p.muted}>Average pity = pulls per {game.terms.rarity.top} result. Guaranteed results don't count as a 50/50.</span>
    </article>
  );
}
