import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { GameContract, GameId } from '../../core/contract';
import { useExamplesShown } from '../../core/data/prefs';
import { setPlanStatus, type UserPlan } from '../../core/data/userData';
import { formatDateTime, formatRange } from '../../core/time/reset';
import { BottomSheet, Button, CalendarBar, ExampleNotice, ExampleTag, GameTag, HowTo, Timer, UnverifiedTag } from '../../core/ui';
import { AddOwnButton, examplesFor } from '../today/AddOwn';
import type { GameLists } from '../today/lists';
import { foldRows, gameTimeline, nextChange, packRows, type GameTimeline, type Lane, type Span } from './timeline';
import c from './calendar.module.css';
import { formatDay } from '../../core/time/reset';
import { firstDayOfWeek } from '../../core/time/displayFormat';

const DAY = 86_400_000;
/** Design: one week back, five ahead. */
const DAYS_BACK = 7;
const DAYS_AHEAD = 35;
/** A busy lane shows at most this many rows per game; the rest fold behind "Show N more". */
const ROWS_PER_GAME = 4;
/** The Dates list shows what's next: dates in the next two weeks, at most DATES_SHOWN of them; the rest fold behind a button. */
const SOON_DAYS = 14;
const DATES_SHOWN = 8;

export interface CalendarProps {
  games: GameContract[];
  servers: Record<GameId, string>;
  lists: Record<GameId, GameLists>;
  now: number;
  openAccount: () => void;
  /** Open the server picker for one game (falls back to the Account panel). */
  openServer?: ((game: GameId) => void) | undefined;
  /** Your active plans (approved from the Assistant). */
  plans?: { game: GameContract; plan: UserPlan }[];
}

const LANES: { id: Lane; label: string; noun: string }[] = [
  { id: 'banners', label: 'Banners', noun: 'banners' },
  { id: 'events', label: 'Events', noun: 'events' },
  { id: 'endgame', label: 'Endgame', noun: 'endgame cycles' },
  { id: 'version', label: 'Version', noun: 'versions' },
];

/** Start of the viewer's local day: the timeline is drawn in local time. */
function localDayStart(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** An example plan, so the "Your plans" lane shows what a plan looks like. Marked EXAMPLE; never saved. */
function examplePlan(timelines: { game: GameContract; timeline: GameTimeline }[], now: number): Span | null {
  for (const { game, timeline } of timelines) {
    const next = timeline.spans.filter((s) => s.lane === 'banners' && s.start > now).sort((a, b) => a.start - b.start)[0];
    if (next) return { id: 'example-plan', game, lane: 'banners', title: `Save pulls for ${next.title.split(' · ')[0]}`, start: now, end: next.end, example: true };
  }
  return null;
}

/** Where the Assistant is: screens can't open it themselves, so say where its button sits. */
const ASSISTANT_HINT = 'Open the Assistant (the Assistant button in the sidebar, ASK on a phone, or Ctrl+K) and approve a plan it proposes.';

/** Calendar (R41), drawn to the design's Calendar: legend, timeline with lanes and a today line, then every date in order. */
export function Calendar({ games, servers, lists, now, openAccount, openServer, plans: mine = [] }: CalendarProps) {
  const tags = games.length > 1;
  const day0 = localDayStart(now);
  const from = day0 - DAYS_BACK * DAY;
  const to = day0 + DAYS_AHEAD * DAY;
  const pct = (t: number) => Math.min(100, Math.max(0, ((t - from) / (to - from)) * 100));

  const showExamples = useExamplesShown();
  const timelines = games.map((game) => {
    const l = lists[game.id] ?? EMPTY_LISTS;
    return { game, timeline: gameTimeline({ game, serverId: servers[game.id], characters: l.characters, banners: l.banners, events: l.events, versions: l.versions, now, from, to, examples: showExamples, exampleIds: l.exampleIds }) };
  });
  const laneExample = (lane: Lane) => timelines.some(({ timeline }) => timeline.example[lane]);
  // Your plans; with none yet, one EXAMPLE plan shows the look.
  const myPlans: Span[] = mine.map(({ game, plan: p }) => {
    const start = Date.parse(p.start);
    return { id: p.id, game, lane: 'banners', title: p.title, start, end: p.end ? Date.parse(p.end) : start + 60 * 60_000, example: false };
  });
  const plan = myPlans.length || !showExamples ? null : examplePlan(timelines, now);
  const anyExample = LANES.some((l) => laneExample(l.id)) || plan !== null;
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const chooseServer = (id: GameId) => (openServer ? openServer(id) : openAccount());
  // A tapped plan bar (or Dates row) opens its details; Undo marks it undone (plans are never deleted).
  const [picked, setPicked] = useState<{ game: GameContract; plan: UserPlan } | 'example' | null>(null);
  const [undone, setUndone] = useState<{ game: GameContract; plan: UserPlan } | null>(null);
  const [showAllDates, setShowAllDates] = useState(false);
  const pick = (id: string) => setPicked(id === plan?.id ? 'example' : (mine.find((m) => m.plan.id === id) ?? null));
  const addOwn = (kind: 'events' | 'banners') =>
    games.map((g) => <AddOwnButton key={`${g.id}:${kind}`} game={g} kind={kind} tag={tags} examples={examplesFor(g, lists[g.id] ?? EMPTY_LISTS, kind, now, showExamples)} />);

  // The first day of each week gets a tick (Monday in the design; Customise → Time and format can make it Sunday).
  const ticks: number[] = [];
  for (let d = 0; d <= DAYS_BACK + DAYS_AHEAD; d++) {
    const t = from + d * DAY;
    if (new Date(t).getDay() === firstDayOfWeek()) ticks.push(t);
  }

  // On a phone the timeline scrolls sideways: start with today in view.
  const scroller = useRef<HTMLDivElement>(null);
  const todayPct = pct(now);
  useEffect(() => {
    const el = scroller.current;
    if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = Math.max(0, (todayPct / 100) * el.scrollWidth - 48);
  }, [todayPct]);

  const exampleParts = [
    laneExample('banners') && 'banners',
    laneExample('events') && 'events',
    laneExample('endgame') && 'endgame cycle dates',
    laneExample('version') && 'the version end',
    plan && 'the plan',
  ].filter(Boolean);

  // The list under the timeline: everything not over yet, soonest change first. What's next shows; the rest folds.
  const all = timelines.flatMap(({ timeline }) => timeline.spans);
  const dates = [...all, ...myPlans, ...(plan ? [plan] : [])].filter((s) => s.end >= now).sort((a, b) => nextChange(a, now) - nextChange(b, now) || a.start - b.start);
  const week = now + 7 * DAY;
  const soon = now + SOON_DAYS * DAY;
  const shownDates = showAllDates ? dates : dates.filter((s) => nextChange(s, now) < soon).slice(0, DATES_SHOWN);
  const hiddenDates = dates.length - shownDates.length;
  const dateGroups = [
    { label: 'Next 7 days', items: shownDates.filter((s) => nextChange(s, now) < week) },
    { label: 'In 1–2 weeks', items: shownDates.filter((s) => nextChange(s, now) >= week && nextChange(s, now) < soon) },
    { label: 'Later', items: shownDates.filter((s) => nextChange(s, now) >= soon) },
  ].filter((g) => g.items.length > 0);
  const planRows = packRows([...myPlans, ...(plan ? [plan] : [])]);
  const dateRow = (s: Span) => (
    <li key={`${s.game.id}:${s.id}`} className={c.item}>
      <span className={c.mark} style={{ background: s.game.vent }} aria-hidden="true" />
      <span className={c.what}>
        <span className={c.itemTitle}>{s.title}</span>
        <span className={c.range}>{formatRange(s.start, s.end)}</span>
        {(s.id === plan?.id || myPlans.some((p) => p.id === s.id)) && (
          <button type="button" className={c.linkBtn} onClick={() => pick(s.id)} aria-label={`Details of plan ${s.title}`}>
            Plan details
          </button>
        )}
      </span>
      {s.leak && <UnverifiedTag source={s.leak.source} />}
      {s.example && <ExampleTag />}
      {tags && <GameTag label={s.game.short} vent={s.game.vent} />}
      <span className={c.when}>
        {s.start > now ? <Timer to={s.start} prefix="in" /> : <Timer to={s.end} deadline prefix="ends in" />}
        <time className={c.whenAt} dateTime={new Date(s.start > now ? s.start : s.end).toISOString()}>
          {formatDateTime(s.start > now ? s.start : s.end)}
        </time>
      </span>
    </li>
  );

  return (
    <div className={c.stack}>
      {anyExample && (
        <ExampleNotice>
          {cap(joinWords(exampleParts as string[]))} marked EXAMPLE stand in until {tags ? 'the games’' : 'the game’s'} lists are added and you make your own plans.
        </ExampleNotice>
      )}

      <div className={c.legend} aria-label="Legend">
        <span className={c.legendItem}>
          <span className={c.keyConfirmed} aria-hidden="true" />
          Confirmed
        </span>
        <span className={c.legendItem}>
          <span className={c.keyLeak} aria-hidden="true" />
          Leak · unverified
        </span>
        <span className={c.legendItem}>
          <span className={c.keyPlan} aria-hidden="true" />
          Your plan
        </span>
        <span className={c.legendItem}>
          <span className={c.keyToday} aria-hidden="true" />
          Today
        </span>
        <span className={c.zone}>Your time · {zone}</span>
      </div>

      <section className={c.timelineCard} aria-label="Timeline">
        <div className={c.scroller} ref={scroller}>
          <div className={c.timeline}>
            <div className={c.scale} aria-hidden="true">
              {ticks.map((t) => (
                <span key={t} className={c.scaleMark} style={{ left: `${pct(t)}%` }}>
                  {formatDay(t)}
                </span>
              ))}
              <span className={c.todayMark} style={{ left: `${todayPct}%` }}>
                Today
              </span>
            </div>
            <div className={c.lanes}>
              {ticks.map((t) => (
                <span key={t} className={c.gridLine} style={{ left: `${pct(t)}%` }} aria-hidden="true" />
              ))}
              <span className={c.today} style={{ left: `${todayPct}%` }} aria-hidden="true" />
              {LANES.map((lane) => (
                <LaneRows
                  key={lane.id}
                  label={lane.label}
                  noun={lane.noun}
                  now={now}
                  example={laneExample(lane.id)}
                  spans={timelines.flatMap(({ timeline }) => timeline.spans.filter((s) => s.lane === lane.id))}
                  pct={pct}
                  tags={tags}
                  addOwn={lane.id === 'banners' || lane.id === 'events' ? addOwn(lane.id) : undefined}
                />
              ))}
              <Resets timelines={timelines} pct={pct} tags={tags} chooseServer={chooseServer} />
              <div className={c.laneHead}>
                Your plans
                {plan && <ExampleTag />}
              </div>
              {planRows.map((row) => (
                <div key={row[0]?.id} className={c.row}>
                  {row.map((p) => {
                    const left = pct(p.start);
                    const width = Math.max(2, pct(p.end) - left);
                    return (
                      <Fragment key={p.id}>
                        <CalendarBar kind="plan" title={p.title} range={formatRange(p.start, p.end)} left={left} width={width} />
                        <button type="button" className={c.barBtn} style={{ left: `${left}%`, width: `${width}%` }} onClick={() => pick(p.id)} aria-label={`Plan: ${p.title}. Show details`} />
                      </Fragment>
                    );
                  })}
                </div>
              ))}
              {myPlans.length === 0 && !plan && <div className={c.emptyRow}>No plans yet. {ASSISTANT_HINT} It shows here.</div>}
            </div>
          </div>
        </div>
      </section>

      <section className={c.card} aria-label="Dates">
        <div className={c.cardHead}>
          <h3 className={c.cardTitle}>Dates</h3>
          {dates.length > 0 && <span className={c.sub}>{showAllDates ? 'Every date, soonest first' : 'What’s next, soonest first'}</span>}
        </div>
        {dates.length > 0 ? (
          <>
            {dateGroups.map((g) => (
              <div key={g.label} className={c.group}>
                <h4 className={c.groupHead}>{g.label}</h4>
                <ol className={c.list}>{g.items.map(dateRow)}</ol>
              </div>
            ))}
            {dateGroups.length === 0 && <p className={c.sub}>Nothing starts or ends in the next two weeks.</p>}
            {(hiddenDates > 0 || showAllDates) && (
              <div>
                <button type="button" className={c.moreBtn} aria-expanded={showAllDates} onClick={() => setShowAllDates((v) => !v)}>
                  {showAllDates ? 'Show fewer dates' : `Show ${hiddenDates} more ${hiddenDates === 1 ? 'date' : 'dates'}`}
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <p className={c.sub}>Nothing on the lists in the next five weeks. Know an event or banner that’s coming? Add it yourself.</p>
            <div className={c.addOwn}>
              {addOwn('events')}
              {addOwn('banners')}
            </div>
          </>
        )}
      </section>

      {undone && (
        <ExampleNotice
          actions={[
            {
              label: 'Bring it back',
              onClick: () => {
                setPlanStatus(undone.game.id, undone.plan.id, 'active');
                setUndone(null);
              },
            },
          ]}
        >
          Plan “{undone.plan.title}” undone. It’s kept, just no longer on your calendar.
        </ExampleNotice>
      )}

      <BottomSheet open={picked !== null} title={picked === 'example' ? 'Example plan' : 'Your plan'} onClose={() => setPicked(null)} side>
        {picked === 'example' && plan ? (
          <div className={c.details}>
            <p className={c.itemTitle}>
              {plan.title} <ExampleTag />
            </p>
            <p className={c.range}>{formatRange(plan.start, plan.end)}</p>
            <p className={c.sub}>This plan is an example of how a plan looks. It isn’t saved. {ASSISTANT_HINT}</p>
          </div>
        ) : picked && picked !== 'example' ? (
          <PlanDetails
            game={picked.game}
            plan={picked.plan}
            tags={tags}
            onUndo={() => {
              setPlanStatus(picked.game.id, picked.plan.id, 'undone');
              setUndone(picked);
              setPicked(null);
            }}
          />
        ) : null}
      </BottomSheet>

      <HowTo
        steps={[
          'The timeline runs from a week ago to five weeks ahead. The white line is now.',
          'Bars that don’t overlap share a row. A busy lane shows what changes soonest; tap “Show N more” for the rest.',
          'Solid bars are confirmed dates. Dashed, striped bars are leaks: marked ? UNVERIFIED, with their source.',
          'Weekly resets follow the server you chose; tap “Choose server” if they are missing.',
          'On a phone, swipe the timeline sideways. The Dates list underneath shows what’s next (up to two weeks ahead), soonest first, with a countdown; “Show N more dates” opens every date.',
          'Plans you approve from the Assistant appear in “Your plans” with a dashed outline. Tap one to see it or undo it.',
        ]}
      />
    </div>
  );
}

function LaneRows({ label, noun, now, example, spans, pct, tags, addOwn }: { label: string; noun: string; now: number; example: boolean; spans: Span[]; pct: (t: number) => number; tags: boolean; addOwn?: ReactNode }) {
  const [open, setOpen] = useState(false);
  // One block of rows per game (All games), each packed tight; a busy game shows its soonest changes first.
  const byGame = new Map<GameId, Span[]>();
  for (const s of spans) byGame.set(s.game.id, [...(byGame.get(s.game.id) ?? []), s]);
  const folded = [...byGame.values()].map((list) => foldRows(list, now, ROWS_PER_GAME));
  const hidden = folded.reduce((n, f) => n + f.hidden.length, 0);
  const blocks = folded.map((f) => packRows(open ? [...f.shown, ...f.hidden] : f.shown));
  return (
    <>
      <div className={c.laneHead}>
        {label}
        {example && <ExampleTag />}
      </div>
      {spans.length === 0 && (
        <div className={c.emptyRow}>
          Nothing in these six weeks.
          {addOwn}
        </div>
      )}
      {blocks.map((rows, b) =>
        rows.map((row, i) => (
          <div key={`${b}:${i}`} className={b > 0 && i === 0 ? `${c.row} ${c.gameBreak}` : c.row}>
            {row.map((s) => {
              const left = pct(s.start);
              return (
                <CalendarBar
                  key={`${s.game.id}:${s.id}`}
                  kind={s.leak ? 'leak' : 'confirmed'}
                  title={s.title}
                  range={formatRange(s.start, s.end)}
                  left={left}
                  width={Math.max(2, pct(s.end) - left)}
                  vent={s.game.vent}
                  tag={tags ? { label: s.game.short, vent: s.game.vent } : undefined}
                  source={s.leak?.source}
                />
              );
            })}
          </div>
        )),
      )}
      {hidden > 0 && (
        <div className={c.moreRow}>
          <button type="button" className={c.moreBtn} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {open ? `Show fewer ${noun}` : `Show ${hidden} more ${hidden === 1 ? noun.replace(/s$/, '') : noun}`}
          </button>
        </div>
      )}
    </>
  );
}

function Resets({ timelines, pct, tags, chooseServer }: { timelines: { game: GameContract; timeline: GameTimeline }[]; pct: (t: number) => number; tags: boolean; chooseServer: (id: GameId) => void }) {
  return (
    <>
      <div className={c.laneHead}>Weekly resets</div>
      {timelines.map(({ game, timeline }) =>
        timeline.resets ? (
          <div key={game.id} className={c.row}>
            {timeline.resets.map((r) => (
              <span key={r} className={c.resetMark} style={{ left: `${pct(r)}%`, '--tag-vent': game.vent } as CSSProperties} title={formatDateTime(r)}>
                Weekly reset{tags ? ` · ${game.short}` : ''}
              </span>
            ))}
          </div>
        ) : (
          <div key={game.id} className={c.emptyRow}>
            Choose your {game.short} server to see its weekly resets.
            <button type="button" className={c.linkBtn} onClick={() => chooseServer(game.id)}>
              Choose server
            </button>
          </div>
        ),
      )}
    </>
  );
}

/** One of your plans: what, when, its steps, and Undo. */
function PlanDetails({ game, plan, tags, onUndo }: { game: GameContract; plan: UserPlan; tags: boolean; onUndo: () => void }) {
  const start = Date.parse(plan.start);
  const end = plan.end ? Date.parse(plan.end) : null;
  return (
    <div className={c.details}>
      <p className={c.itemTitle}>
        {plan.title} {tags && <GameTag label={game.short} vent={game.vent} />}
      </p>
      <p className={c.range}>{end ? formatRange(start, end) : formatDateTime(start)}</p>
      <p className={c.sub}>{plan.source === 'assistant' ? 'Proposed by the Assistant, approved by you.' : 'Made by you.'}</p>
      {plan.note && <p className={c.sub}>{plan.note}</p>}
      {plan.steps && plan.steps.length > 0 && (
        <ol className={c.steps}>
          {plan.steps.map((st, i) => (
            <li key={i}>
              {st.title}
              {st.minutes ? ` · ${st.minutes} min` : ''}
              {st.items?.length ? ` · ${st.items.join(', ')}` : ''}
            </li>
          ))}
        </ol>
      )}
      <div>
        <Button onClick={onUndo}>Undo plan</Button>
      </div>
      <p className={c.sub}>Undo takes it off your calendar. It isn’t deleted: you can bring it back right after.</p>
    </div>
  );
}

const EMPTY_LISTS: GameLists = { characters: [], banners: [], events: [], versions: [], materials: [] };

const joinWords = (w: string[]) => (w.length <= 1 ? (w[0] ?? '') : `${w.slice(0, -1).join(', ')} and ${w[w.length - 1]}`);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
