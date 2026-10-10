import { useState, type CSSProperties } from 'react';
import type { GameContract, GameEvent } from '../../core/contract';
import { known } from '../../core/contract/known';
import { setEventProgress, type EventProgress, type GameUserData } from '../../core/data/userData';
import { formatNumber } from '../../core/time/format';
import { formatRange } from '../../core/time/reset';
import { Button, ExampleTag, NoData, ProgressBar, Timer, UnverifiedTag } from '../../core/ui';
import { cx } from '../../core/ui/cx';
import type { BudgetRow } from '../budget/budget';
import { pullsOf } from '../backlog/backlog';
import { EmptyTile, Filters, Tile } from '../pulls/shared';
import k from '../pulls/kit.module.css';
import { countsBefore, cycles, eventsBudget, groupEvents, groupOf, progressOf, type Cycle } from './events';
import e from './events.module.css';
import type { EventsData } from './useEventsData';

const KIND: Record<GameEvent['kind'], string> = { event: 'Event', login: 'Login', web: 'Web', endgame: 'Endgame', bonus: 'Bonus' };
const STATES: { id: EventProgress['state']; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'done', label: 'Done' },
  { id: 'skipped', label: 'Skip' },
];
/** Above this many days a login event shows a bar instead of one button per day. */
const MAX_PIPS = 14;

interface Props {
  game: GameContract;
  data: EventsData;
  serverId: string | undefined;
  now: number;
  onChooseServer: () => void;
}

type Filter = 'all' | 'soon' | 'event' | 'login' | 'endgame' | 'bonus';
const SOON = 4 * 86_400_000;

/**
 * Events (R29, design: tiles over one list with Open / Done / Skip): events,
 * login events and endgame cycles with your state and login days claimed.
 * Live first (ending soonest), then endgame cycles, then upcoming; ended ones
 * folded away. V1 features: filter by ending soon / limited / login / endgame /
 * bonuses, rewards shown as pulls.
 */
export function Events({ game, data, serverId, now, onChooseServer }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const list = data.events.list;
  // Version end unknown (examples hidden): count up to the last listed event's end.
  const until = data.versionEnd.at ?? Math.max(now, ...list.map((ev) => Date.parse(ev.end)).filter(Number.isFinite));
  const example = data.events.example;
  const b = eventsBudget(game, list, data.user, now, until, serverId);
  const rows = new Map(b.rows.map((r) => [r.id, r]));
  const groups = groupEvents(list, now);
  const name = (id: string) => game.currencies.find((c) => c.id === id)?.name ?? id;
  const keep = (ev: GameEvent) =>
    filter === 'all' ||
    (filter === 'soon' && groupOf(ev, now) === 'live' && Date.parse(ev.end) - now < SOON) ||
    (filter === 'event' && (ev.kind === 'event' || ev.kind === 'web')) ||
    ev.kind === filter;
  const item = (ev: GameEvent) => (
    <EventItem
      key={ev.id}
      game={game}
      ev={ev}
      now={now}
      until={until}
      user={data.user}
      example={example}
      row={rows.get(`event:${ev.id}`) ?? rows.get(`login:${ev.id}`)}
      currency={name(ev.currency)}
      onChooseServer={onChooseServer}
    />
  );
  const live = groups.live.filter(keep);
  const upcoming = groups.upcoming.filter(keep);
  const cycleList = filter === 'all' || filter === 'endgame' ? cycles(game, now) : [];
  const empty = live.length === 0 && upcoming.length === 0 && cycleList.length === 0;

  return (
    <div className={e.stack} style={{ '--vent': game.vent } as CSSProperties}>
      <Tiles game={game} data={data} groups={groups} income={b.income} leftOut={b.leftOut} />
      <Filters
        label="Show events"
        value={filter}
        onChange={setFilter}
        options={[
          { id: 'all', label: 'All' },
          { id: 'soon', label: 'Ending soon' },
          { id: 'event', label: 'Limited' },
          { id: 'login', label: 'Login' },
          { id: 'endgame', label: 'Endgame' },
          { id: 'bonus', label: 'Bonuses' },
        ]}
      />
      {empty ? (
        <p className={e.muted}>{filter === 'all' ? 'No events are listed yet.' : 'Nothing in this filter right now.'}</p>
      ) : (
        <ul className={e.list} aria-label="Events">
          {live.map(item)}
          {cycleList.map((c) => (
            <CycleItem key={c.row.id} game={game} cycle={c} user={data.user} currency={name} />
          ))}
          {upcoming.map(item)}
        </ul>
      )}

      {groups.ended.length > 0 && filter === 'all' && (
        <details className={e.ended}>
          <summary className={e.endedSummary}>
            <span className="t-label">Ended</span>
            <span className={e.count}>{groups.ended.length}</span>
          </summary>
          <ul className={e.list}>{groups.ended.map(item)}</ul>
        </details>
      )}

      {b.leftOut.length > 0 && <p className={e.muted}>Not counted in “Rewards left” (no data yet): {b.leftOut.join(', ')}.</p>}
    </div>
  );
}

function Tiles({
  game,
  data,
  groups,
  income,
  leftOut,
}: {
  game: GameContract;
  data: EventsData;
  groups: ReturnType<typeof groupEvents>;
  income: Record<string, number>;
  leftOut: string[];
}) {
  const ex = data.events.example;
  const user = data.user;
  const openCount = [...groups.live, ...groups.upcoming].filter((x) => !x.leak && progressOf(user, x.id).state === 'open').length;
  const logins = groups.live.filter((x) => x.kind === 'login' && x.loginDays);
  const claimed = logins.reduce((a, x) => a + Math.min(x.loginDays ?? 0, progressOf(user, x.id).daysClaimed ?? 0), 0);
  const days = logins.reduce((a, x) => a + (x.loginDays ?? 0), 0);
  const name = (id: string) => game.currencies.find((c) => c.id === id)?.name ?? id;
  // "Rewards left" in pulls: proven amounts only.
  const pulls = pullsOf(game, income);
  const entries = Object.entries(income).filter(([, v]) => v > 0);
  const amounts = entries.map(([c, v]) => `${formatNumber(Math.round(v))} ${name(c)}`).join(' + ');
  const nothingProven = entries.length === 0;

  return (
    <div className={k.tiles}>
      <Tile
        label="Open"
        value={
          <>
            {openCount} {ex && <ExampleTag />}
          </>
        }
        caption="events you can still do"
      />
      {days > 0 ? (
        <Tile label="Login days claimed" value={`${claimed}/${days}`} caption={`${logins.length} login event${logins.length === 1 ? '' : 's'} running`} />
      ) : (
        <Tile label="Login days claimed" value="—" tone="muted" caption="no login event running" />
      )}
      {nothingProven && leftOut.length > 0 ? (
        <EmptyTile label="Rewards left" why="rewards of the open events aren’t known" />
      ) : (
        <Tile
          label="Rewards left"
          value={
            <>
              +{formatNumber(pulls)} {ex && <ExampleTag />}
            </>
          }
          tone={leftOut.length > 0 ? 'glacier' : undefined}
          caption={
            <>
              pulls this version{amounts ? ` · ${amounts}` : ''}
              {leftOut.length > 0 ? ` · ${leftOut.length} without data left out` : ' · feeds the Pulls budget'}
            </>
          }
        />
      )}
    </div>
  );
}

interface ItemProps {
  game: GameContract;
  ev: GameEvent;
  now: number;
  until: number;
  user: GameUserData;
  example: boolean;
  row: BudgetRow | undefined;
  currency: string;
  onChooseServer: () => void;
}

function EventItem({ game, ev, now, until, user, example, row, currency, onChooseServer }: ItemProps) {
  const p = progressOf(user, ev.id);
  const group = groupOf(ev, now);
  const start = Date.parse(ev.start);
  const end = Date.parse(ev.end);
  const save = (next: Partial<EventProgress>) => setEventProgress(game.id, ev.id, { ...p, ...next });
  return (
    <li className={cx(e.row, ev.leak && e.leak, p.state !== 'open' && e.settled)} aria-label={ev.title}>
      <span className={e.mark} aria-hidden="true" />
      <div className={e.main}>
        <div className={e.titleLine}>
          <span className={e.title}>{ev.title}</span>
          <span className={e.kind}>{KIND[ev.kind]}</span>
          {example && <ExampleTag />}
          {ev.leak && <UnverifiedTag source={ev.leak.source} />}
        </div>
        <div className={e.meta}>
          <span className={e.dates}>{formatRange(start, end)}</span>
          {group === 'live' && <Timer to={end} deadline prefix="ends in" />}
          {group === 'upcoming' && <Timer to={start} prefix="starts in" />}
          {group === 'ended' && <span className={e.dates}>ended</span>}
          <span className={e.reward}>
            <Reward ev={ev} state={p.state} row={row} until={until} currency={currency} pulls={row?.status === 'counted' ? asPulls(game, row.currency, row.amount) : null} onChooseServer={onChooseServer} />
          </span>
        </div>
        {ev.kind === 'bonus' && <span className={e.muted}>Reminders for bonuses come with notifications (Account → Notifications).</span>}
        {ev.kind === 'login' && (
          <LoginDays title={ev.title} total={ev.loginDays} claimed={p.daysClaimed ?? 0} canClaim={group !== 'upcoming'} onSet={(daysClaimed) => save({ daysClaimed })} />
        )}
      </div>
      <StateSwitch title={ev.title} value={p.state} onChange={(state) => save({ state })} />
    </li>
  );
}

function Reward({
  ev,
  state,
  row,
  until,
  currency,
  pulls,
  onChooseServer,
}: {
  ev: GameEvent;
  state: EventProgress['state'];
  row: BudgetRow | undefined;
  until: number;
  currency: string;
  pulls: number | null;
  onChooseServer: () => void;
}) {
  const amount = (n: number) => `${formatNumber(Math.round(n))} ${currency}`;
  if (state === 'done') return <span className={e.muted}>Earned · already in your bank</span>;
  if (state === 'skipped') return <span className={e.muted}>Skipped · not counted</span>;
  if (ev.leak || !countsBefore(ev, until)) {
    const why = ev.leak ? 'not counted until confirmed' : 'after this version';
    return ev.reward === null ? (
      <span className={e.muted}>
        Reward <NoData dash={false} /> · {why}
      </span>
    ) : (
      <span className={e.muted}>
        {amount(ev.reward)} · {why}
      </span>
    );
  }
  if (!row) return null;
  switch (row.status) {
    case 'counted':
      return (
        <span>
          <strong className={e.amount}>{formatNumber(Math.round(row.amount))}</strong> {currency} left to earn{pulls ? ` · about ${formatNumber(pulls)} pulls` : ''}
        </span>
      );
    case 'already-earned':
      return <span className={e.muted}>{ev.kind === 'login' ? 'All days claimed' : 'Earned'}</span>;
    case 'skipped':
      return <span className={e.muted}>{row.reason === 'ended' ? 'Ended · not counted' : 'Not counted'}</span>;
    case 'no-data':
      return row.reason === 'choose your server' ? (
        <span>
          Days left <NoData dash={false} fix="choose-server" onFix={onChooseServer} />
        </span>
      ) : (
        <span>
          Reward <NoData dash={false} />
        </span>
      );
    default:
      return null;
  }
}

function StateSwitch({ title, value, onChange }: { title: string; value: EventProgress['state']; onChange: (s: EventProgress['state']) => void }) {
  return (
    <div className={e.states} role="group" aria-label={`State of ${title}`}>
      {STATES.map((s) => (
        <button key={s.id} type="button" className={e.state} data-state={s.id} aria-pressed={value === s.id} onClick={() => onChange(s.id)}>
          {s.label}
        </button>
      ))}
    </div>
  );
}

function LoginDays({ title, total, claimed, canClaim, onSet }: { title: string; total: number | undefined; claimed: number; canClaim: boolean; onSet: (n: number) => void }) {
  if (!total) {
    return (
      <span className={e.muted}>
        Login days <NoData dash={false} />
      </span>
    );
  }
  const n = Math.min(claimed, total);
  return (
    <div className={e.login}>
      {total <= MAX_PIPS ? (
        // V1: tap the bar to set the days already claimed. Each segment is one day.
        <div className={e.dayBar} role="group" aria-label={`Login days for ${title}`}>
          {Array.from({ length: total }, (_, i) => (
            <button
              key={i}
              type="button"
              className={e.daySeg}
              aria-pressed={i < n}
              aria-label={`Day ${i + 1}`}
              disabled={!canClaim}
              // Tap a day to claim up to it; tap the last claimed day again to undo it.
              onClick={() => onSet(i === n - 1 ? i : i + 1)}
            />
          ))}
        </div>
      ) : (
        <div className={e.loginBar}>
          <ProgressBar label="Days claimed" value={known({ done: n, total }, 'user')} />
        </div>
      )}
      <span className={e.days}>
        {n}/{total} days
      </span>
      <span className={e.steppers}>
        <Button className={e.step} aria-label={`Undo one day for ${title}`} disabled={n <= 0} onClick={() => onSet(n - 1)}>
          −
        </Button>
        <Button className={e.step} aria-label={`Claim one more day for ${title}`} disabled={!canClaim || n >= total} onClick={() => onSet(n + 1)}>
          +1 day
        </Button>
      </span>
    </div>
  );
}

/** One endgame cycle as a row in the list: dates when known, reward per cycle, Open / Done / Skip for this cycle. */
function CycleItem({ game, cycle: c, user, currency }: { game: GameContract; cycle: Cycle; user: GameUserData; currency: (id: string) => string }) {
  const cur = c.current;
  const p = cur ? progressOf(user, cur.key) : null;
  return (
    <li className={cx(e.row, p && p.state !== 'open' && e.settled)} aria-label={c.row.label}>
      <span className={e.mark} aria-hidden="true" />
      <div className={e.main}>
        <div className={e.titleLine}>
          <span className={e.title}>{c.row.label}</span>
          <span className={e.kind}>Endgame</span>
        </div>
        <div className={e.meta}>
          <span className={e.dates}>every {c.days} days</span>
          {cur ? (
            <>
              <span className={e.dates}>{formatRange(cur.start, cur.end)}</span>
              <Timer to={cur.end} deadline prefix="resets in" />
            </>
          ) : (
            <span className={e.glacier}>Dates not known yet</span>
          )}
          <span className={e.reward}>
            {c.row.amount === null ? (
              <span>
                Reward per cycle <NoData dash={false} />
              </span>
            ) : (
              <span>
                <strong className={e.amount}>{formatNumber(c.row.amount)}</strong> {currency(c.row.currency)} per cycle
                {asPulls(game, c.row.currency, c.row.amount) !== null ? ` · about ${formatNumber(asPulls(game, c.row.currency, c.row.amount) ?? 0)} pulls` : ''}
              </span>
            )}
          </span>
        </div>
      </div>
      {cur && p && <StateSwitch title={`${c.row.label} this cycle`} value={p.state} onChange={(state) => setEventProgress(game.id, cur.key, { state })} />}
    </li>
  );
}

/** Pulls an amount is worth (premium ÷ per pull, or pull items as they are); null for other currencies. */
function asPulls(game: GameContract, currency: string, amount: number): number | null {
  const c = game.currencies.find((x) => x.id === currency);
  if (c?.perPull && !c.paid) return Math.floor(amount / c.perPull + 1e-9);
  if (c?.pullItemFor?.length) return Math.floor(amount);
  return null;
}
