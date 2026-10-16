import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { GameContract, GameEvent } from '../../core/contract';
import { known } from '../../core/contract/known';
import { setEventProgress, type EventProgress, type GameUserData } from '../../core/data/userData';
import { formatNumber } from '../../core/time/format';
import { formatRange } from '../../core/time/reset';
import { Button, ExampleTag, Menu, NoData, ProgressBar, Timer, UnverifiedTag, type MenuItem } from '../../core/ui';
import { cx } from '../../core/ui/cx';
import type { BudgetRow } from '../budget/budget';
import { pullsOf } from '../backlog/backlog';
import { EmptyTile, Filters, Tile } from '../pulls/shared';
import k from '../pulls/kit.module.css';
import { countsBefore, cycles, eventsBudget, groupEvents, groupOf, progressOf, type Cycle } from './events';
import e from './events.module.css';
import type { EventsData } from './useEventsData';
import { hiddenKinds, KIND_LABEL, kindColour } from './kindPrefs';
import { usePrefs } from '../../core/data/prefs';
import { feedback } from '../../core/ui/feedback';

type State = EventProgress['state'];
const KIND = KIND_LABEL;
/** Above this many days a login event shows a bar instead of one button per day. */
const MAX_PIPS = 14;
/** "Ending soon": running and ending within this time. */
const SOON = 4 * 86_400_000;
/** Rows shown in "Coming up" before the rest fold behind "Show N more". */
const COMING_UP_SHOWN = 4;
/** A reward worth at least this many pulls stands out. */
const BIG_PULLS = 4;

/** How much a row's reward weighs: big ones stand out, ones worth nothing (or less than a pull) stay quiet. */
type Weight = 'high' | 'normal' | 'low' | 'none';

interface Props {
  game: GameContract;
  data: EventsData;
  serverId: string | undefined;
  now: number;
  onChooseServer: () => void;
  /** List actions shown next to the filters (Edit list). */
  actions?: ReactNode;
  /** Heading level for the groups: 3 under a game heading, 2 when the page shows one game. */
  level?: 2 | 3;
}

type Filter = 'all' | 'soon' | 'event' | 'login' | 'endgame' | 'bonus';
type Change = (key: string, title: string, state: State) => void;
interface Entry {
  key: string;
  sort: number;
  node: ReactNode;
}
const byKey = (a: Entry, b: Entry) => a.sort - b.sort;

const SAID: Record<State, string> = { done: 'marked done', skipped: 'skipped', open: 'open again' };

/**
 * Events (R29): events, login events and endgame cycles with your state and login days claimed.
 * Calm layout (T20): grouped into Ending soon / Running now / Coming up, with what you already
 * settled (Done or skipped) and ended events folded behind "Show N". Each row has one clear
 * button (Done, or Reopen once settled); Skip and the rest sit in its ⋯ menu, and every change
 * can be undone from the line that confirms it. Bigger rewards stand out; rows worth nothing stay quiet.
 */
export function Events({ game, data, serverId, now, onChooseServer, actions, level = 3 }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [last, setLast] = useState<{ key: string; title: string; prev: EventProgress; state: State } | null>(null);
  const [undone, setUndone] = useState<string | null>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const list = data.events.list;
  // Version end unknown (examples hidden): count up to the last listed event's end.
  const until = data.versionEnd.at ?? Math.max(now, ...list.map((ev) => Date.parse(ev.end)).filter(Number.isFinite));
  const b = eventsBudget(game, list, data.user, now, until, serverId);
  const rows = new Map(b.rows.map((r) => [r.id, r]));
  const groups = groupEvents(list, now);
  const name = (id: string) => game.currencies.find((c) => c.id === id)?.name ?? id;
  // Customise → Events, banners and calendar: kinds you chose not to see are left out everywhere here.
  const hidden = hiddenKinds(usePrefs().hiddenEventKinds);
  const keep = (ev: GameEvent) =>
    !hidden.includes(ev.kind) &&
    (filter === 'all' ||
    (filter === 'soon' && groupOf(ev, now) === 'live' && Date.parse(ev.end) - now < SOON) ||
    (filter === 'event' && (ev.kind === 'event' || ev.kind === 'web')) ||
    ev.kind === filter);

  // A row moves to another group when its state changes, so focus goes to Undo on the line that says what happened.
  useEffect(() => {
    if (last) undoRef.current?.focus();
  }, [last]);
  useEffect(() => {
    if (undone) statusRef.current?.focus();
  }, [undone]);

  const change: Change = (key, title, state) => {
    const prev = progressOf(data.user, key);
    if (prev.state === state) return;
    // Login days claimed stay as they are; only the state changes.
    setEventProgress(game.id, key, { ...prev, state });
    feedback(state === 'open' ? 'undo' : 'done');
    setUndone(null);
    setLast({ key, title, prev, state });
  };
  const undo = () => {
    if (!last) return;
    setEventProgress(game.id, last.key, last.prev);
    setUndone(`“${last.title}” is back to ${last.prev.state === 'open' ? 'open' : last.prev.state === 'done' ? 'done' : 'skipped'}.`);
    setLast(null);
  };

  const item = (ev: GameEvent) => (
    <EventItem
      key={ev.id}
      game={game}
      ev={ev}
      now={now}
      until={until}
      user={data.user}
      example={data.events.exampleIds.has(ev.id)}
      row={rows.get(`event:${ev.id}`) ?? rows.get(`login:${ev.id}`)}
      currency={name(ev.currency)}
      onChooseServer={onChooseServer}
      onChange={change}
    />
  );

  const soon: Entry[] = [];
  const running: Entry[] = [];
  const coming: Entry[] = [];
  const settled: Entry[] = [];
  const live = groups.live.filter(keep);
  const upcoming = groups.upcoming.filter(keep);
  for (const ev of live) {
    const end = Date.parse(ev.end);
    const entry = { key: ev.id, sort: end, node: item(ev) };
    if (progressOf(data.user, ev.id).state !== 'open') settled.push(entry);
    else (end - now < SOON ? soon : running).push(entry);
  }
  for (const ev of upcoming) {
    const entry = { key: ev.id, sort: Date.parse(ev.start), node: item(ev) };
    (progressOf(data.user, ev.id).state !== 'open' ? settled : coming).push(entry);
  }
  // The game record's endgame cycles only when the list has no endgame events of its own (else they'd show twice).
  const listHasEndgame = list.some((ev) => ev.kind === 'endgame');
  const cycleList = !listHasEndgame && !hidden.includes('endgame') && (filter === 'all' || filter === 'endgame') ? cycles(game, now) : [];
  for (const c of cycleList) {
    const node = <CycleItem key={c.row.id} game={game} cycle={c} example={data.cycleExamples.get(c.row.id)} user={data.user} currency={name} onChange={change} />;
    const cur = c.current;
    const entry = { key: c.row.id, sort: cur?.end ?? Number.MAX_SAFE_INTEGER, node };
    if (cur && progressOf(data.user, cur.key).state !== 'open') settled.push(entry);
    else (cur && cur.end - now < SOON ? soon : running).push(entry);
  }
  [soon, running, coming, settled].forEach((g) => g.sort(byKey));
  const ended: Entry[] = filter === 'all' ? groups.ended.map((ev) => ({ key: ev.id, sort: 0, node: item(ev) })) : [];
  // Endgame cycles always list, so "empty" is about events: with none running or coming up, point to Edit list.
  const noEvents = live.length === 0 && upcoming.length === 0;

  return (
    <div className={e.stack} style={{ '--vent': game.vent } as CSSProperties}>
      <Tiles game={game} data={data} groups={groups} income={b.income} leftOut={b.leftOut} />
      <div className={e.toolbar}>
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
        {actions && <div className={e.actions}>{actions}</div>}
      </div>

      <div className={e.status} role="status" aria-live="polite" ref={statusRef} tabIndex={-1}>
        {last && (
          <>
            <span>
              “{last.title}” {SAID[last.state]}.
            </span>
            <button ref={undoRef} type="button" className={e.undo} onClick={undo} aria-label={`Undo: ${last.title} ${SAID[last.state]}`}>
              Undo
            </button>
          </>
        )}
        {!last && undone && <span>{undone}</span>}
      </div>

      {noEvents && (
        <p className={e.muted}>
          {filter === 'all' || filter === 'endgame'
            ? 'No events running or coming up on the list. Know one that’s missing? Add it with “Edit list” next to the filters.'
            : 'Nothing in this filter right now.'}
        </p>
      )}

      <Group title="Ending soon" hint="within 4 days" items={soon} level={level} />
      <Group title="Running now" items={running} level={level} />
      <Group title="Coming up" items={coming} level={level} limit={COMING_UP_SHOWN} />
      <Group title="Done or skipped" items={settled} level={level} folded />
      <Group title="Ended" items={ended} level={level} folded />

      {b.leftOut.length > 0 && <p className={e.muted}>Not counted in “Rewards left” (no data yet): {b.leftOut.join(', ')}.</p>}
    </div>
  );
}

/** One group of rows with its heading and count. `folded`: all rows behind "Show N"; `limit`: the rest behind "Show N more". */
function Group({ title, hint, items, level, folded = false, limit }: { title: string; hint?: string; items: Entry[]; level: 2 | 3; folded?: boolean; limit?: number }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  if (items.length === 0) return null;
  const cut = folded ? 0 : (limit ?? items.length);
  const shown = open ? items : items.slice(0, cut);
  const hidden = items.length - cut;
  const H = level === 2 ? 'h2' : 'h3';
  // The visible words first, then the group, so the button's name says which list it opens.
  const foldText = open ? 'Hide' : `Show ${items.length}`;
  const moreText = open ? 'Show fewer' : `Show ${hidden} more`;
  return (
    <section className={e.group} aria-labelledby={id}>
      <div className={e.groupHead}>
        <H id={id} className={cx('t-label', e.groupTitle)}>
          {title}
        </H>
        <span className={e.count}>{items.length}</span>
        {hint && <span className={e.hint}>{hint}</span>}
        {folded && (
          <button type="button" className={e.fold} aria-expanded={open} aria-label={`${foldText} ${title.toLowerCase()}`} onClick={() => setOpen((o) => !o)}>
            {foldText}
          </button>
        )}
      </div>
      {shown.length > 0 && (
        <ul className={e.list} aria-label={title}>
          {shown.map((x) => x.node)}
        </ul>
      )}
      {!folded && hidden > 0 && (
        <button type="button" className={e.more} aria-expanded={open} aria-label={`${moreText} ${title.toLowerCase()}`} onClick={() => setOpen((o) => !o)}>
          {moreText}
        </button>
      )}
    </section>
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
        <Tile label="Login days claimed" value="—" tone="muted" caption="No data yet" />
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
  onChange: Change;
}

/** A reward's weight from what it is worth in pulls (or nothing at all). */
function weightOf(game: GameContract, currency: string, amount: number): Weight {
  if (amount <= 0) return 'none';
  const pulls = asPulls(game, currency, amount);
  if (pulls === null) return 'normal';
  if (pulls >= BIG_PULLS) return 'high';
  return pulls < 1 ? 'low' : 'normal';
}

function EventItem({ game, ev, now, until, user, example, row, currency, onChooseServer, onChange }: ItemProps) {
  const p = progressOf(user, ev.id);
  const group = groupOf(ev, now);
  const start = Date.parse(ev.start);
  const end = Date.parse(ev.end);
  const counted = p.state === 'open' && row?.status === 'counted' && !ev.leak && countsBefore(ev, until);
  const weight: Weight = counted && row ? weightOf(game, row.currency, row.amount) : 'normal';
  const saveDays = (daysClaimed: number) => setEventProgress(game.id, ev.id, { ...p, daysClaimed });
  return (
    <li className={cx(e.row, ev.leak && e.leak, p.state !== 'open' && e.settled)} data-weight={weight} aria-label={ev.title}>
      <span className={e.mark} aria-hidden="true" />
      <div className={e.main}>
        <div className={e.titleLine}>
          <span className={e.title}>{ev.title}</span>
          <KindChip kind={ev.kind} />
          {example && <ExampleTag />}
          {ev.leak && <UnverifiedTag source={ev.leak.source} />}
        </div>
        <div className={e.sub}>
          <div className={e.meta}>
            <span className={e.dates}>{formatRange(start, end)}</span>
            {group === 'live' && <Timer to={end} deadline prefix="ends in" />}
            {group === 'upcoming' && <Timer to={start} prefix="starts in" />}
            {group === 'ended' && <span className={e.dates}>ended</span>}
            {ev.kind === 'bonus' && <span className={e.note}>Reminders for bonuses aren’t built yet.</span>}
          </div>
          {ev.kind === 'login' && (
            // Days can be claimed only while the event runs; − stays on so a wrong tap can always be undone.
            <LoginDays title={ev.title} total={ev.loginDays} claimed={p.daysClaimed ?? 0} canClaim={group === 'live'} onSet={saveDays} />
          )}
        </div>
      </div>
      <div className={e.reward}>
        <Reward ev={ev} state={p.state} row={row} until={until} currency={currency} pulls={row?.status === 'counted' ? asPulls(game, row.currency, row.amount) : null} onChooseServer={onChooseServer} />
      </div>
      <Controls title={ev.title} value={p.state} onChange={(state) => onChange(ev.id, ev.title, state)} />
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
  state: State;
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
      return <Amount value={row.amount} currency={currency} caption={`left to earn${pulls ? ` · about ${formatNumber(pulls)} pulls` : ''}`} />;
    case 'already-earned':
      return <span className={e.muted}>{ev.kind === 'login' ? 'All days claimed' : 'Earned'}</span>;
    case 'skipped':
      return <span className={e.muted}>{row.reason === 'ended' ? 'Ended · not counted' : 'Not counted'}</span>;
    case 'ended':
      // An event that ran out before you marked it: say what it gave, so the row is never blank.
      return <span className={e.muted}>{ev.reward === null ? <>Ended · reward <NoData dash={false} /></> : `Ended · ${amount(ev.reward)}, not counted`}</span>;
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

/** An amount on its own line (sized by the row's weight), currency beside it, what it means below. */
function Amount({ value, currency, caption }: { value: number; currency: string; caption: string }) {
  return (
    <>
      <span className={e.amountLine}>
        <strong className={e.amount}>{formatNumber(Math.round(value))}</strong> <span className={e.currency}>{currency}</span>
      </span>
      <span className={e.caption}>{caption}</span>
    </>
  );
}

/**
 * One clear button per row: Done while open, Reopen once done or skipped. The other
 * choices (Skip, or switching between done and skipped) are in the ⋯ menu.
 */
function Controls({ title, value, onChange }: { title: string; value: State; onChange: (s: State) => void }) {
  const items: MenuItem[] =
    value === 'open'
      ? [{ label: 'Skip · I won’t play it', onSelect: () => onChange('skipped') }]
      : value === 'done'
        ? [
            { label: 'Skip instead', onSelect: () => onChange('skipped') },
            { label: 'Reopen', onSelect: () => onChange('open') },
          ]
        : [
            { label: 'Mark done instead', onSelect: () => onChange('done') },
            { label: 'Reopen', onSelect: () => onChange('open') },
          ];
  return (
    <div className={e.controls} role="group" aria-label={`State of ${title}`}>
      {value === 'open' ? (
        <button type="button" className={e.done} aria-label={`Mark ${title} done`} onClick={() => onChange('done')}>
          <span className={e.check} aria-hidden="true">
            ✓
          </span>
          Done
        </button>
      ) : (
        <button type="button" className={e.reopen} aria-label={`Reopen ${title}`} onClick={() => onChange('open')}>
          Reopen
        </button>
      )}
      <Menu label={`More for ${title}`} items={items} />
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

/**
 * One endgame cycle as a row in the list: dates when known, reward per cycle, Done / ⋯ for this cycle.
 * Dates the record doesn't know show as the same EXAMPLE dates Calendar draws (no Done / Skip on those).
 */
function CycleItem({
  game,
  cycle: c,
  example,
  user,
  currency,
  onChange,
}: {
  game: GameContract;
  cycle: Cycle;
  example: { start: number; end: number } | undefined;
  user: GameUserData;
  currency: (id: string) => string;
  onChange: Change;
}) {
  const cur = c.current;
  const p = cur ? progressOf(user, cur.key) : null;
  const amount = c.row.amount;
  const pulls = amount === null ? null : asPulls(game, c.row.currency, amount);
  const weight: Weight = amount !== null && (!p || p.state === 'open') ? weightOf(game, c.row.currency, amount) : 'normal';
  return (
    <li className={cx(e.row, p && p.state !== 'open' && e.settled)} data-weight={weight} aria-label={c.row.label}>
      <span className={e.mark} aria-hidden="true" />
      <div className={e.main}>
        <div className={e.titleLine}>
          <span className={e.title}>{c.row.label}</span>
          <span className={e.kind}>Endgame</span>
          {!cur && example && <ExampleTag />}
        </div>
        <div className={e.meta}>
          <span className={e.dates}>every {c.days} days</span>
          {cur ? (
            <>
              <span className={e.dates}>{formatRange(cur.start, cur.end)}</span>
              <Timer to={cur.end} deadline prefix="resets in" />
            </>
          ) : example ? (
            <>
              <span className={e.dates}>{formatRange(example.start, example.end)}</span>
              <span className={e.glacier}>example dates · the real ones aren’t known yet</span>
            </>
          ) : (
            <span className={e.glacier}>Dates not known yet</span>
          )}
        </div>
      </div>
      <div className={e.reward}>
        {amount === null ? (
          <span>
            Reward per cycle <NoData dash={false} />
          </span>
        ) : (
          <Amount value={amount} currency={currency(c.row.currency)} caption={`per cycle${pulls !== null ? ` · about ${formatNumber(pulls)} pulls` : ''}`} />
        )}
      </div>
      {cur && p ? (
        <Controls title={`${c.row.label} this cycle`} value={p.state} onChange={(state) => onChange(cur.key, `${c.row.label} this cycle`, state)} />
      ) : (
        <span className={e.controls} aria-hidden="true" />
      )}
    </li>
  );
}

/** Pulls an amount is worth (premium ÷ per pull, or pull items as they are); null for other currencies. */
function asPulls(game: GameContract, currency: string, amount: number): number | null {
  const c = game.currencies.find((x) => x.id === currency);
  if (c?.perPull) return Math.floor(amount / c.perPull + 1e-9);
  if (c?.pullItemFor?.length) return Math.floor(amount);
  return null;
}

/** The event's kind, in your colour for that kind if you picked one (Customise). */
function KindChip({ kind }: { kind: GameEvent['kind'] }) {
  const prefs = usePrefs();
  const tone = document.documentElement.dataset.tone === 'light' ? 'light' : 'dark';
  const colour = kindColour(kind, tone, prefs.eventKindColours);
  return (
    <span className={e.kind} style={colour ? ({ color: colour, '--kind-colour': colour } as CSSProperties) : undefined} data-coloured={colour ? '' : undefined}>
      {KIND[kind]}
    </span>
  );
}
