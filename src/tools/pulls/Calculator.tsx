import { useState, type CSSProperties, type ReactNode } from 'react';
import type { GameContract } from '../../core/contract';
import { setBacklogCategory, setPaidRow, setPass } from '../../core/data/userData';
import { formatNumber } from '../../core/time/format';
import { formatDate } from '../../core/time/reset';
import { ExampleTag, GameTag, NoData, Timer } from '../../core/ui';
import { cx } from '../../core/ui/cx';
import { budget, budgetPulls, pullsFor, type Budget, type BudgetInput, type BudgetRow } from '../budget/budget';
import { pullsOf } from '../backlog/backlog';
import { Filters, Switch } from './shared';
import p from './pulls.module.css';
import type { PullsData } from './usePullsData';

interface Props {
  game: GameContract;
  data: PullsData;
  serverId: string | undefined;
  now: number;
  tagged: boolean;
  openModule: (module: 'events' | 'backlog') => void;
  /** Switch Pulls tab (the "Add it" fix opens the Bank log). */
  openTab: (tab: string) => void;
}

/**
 * Calculator (design: "Budget to version end"): every source of pulls until
 * the version ends, as pulls, with the amount under it. Paid extras and Backlog
 * categories switch on and off here. Rows with no data are left out of the
 * total and say why. A second card compares free vs paid income (V1 feature).
 * While the version end is unknown you count to the last banner end or a date
 * you pick (kept on this screen, shown as your choice).
 */
export function Calculator({ game, data, serverId, now, tagged, openModule, openTab }: Props) {
  // Version end unknown (no version list, examples hidden): you pick the end date. Screen state only, labelled as your choice.
  const [choice, setChoice] = useState<'banner' | 'date'>('banner');
  const [picked, setPicked] = useState('');
  const lastBannerEnd = data.banners.list
    .filter((x) => !data.banners.exampleIds.has(x.id))
    .map((x) => Date.parse(x.end))
    .filter((t) => t > now)
    .reduce<number | null>((a, t) => (a === null || t > a ? t : a), null);
  const pickedAt = picked ? new Date(`${picked}T23:59:00`).getTime() : null;
  const versionKnown = data.versionEnd.at !== null;
  const until = data.versionEnd.at ?? (choice === 'banner' ? lastBannerEnd : pickedAt !== null && pickedAt > now ? pickedAt : null);
  const input = (until: number, paidExtras: boolean): BudgetInput => ({
    game,
    serverId,
    now,
    until,
    bank: data.bank.value,
    paidExtras,
    paidOff: data.user.paidOff,
    passes: Object.fromEntries(Object.entries(data.user.passes).map(([k, v]) => [k, Date.parse(v)])),
    ...data.budgetExtras(until),
  });
  const b = until === null ? null : budget(input(until, data.user.paidExtras));
  const main = game.bannerTypes.find((t) => t.target === 'character') ?? game.bannerTypes[0];
  const total = b && main ? budgetPulls(game, b, main.id) : null;
  const premium = game.currencies.find((c) => c.perPull && !c.paid);
  const name = (id: string) => game.currencies.find((c) => c.id === id)?.name ?? id;
  /** Pulls an amount is worth on the main banner; null when the currency isn't for pulls. */
  const asPulls = (currency: string, amount: number): number | null => {
    const c = game.currencies.find((x) => x.id === currency);
    if (!c) return null;
    if (c.perPull && !c.paid) return amount / c.perPull;
    if (main && c.pullItemFor?.includes(main.id)) return amount;
    return null;
  };
  const premiumEquivalent = (amounts: Record<string, number>) => {
    if (!premium?.perPull) return null;
    let sum = 0;
    for (const [c, v] of Object.entries(amounts)) {
      const pulls = asPulls(c, v);
      if (pulls !== null) sum += pulls * premium.perPull;
    }
    return sum;
  };
  const income = new Map(game.income.map((r) => [r.id, r]));
  const bank = data.bank.value;
  const ex = data.bank.example;
  const toLog = () => openTab('log');
  /** One switch for every paid extra (your saved setting is one on/off), shown on each paid row. */
  const paidOn = (rowId: string) => data.user.paidExtras && !(data.user.paidOff ?? []).includes(rowId);
  /** Each paid extra has its own switch (e.g. count the monthly pass but not the battle pass). */
  const paidSwitch = (rowId: string, label: string) => <Switch checked={paidOn(rowId)} onChange={(on) => setPaidRow(game.id, rowId, on)} label={`Count paid extra: ${label}`} />;

  const rows: ReactNode[] = [];
  // Bank now
  rows.push(
    <Row
      key="bank"
      label="Bank now"
      sub={
        bank.known ? (
          <>
            {Object.entries(bank.value)
              .map(([c, v]) => `${formatNumber(v)} ${name(c)}`)
              .join(' + ')}{' '}
            {ex && <ExampleTag />}
          </>
        ) : (
          'from your Bank log'
        )
      }
      value={bank.known && main ? <span className={p.rowValue}>+{formatNumber(pullsFor(game, bank.value, main.id))}</span> : <NoData dash={false} fix="enter-manually" onFix={toLog} />}
      small={bank.known ? fmtSmall(premiumEquivalent(bank.value)) : ''}
    />,
  );

  if (b === null) {
    // No end date yet: the paid-extras switch still works; every other row needs a date to count to.
    for (const def of game.income.filter((r) => r.paid)) {
      rows.push(
        <Row
          key={def.id}
          toggle={paidSwitch(def.id, def.label)}
          label={def.label}
          sub="Paid extra · pick an end date above to count it"
          value={<span className={p.off}>{paidOn(def.id) ? 'On' : 'Off'}</span>}
        />,
      );
    }
  } else {
    // Income rows from the game record, one by one.
    for (const r of b.rows.filter((x) => x.source !== 'events' && x.source !== 'login' && x.source !== 'backlog')) {
      const def = income.get(r.id);
      const paid = def?.paid ?? false;
      const isPass = def?.schedule.kind === 'pass';
      rows.push(
        <Row
          key={r.id}
          toggle={paid ? paidSwitch(r.id, r.label) : undefined}
          label={r.label}
          sub={
            <>
              {paid ? 'Paid extra · ' : ''}
              {describe(r, name)}
              {isPass && paidOn(r.id) && (
                <>
                  {' · '}
                  <label className={p.passDate}>
                    runs out on{' '}
                    <input
                      type="date"
                      className={p.dateInput}
                      value={data.user.passes[r.id]?.slice(0, 10) ?? ''}
                      onChange={(e) => setPass(game.id, r.id, e.target.value ? new Date(`${e.target.value}T23:59:00`).toISOString() : null)}
                    />
                  </label>
                </>
              )}
            </>
          }
          value={valueOf(r, asPulls)}
          small={r.status === 'counted' ? `${formatNumber(r.amount)} ${name(r.currency)}` : ''}
        />,
      );
    }

    // Events and login events, grouped as in the design.
    if (data.notCounted.includes('Events')) {
      rows.push(
        <Row
          key="events"
          label="Events"
          sub="Event list is still an example, so it isn't counted"
          value={<NoData dash={false} />}
          action={{ label: 'Open Events', onClick: () => openModule('events') }}
        />,
      );
    } else {
      rows.push(<Group key="events" label="Events" rows={b.rows.filter((x) => x.source === 'events')} asPulls={asPulls} onOpen={() => openModule('events')} />);
      rows.push(<Group key="login" label="Login events" rows={b.rows.filter((x) => x.source === 'login')} asPulls={asPulls} onOpen={() => openModule('events')} />);
    }

    // Backlog: one switch per category (the same switches as in Backlog).
    if (data.notCounted.includes('Backlog')) {
      rows.push(
        <Row
          key="backlog"
          label="Backlog rewards"
          sub="Backlog list is still an example, so it isn't counted"
          value={<NoData dash={false} />}
          action={{
            label: 'Open Backlog',
            onClick: () => openModule('backlog'),
          }}
        />,
      );
    } else {
      // Categories that give nothing (a checklist only) get no row: there is nothing to switch.
      const withRewards = data.backlogCats.filter((c) => c.items.some((v) => v.item.reward !== 0));
      if (withRewards.length === 0) {
        rows.push(
          <Row
            key="backlog"
            label="Backlog"
            sub={data.backlogCats.length ? 'only checklists so far, nothing with a reward' : 'no items yet · add your own in Backlog'}
            value={<NoData dash={false} />}
            action={{
              label: 'Open Backlog',
              onClick: () => openModule('backlog'),
            }}
          />,
        );
      }
      for (const c of withRewards) {
        const row = b.rows.find((x) => x.id === `backlog:${c.id}`);
        // What it would add if counted: as pulls, with each amount named.
        const amounts = Object.entries(c.rewardLeft).filter(([, v]) => v > 0);
        const potential = amounts.length
          ? `about ${formatNumber(pullsOf(game, c.rewardLeft))} pulls (${amounts.map(([cur, v]) => `${formatNumber(v)} ${name(cur)}`).join(' + ')}) left if you count it`
          : 'no data yet on what is left';
        rows.push(
          <Row
            key={`backlog:${c.id}`}
            toggle={<Switch checked={c.enabled} onChange={(on) => setBacklogCategory(game.id, c.id, on)} label={`Count Backlog: ${c.label}`} />}
            label={`Backlog · ${c.label}`}
            sub={c.enabled ? 'One-time rewards still open · switched on in Backlog' : `Switched off · ${potential}`}
            value={row ? valueOf(row, asPulls) : c.enabled ? <NoData dash={false} /> : <span className={p.off}>Off</span>}
            small={row?.status === 'counted' ? `${formatNumber(row.amount)} ${name(row.currency)}` : ''}
          />,
        );
      }
    }
  }

  const known = b?.total.known ? premiumEquivalent(b.total.value) : null;

  return (
    <div className={p.calcGrid} style={{ '--vent': game.vent } as CSSProperties}>
      <section className={p.card} aria-label="Budget to version end">
        <div className={p.calcHead}>
          <h3 className={p.cardTitle}>{versionKnown ? 'Budget to version end' : 'Budget to the date you choose'}</h3>
          {tagged && <GameTag label={game.short} vent={game.vent} />}
        </div>
        {versionKnown && until !== null ? (
          <span className={p.range}>
            Version ends {formatDate(until)} · <Timer to={until} prefix="in" /> {data.versionEnd.example && <ExampleTag />}
          </span>
        ) : (
          <div className={p.stack}>
            <span className={p.range}>
              Version end: <NoData dash={false} />
            </span>
            <Filters
              label="Which end date to count to"
              value={choice}
              onChange={setChoice}
              options={[
                {
                  id: 'banner',
                  label: lastBannerEnd === null ? 'Last banner end · none listed' : `Last banner end · ${formatDate(lastBannerEnd)}`,
                },
                { id: 'date', label: 'A date I pick' },
              ]}
            />
            {choice === 'date' && (
              <label className={p.passDate}>
                Count until <input type="date" className={p.dateInput} min={new Date(now).toLocaleDateString('en-CA')} value={picked} onChange={(e) => setPicked(e.target.value)} />
              </label>
            )}
            <span className={p.small}>
              {until !== null
                ? `Counting until ${formatDate(until)}: your choice, not the version end (${game.short}’s version list isn’t added yet).`
                : choice === 'banner'
                  ? 'No banner end date is listed yet. Pick a date to count to.'
                  : 'Pick a date after today to count dailies, events and the rest.'}
            </span>
          </div>
        )}
        <div className={p.rows}>{rows}</div>
        <div className={p.totalLine}>
          <div className={p.totalText}>
            <span className={p.totalLabel}>Known total</span>
            <span className={p.small}>
              {b === null
                ? 'needs an end date to count to'
                : `${known !== null && premium ? `${formatNumber(Math.round(known))} ${premium.name} worth · ` : ''}rows with no data are left out${b.leftOut.length > 0 ? ` (${b.leftOut.length})` : ''}`}
            </span>
          </div>
          <div className={p.totalFigure}>
            {total?.known ? (
              <>
                <span className={p.totalValue}>{formatNumber(total.value)}</span>
                <span className={p.muted}>pulls</span>
                {ex && <ExampleTag />}
              </>
            ) : !bank.known ? (
              <NoData fix="enter-manually" onFix={toLog} />
            ) : (
              <NoData />
            )}
          </div>
        </div>
      </section>
      {until !== null && <SpendingCard game={game} free={budget(input(until, false))} paid={budget(input(until, true))} mainId={main?.id} example={ex} paidOn={data.user.paidExtras && game.income.some((r) => r.paid && paidOn(r.id))} />}
    </div>
  );
}

const fmtSmall = (n: number | null) => (n === null ? '' : formatNumber(Math.round(n)));

function describe(r: BudgetRow, name: (id: string) => string): string {
  switch (r.status) {
    case 'counted':
      return r.occurrences > 1 ? `${r.occurrences} × ${formatNumber(Math.round(r.amount / r.occurrences))} ${name(r.currency)}` : `${formatNumber(r.amount)} ${name(r.currency)}`;
    case 'already-earned':
      return 'already earned this period';
    case 'skipped-backlog':
      return 'counted under its Backlog category instead';
    case 'off-paid':
      return 'switched off';
    case 'not-active':
      return 'not active · no pass end date saved';
    case 'skipped':
      return 'skipped';
    case 'no-data':
      return `no data · ${r.reason ?? 'not known yet'}`;
  }
}

function valueOf(r: BudgetRow, asPulls: (c: string, n: number) => number | null): ReactNode {
  if (r.status === 'no-data') return <NoData dash={false} />;
  if (r.status === 'off-paid' || r.status === 'not-active') return <span className={p.off}>Off</span>;
  if (r.status !== 'counted') return <span className={p.off}>—</span>;
  const n = asPulls(r.currency, r.amount);
  return n === null ? <span className={p.rowValue}>+{formatNumber(r.amount)}</span> : <span className={p.rowValue}>+{formatNumber(Math.floor(n + 1e-9))}</span>;
}

function Row({ label, sub, value, small, toggle, action }: { label: string; sub: ReactNode; value: ReactNode; small?: string; toggle?: ReactNode; action?: { label: string; onClick: () => void } }) {
  return (
    <div className={p.row}>
      {toggle}
      <div className={p.rowMain}>
        <span className={p.rowLabel}>{label}</span>
        <span className={p.rowSub}>{sub}</span>
        {action && (
          <button type="button" className={p.linkButton} onClick={action.onClick}>
            {action.label}
          </button>
        )}
      </div>
      <div className={p.rowEnd}>
        {value}
        {small ? <span className={p.small}>{small}</span> : null}
      </div>
    </div>
  );
}

/** Events or login events as one row: counted total, plus how many are earned, skipped or unknown. */
function Group({ label, rows, asPulls, onOpen }: { label: string; rows: BudgetRow[]; asPulls: (c: string, n: number) => number | null; onOpen: () => void }) {
  if (rows.length === 0) return null;
  const counted = rows.filter((r) => r.status === 'counted');
  const noData = rows.filter((r) => r.status === 'no-data');
  const earned = rows.filter((r) => r.status === 'already-earned').length;
  const skipped = rows.filter((r) => r.status === 'skipped').length;
  let pulls = 0;
  let any = false;
  for (const r of counted) {
    const n = asPulls(r.currency, r.amount);
    if (n !== null) {
      pulls += n;
      any = true;
    }
  }
  const parts = [`${counted.length} still open`, earned ? `${earned} done` : '', skipped ? `${skipped} skipped` : '', noData.length ? `${noData.length} with no data` : ''].filter(Boolean);
  return (
    <div className={p.row}>
      <div className={p.rowMain}>
        <span className={p.rowLabel}>{label}</span>
        <span className={p.rowSub}>{parts.join(' · ')}</span>
        <ul className={p.groupList}>
          {rows.map((r) => (
            <li key={r.id}>
              {r.label} · {r.status === 'counted' ? `+${formatNumber(r.amount)}` : r.status === 'no-data' ? 'no data yet' : r.status === 'already-earned' ? 'done' : 'skipped'}
            </li>
          ))}
        </ul>
        <button type="button" className={p.linkButton} onClick={onOpen}>
          Mark done or skipped in Events
        </button>
      </div>
      <div className={p.rowEnd}>{any ? <span className={p.rowValue}>+{formatNumber(Math.floor(pulls + 1e-9))}</span> : noData.length ? <NoData dash={false} /> : <span className={p.off}>—</span>}</div>
    </div>
  );
}

/** V1: what this version gives free vs with paid extras. Same engine, two runs. */
function SpendingCard({ game, free, paid, mainId, example, paidOn }: { game: GameContract; free: Budget; paid: Budget; mainId: string | undefined; example: boolean; paidOn: boolean }) {
  const f = mainId ? budgetPulls(game, free, mainId) : null;
  const pd = mainId ? budgetPulls(game, paid, mainId) : null;
  const hasPaid = game.income.some((r) => r.paid);
  // Passes count only from a saved end date; say which ones are missing it instead of quietly leaving them out.
  const noDate = paid.rows.filter((r) => r.status === 'not-active').map((r) => r.label);
  return (
    <section className={p.card} aria-label="Free or paid">
      <h3 className={p.cardTitle}>Free or paid</h3>
      <span className={p.muted}>Total pulls by the end date, the same sums as on the left.</span>
      <div className={p.spend}>
        <div className={cx(p.spendTile)}>
          <span className={p.figLabel}>Free only</span>
          {f?.known ? <span className={p.figValue}>{formatNumber(f.value)}</span> : <NoData />}
        </div>
        <div className={p.spendTile}>
          <span className={p.figLabel}>With paid extras</span>
          {!hasPaid ? <span className={p.muted}>This game has no paid extras listed</span> : pd?.known ? <span className={p.figValue}>{formatNumber(pd.value)}</span> : <NoData />}
        </div>
      </div>
      {noDate.length > 0 && (
        <span className={p.muted}>
          “With paid extras” leaves out {noDate.join(' and ')}: set your pass end date
          {paidOn ? ' on the left (“runs out on”)' : ' (switch paid extras on, then fill in “runs out on” on the left)'} to count it.
        </span>
      )}
      {example && (
        <span className={p.muted}>
          Uses the example bank <ExampleTag />
        </span>
      )}
    </section>
  );
}
