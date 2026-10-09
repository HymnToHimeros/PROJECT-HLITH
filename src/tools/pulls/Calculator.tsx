import type { GameContract } from '../../core/contract';
import { setPaidExtras } from '../../core/data/userData';
import { formatNumber } from '../../core/time/format';
import { formatDate } from '../../core/time/reset';
import { NoData } from '../../core/ui';
import { budget, budgetPulls, type RowStatus } from '../budget/budget';
import { Ex } from './shared';
import p from './pulls.module.css';
import type { PullsData } from './usePullsData';

const STATUS: Record<RowStatus, string> = {
  counted: '',
  'already-earned': 'already earned',
  skipped: 'skipped',
  'skipped-backlog': 'counted in Backlog',
  'off-paid': 'paid extra, off',
  'not-active': 'not active',
  'no-data': 'no data',
};

/** Calculator: everything you can still earn until the version ends, by source. */
export function Calculator({ game, data, serverId, now }: { game: GameContract; data: PullsData; serverId: string | undefined; now: number }) {
  const until = data.versionEnd.at;
  const b = budget({
    game,
    serverId,
    now,
    until,
    bank: data.bank.value,
    paidExtras: data.user.paidExtras,
    passes: Object.fromEntries(Object.entries(data.user.passes).map(([k, v]) => [k, Date.parse(v)])),
  });
  const main = game.bannerTypes.find((t) => t.target === 'character');
  const pulls = main ? budgetPulls(game, b, main.id) : null;
  const name = (id: string) => game.currencies.find((c) => c.id === id)?.name ?? id;

  return (
    <div className={p.stack}>
      <p className={p.message}>
        Budget until the version ends: <Ex example={data.versionEnd.example}>{formatDate(until)}</Ex>
      </p>
      <label className={p.toggle}>
        <input type="checkbox" checked={data.user.paidExtras} onChange={(e) => setPaidExtras(game.id, e.target.checked)} />
        Count paid extras (monthly pass and similar)
      </label>
      <div className={p.tableWrap}>
        <table className={p.table}>
          <thead>
            <tr>
              <th>SOURCE</th>
              <th className={p.num}>TIMES</th>
              <th className={p.num}>AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                Bank now <span className={p.muted}>from your Bank log</span>
              </td>
              <td className={p.num}>—</td>
              <td className={p.num}>
                {data.bank.value.known ? (
                  <Ex example={data.bank.example}>
                    {Object.entries(data.bank.value.value)
                      .map(([c, v]) => `${formatNumber(v)} ${name(c)}`)
                      .join(' · ')}
                  </Ex>
                ) : (
                  <NoData dash={false} fix="enter-manually" />
                )}
              </td>
            </tr>
            {b.rows.map((r) => (
              <tr key={r.id}>
                <td>
                  {r.label} <span className={p.muted}>{r.source}</span>
                  {r.status !== 'counted' && (
                    <div className={p.muted}>
                      {STATUS[r.status]}
                      {r.reason ? ` · ${r.reason}` : ''}
                    </div>
                  )}
                </td>
                <td className={p.num}>{r.status === 'counted' ? `×${r.occurrences}` : '—'}</td>
                <td className={p.num}>{r.status === 'counted' ? `${formatNumber(r.amount)} ${name(r.currency)}` : r.status === 'no-data' ? <NoData dash={false} /> : '—'}</td>
              </tr>
            ))}
            <tr className={p.totalRow}>
              <td>Pulls by version end{main ? ` (${main.label})` : ''}</td>
              <td className={p.num} />
              <td className={p.num}>{pulls?.known ? <Ex example={data.bank.example}>{formatNumber(pulls.value)}</Ex> : <NoData dash={false} fix="enter-manually" />}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {b.leftOut.length > 0 && <p className={p.muted}>Rows with no data are left out of the total: {b.leftOut.join(', ')}.</p>}
    </div>
  );
}
