import type { CSSProperties, ReactNode } from 'react';
import type { GameContract, GameEvent } from '../../core/contract';
import { known, unknown } from '../../core/contract/known';
import { setEventProgress, type EventProgress, type GameUserData } from '../../core/data/userData';
import { formatNumber } from '../../core/time/format';
import { formatDate, formatRange } from '../../core/time/reset';
import { Button, ExampleTag, NoData, ProgressBar, StatTile, Timer, UnverifiedTag } from '../../core/ui';
import { cx } from '../../core/ui/cx';
import type { BudgetRow } from '../budget/budget';
import { premiumCurrency } from './examples';
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

/**
 * Events (R29): events, login events and endgame cycles with your state
 * (open / done / skipped) and login days claimed. Live first (ending soonest),
 * then upcoming, endgame cycles, and ended ones folded away.
 */
export function Events({ game, data, serverId, now, onChooseServer }: Props) {
  const until = data.versionEnd.at;
  const list = data.events.list;
  const example = data.events.example;
  const b = eventsBudget(game, list, data.user, now, until, serverId);
  const rows = new Map(b.rows.map((r) => [r.id, r]));
  const groups = groupEvents(list, now);
  const name = (id: string) => game.currencies.find((c) => c.id === id)?.name ?? id;
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

  return (
    <div className={e.stack} style={{ '--vent': game.vent } as CSSProperties}>
      <Tiles game={game} data={data} groups={groups} income={b.income} leftOut={b.leftOut} until={until} />

      <Section label="Live now" count={groups.live.length}>
        {groups.live.length ? <ul className={e.list}>{groups.live.map(item)}</ul> : <p className={e.muted}>Nothing is running right now.</p>}
      </Section>

      <Section label="Upcoming" count={groups.upcoming.length}>
        {groups.upcoming.length ? <ul className={e.list}>{groups.upcoming.map(item)}</ul> : <p className={e.muted}>No upcoming events are listed yet.</p>}
      </Section>

      <EndgameCycles game={game} list={cycles(game, now)} user={data.user} currency={name} />

      {groups.ended.length > 0 && (
        <details className={e.ended}>
          <summary className={e.endedSummary}>
            <span className="t-label">Ended</span>
            <span className={e.count}>{groups.ended.length}</span>
          </summary>
          <ul className={e.list}>{groups.ended.map(item)}</ul>
        </details>
      )}

      {b.leftOut.length > 0 && <p className={e.muted}>Not counted in “still to earn” (no data yet): {b.leftOut.join(', ')}.</p>}
    </div>
  );
}

function Section({ label, count, children }: { label: string; count: number; children: ReactNode }) {
  return (
    <section className={e.section} aria-label={label}>
      <h3 className={e.sectionHead}>
        <span className="t-label">{label}</span>
        <span className={e.count}>{count}</span>
      </h3>
      {children}
    </section>
  );
}

function Tiles({
  game,
  data,
  groups,
  income,
  leftOut,
  until,
}: {
  game: GameContract;
  data: EventsData;
  groups: ReturnType<typeof groupEvents>;
  income: Record<string, number>;
  leftOut: string[];
  until: number;
}) {
  const ex = data.events.example;
  const user = data.user;
  const openCount = [...groups.live, ...groups.upcoming].filter((x) => !x.leak && progressOf(user, x.id).state === 'open').length;
  const logins = groups.live.filter((x) => x.kind === 'login' && x.loginDays);
  const claimed = logins.reduce((a, x) => a + Math.min(x.loginDays ?? 0, progressOf(user, x.id).daysClaimed ?? 0), 0);
  const days = logins.reduce((a, x) => a + (x.loginDays ?? 0), 0);
  const premium = premiumCurrency(game);
  const name = (id: string) => game.currencies.find((c) => c.id === id)?.name ?? id;
  // "Still to earn": proven amounts only, shown in the premium currency when there is any.
  const entries = Object.entries(income).filter(([, v]) => v > 0);
  const main = entries.find(([c]) => c === premium?.id) ?? entries[0];
  const perPull = main ? game.currencies.find((c) => c.id === main[0])?.perPull : undefined;
  const pulls = main && perPull ? Math.floor(main[1] / perPull + 1e-9) : null;
  const others = entries.filter((x) => x !== main).map(([c, v]) => `${formatNumber(Math.round(v))} ${name(c)}`);
  // Nothing proven but some rows have no data → No data yet. Nothing left at all → a real 0.
  const value = main
    ? known(
        <span className={e.tileValue}>
          {formatNumber(Math.round(main[1]))} {ex && <ExampleTag />}
        </span>,
        'user',
      )
    : leftOut.length > 0
      ? unknown()
      : known(<span className={e.tileValue}>0</span>, 'user');

  return (
    <div className={e.tiles}>
      <StatTile
        label="Open events"
        value={known(
          <span className={e.tileValue}>
            {openCount} {ex && <ExampleTag />}
          </span>,
          'user',
        )}
        caption="live and upcoming, not done or skipped"
      />
      {days > 0 && (
        <StatTile
          label="Login days claimed"
          value={known(
            <span className={e.tileValue}>
              {claimed}/{days}
            </span>,
            'user',
          )}
          progress={claimed / days}
          caption={`${logins.length} login event${logins.length === 1 ? '' : 's'} running`}
        />
      )}
      <StatTile
        label="Still to earn this version"
        value={value}
        caption={
          <>
            {main ? `${name(main[0])}${pulls !== null ? ` · about ${formatNumber(pulls)} pulls` : ''}` : 'nothing left to earn'}
            {others.length > 0 ? ` · plus ${others.join(', ')}` : ''} · until {formatDate(until)} {data.versionEnd.example && <ExampleTag />}
            {leftOut.length > 0 && main && <span className={e.glacier}> · {leftOut.length} without data left out</span>}
          </>
        }
      />
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
            <Reward ev={ev} state={p.state} row={row} until={until} currency={currency} onChooseServer={onChooseServer} />
          </span>
        </div>
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
  onChooseServer,
}: {
  ev: GameEvent;
  state: EventProgress['state'];
  row: BudgetRow | undefined;
  until: number;
  currency: string;
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
          <strong className={e.amount}>{formatNumber(Math.round(row.amount))}</strong> {currency} left to earn
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
        <div className={e.pips} role="group" aria-label={`Login days for ${title}`}>
          {Array.from({ length: total }, (_, i) => (
            <button
              key={i}
              type="button"
              className={e.pip}
              aria-pressed={i < n}
              aria-label={`Day ${i + 1}`}
              disabled={!canClaim}
              // Tap a day to claim up to it; tap the last claimed day again to undo it.
              onClick={() => onSet(i === n - 1 ? i : i + 1)}
            >
              {i + 1}
            </button>
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

function EndgameCycles({ game, list, user, currency }: { game: GameContract; list: Cycle[]; user: GameUserData; currency: (id: string) => string }) {
  if (list.length === 0) return null;
  return (
    <section className={e.section} aria-label="Endgame cycles">
      <h3 className={e.sectionHead}>
        <span className="t-label">Endgame cycles</span>
        <span className={e.count}>{list.length}</span>
      </h3>
      <ul className={e.list}>
        {list.map((c) => {
          const cur = c.current;
          const p = cur ? progressOf(user, cur.key) : null;
          return (
            <li key={c.row.id} className={cx(e.row, p && p.state !== 'open' && e.settled)} aria-label={c.row.label}>
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
                      </span>
                    )}
                  </span>
                </div>
              </div>
              {cur && p && <StateSwitch title={`${c.row.label} this cycle`} value={p.state} onChange={(state) => setEventProgress(game.id, cur.key, { state })} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
