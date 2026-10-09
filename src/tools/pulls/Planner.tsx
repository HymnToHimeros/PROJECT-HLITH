import type { GameContract } from '../../core/contract';
import { formatNumber } from '../../core/time/format';
import { formatRange } from '../../core/time/reset';
import { EmptyState, NoData, Timer } from '../../core/ui';
import { budget, budgetPulls, pullsFor, type BudgetRow } from '../budget/budget';
import { chance, pityFromHistory, worstCase } from '../pity/pity';
import { Ex, percent } from './shared';
import p from './pulls.module.css';
import type { PullsData } from './usePullsData';

interface Props {
  game: GameContract;
  data: PullsData;
  serverId: string | undefined;
  now: number;
}

/** Planner: per banner, pulls now and by its end, chance (official + community) and worst case. */
export function Planner({ game, data, serverId, now }: Props) {
  const banners = data.banners.list.filter((b) => Date.parse(b.end) > now);
  if (banners.length === 0) {
    return <EmptyState title="No banners yet" body="No upcoming banners are listed for this game yet. They appear here as soon as the list has them." />;
  }
  return (
    <div className={p.grid}>
      {banners.map((b) => {
        const type = game.bannerTypes.find((t) => t.id === b.type);
        if (!type) return null;
        const example = data.banners.example;
        const bankExample = data.bank.example;
        const haveNow = data.bank.value.known ? pullsFor(game, data.bank.value.value, type.id) : null;
        const byEnd = budget({
          game,
          serverId,
          now,
          until: Date.parse(b.end),
          bank: data.bank.value,
          paidExtras: data.user.paidExtras,
          passes: Object.fromEntries(Object.entries(data.user.passes).map(([k, v]) => [k, Date.parse(v)])),
          ...data.budgetExtras(Date.parse(b.end)),
        });
        const pullsByEnd = budgetPulls(game, byEnd, type.id);
        const pity = pityFromHistory(data.history.list, type.id);
        const state = {
          pulls: pity.pity.known ? pity.pity.value : 0,
          guaranteed: pity.guaranteed.known ? pity.guaranteed.value : false,
        };
        const stateKnown = pity.pity.known && pity.guaranteed.known;
        const worst = worstCase(type.pity, state);
        const n = pullsByEnd.known ? pullsByEnd.value : 0;
        const official = stateKnown && pullsByEnd.known ? chance(type.pity, state, n, 'official') : null;
        const community = stateKnown && pullsByEnd.known ? chance(type.pity, state, n, 'community') : null;
        const fromExamples = bankExample || data.history.example;
        return (
          <article key={b.id} className={p.card}>
            <div className={p.cardHead}>
              <div>
                <div className={p.kind}>{type.label}</div>
                <h3 className={p.cardTitle}>
                  <Ex example={example}>{b.title}</Ex>
                </h3>
                <div className={p.kind}>
                  {formatRange(Date.parse(b.start), Date.parse(b.end))} · <Timer to={Date.parse(b.end)} deadline prefix="ends in" />
                </div>
              </div>
            </div>
            <div className={p.figures}>
              <Figure label="Have now" example={bankExample} value={haveNow === null ? null : formatNumber(haveNow)} />
              <Figure label="By end" example={bankExample} value={pullsByEnd.known ? formatNumber(pullsByEnd.value) : null} />
              <Figure label="Worst case" example={data.history.example} value={worst.known ? formatNumber(worst.value) : null} />
            </div>
            <div className={p.odds}>
              <div className={p.oddsRow}>
                <span>Chance by end · official rates</span>
                <span className={p.oddsValue}>{official?.known ? percent(official.value) : <NoData dash={false} fix="import-history" />}</span>
              </div>
              <div className={p.oddsRow}>
                <span>· with community data</span>
                <span className={p.oddsValue}>{community?.known ? percent(community.value) : <span className={p.muted}>not available</span>}</span>
              </div>
              {pity.pity.known && (
                <span className={p.muted}>
                  Pity {state.pulls}/{type.pity.kind === 'hard-pity' ? type.pity.hardPity : '—'}
                  {pity.guaranteed.known ? (state.guaranteed ? ' · next is guaranteed' : ' · 50/50 to play') : ' · 50/50 status unknown'}
                  {fromExamples ? ' (example)' : ''}
                </span>
              )}
            </div>
            <Verdict worst={worst.known ? worst.value : null} byEnd={pullsByEnd.known ? pullsByEnd.value : null} official={official?.known ? official.value : null} />
            <LeftOut rows={byEnd.rows} />
          </article>
        );
      })}
    </div>
  );
}

/** Rows the budget couldn't count, grouped by why (e.g. "choose your server"). */
function LeftOut({ rows }: { rows: BudgetRow[] }) {
  const byReason = new Map<string, string[]>();
  for (const r of rows) if (r.status === 'no-data') byReason.set(r.reason ?? 'no data', [...(byReason.get(r.reason ?? 'no data') ?? []), r.label]);
  return [...byReason].map(([reason, labels]) => (
    <span key={reason} className={p.muted}>
      Not counted ({reason}): {labels.join(', ')}
    </span>
  ));
}

function Figure({ label, value, example }: { label: string; value: string | null; example: boolean }) {
  return (
    <div className={p.figure}>
      <span className={p.figLabel}>{label}</span>
      {value === null ? (
        <NoData />
      ) : (
        <Ex example={example}>
          <span className={p.figValue}>{value}</span>
        </Ex>
      )}
    </div>
  );
}

function Verdict({ worst, byEnd, official }: { worst: number | null; byEnd: number | null; official: number | null }) {
  if (worst !== null && byEnd !== null && byEnd >= worst) return <span className={p.verdict}>Guaranteed by the end, even with the worst luck.</span>;
  if (official !== null && byEnd !== null && worst !== null)
    return <span className={p.verdict}>Not guaranteed: {formatNumber(Math.max(0, worst - byEnd))} pulls short of the worst case.</span>;
  return null;
}
