import { useEffect, useRef, type CSSProperties } from 'react';
import type { GameContract, GameId } from '../../core/contract';
import { useExamplesShown } from '../../core/data/prefs';
import type { UserPlan } from '../../core/data/userData';
import { formatDateTime, formatRange } from '../../core/time/reset';
import { CalendarBar, ExampleNotice, ExampleTag, GameTag, HowTo, Timer, UnverifiedTag } from '../../core/ui';
import type { GameLists } from '../today/lists';
import { gameTimeline, type GameTimeline, type Lane, type Span } from './timeline';
import c from './calendar.module.css';

const DAY = 86_400_000;
/** Design: one week back, five ahead. */
const DAYS_BACK = 7;
const DAYS_AHEAD = 35;

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

const LANES: { id: Lane; label: string }[] = [
  { id: 'banners', label: 'Banners' },
  { id: 'events', label: 'Events' },
  { id: 'endgame', label: 'Endgame' },
  { id: 'version', label: 'Version' },
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

/** Calendar (R41), drawn to the design's Calendar: legend, timeline with lanes and a today line, then every date in order. */
export function Calendar({ games, servers, lists, now, openAccount, openServer, plans: mine = [] }: CalendarProps) {
  const tags = games.length > 1;
  const day0 = localDayStart(now);
  const from = day0 - DAYS_BACK * DAY;
  const to = day0 + DAYS_AHEAD * DAY;
  const pct = (t: number) => Math.min(100, Math.max(0, ((t - from) / (to - from)) * 100));

  const showExamples = useExamplesShown();
  const timelines = games.map((game) => {
    const l = lists[game.id] ?? { characters: [], banners: [], events: [], versions: [], materials: [] };
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

  // Mondays get a tick, as in the design.
  const ticks: number[] = [];
  for (let d = 0; d <= DAYS_BACK + DAYS_AHEAD; d++) {
    const t = from + d * DAY;
    if (new Date(t).getDay() === 1) ticks.push(t);
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

  // The list under the timeline: everything not over yet, by start date.
  const all = timelines.flatMap(({ timeline }) => timeline.spans);
  const dates = [...all, ...myPlans, ...(plan ? [plan] : [])].filter((s) => s.end >= now).sort((a, b) => a.start - b.start || a.end - b.end);

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
                  {new Date(t).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
              ))}
            </div>
            <div className={c.lanes}>
              {ticks.map((t) => (
                <span key={t} className={c.gridLine} style={{ left: `${pct(t)}%` }} aria-hidden="true" />
              ))}
              <span className={c.today} style={{ left: `${todayPct}%` }} aria-hidden="true" />
              {LANES.map((lane) => (
                <LaneRows key={lane.id} label={lane.label} example={laneExample(lane.id)} spans={timelines.flatMap(({ timeline }) => timeline.spans.filter((s) => s.lane === lane.id))} pct={pct} tags={tags} />
              ))}
              <Resets timelines={timelines} pct={pct} tags={tags} chooseServer={chooseServer} />
              <div className={c.laneHead}>
                Your plans
                {plan && <ExampleTag />}
              </div>
              {myPlans.map((p) => (
                <div key={p.id} className={c.row}>
                  <CalendarBar kind="plan" title={p.title} range={formatRange(p.start, p.end)} left={pct(p.start)} width={Math.max(2, pct(p.end) - pct(p.start))} />
                </div>
              ))}
              {myPlans.length > 0 ? null : plan ? (
                <div className={c.row}>
                  <CalendarBar kind="plan" title={plan.title} range={formatRange(plan.start, plan.end)} left={pct(plan.start)} width={Math.max(2, pct(plan.end) - pct(plan.start))} />
                </div>
              ) : (
                <div className={c.emptyRow}>Plans you approve from the Assistant will show here.</div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className={c.card} aria-label="Dates">
        <h3 className={c.cardTitle}>Dates</h3>
        {dates.length > 0 ? (
          <ol className={c.list}>
            {dates.map((s) => (
              <li key={`${s.game.id}:${s.id}`} className={c.item}>
                <span className={c.mark} style={{ background: s.game.vent }} aria-hidden="true" />
                <span className={c.what}>
                  <span className={c.itemTitle}>{s.title}</span>
                  <span className={c.range}>{formatRange(s.start, s.end)}</span>
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
            ))}
          </ol>
        ) : (
          <p className={c.sub}>Nothing on the lists in the next five weeks.</p>
        )}
      </section>

      <HowTo
        steps={[
          'The timeline runs from a week ago to five weeks ahead. The white line is now.',
          'Solid bars are confirmed dates. Dashed, striped bars are leaks: marked ? UNVERIFIED, with their source.',
          'Weekly resets follow the server you chose; tap “Choose server” if they are missing.',
          'On a phone, swipe the timeline sideways. The Dates list underneath has every date in order, with a countdown.',
          'Plans you approve from the Assistant appear in “Your plans” with a dashed outline.',
        ]}
      />
    </div>
  );
}

function LaneRows({ label, example, spans, pct, tags }: { label: string; example: boolean; spans: Span[]; pct: (t: number) => number; tags: boolean }) {
  const sorted = [...spans].sort((a, b) => a.start - b.start || a.end - b.end);
  return (
    <>
      <div className={c.laneHead}>
        {label}
        {example && <ExampleTag />}
      </div>
      {sorted.length === 0 && <div className={c.emptyRow}>Nothing in these six weeks.</div>}
      {sorted.map((s) => {
        const left = pct(s.start);
        return (
          <div key={`${s.game.id}:${s.id}`} className={c.row}>
            <CalendarBar
              kind={s.leak ? 'leak' : 'confirmed'}
              title={s.title}
              range={formatRange(s.start, s.end)}
              left={left}
              width={Math.max(2, pct(s.end) - left)}
              vent={s.game.vent}
              tag={tags ? { label: s.game.short, vent: s.game.vent } : undefined}
              source={s.leak?.source}
            />
          </div>
        );
      })}
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

const joinWords = (w: string[]) => (w.length <= 1 ? (w[0] ?? '') : `${w.slice(0, -1).join(', ')} and ${w[w.length - 1]}`);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
