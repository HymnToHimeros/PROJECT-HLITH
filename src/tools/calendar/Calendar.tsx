import { useEffect, useRef, type CSSProperties } from 'react';
import type { GameContract, GameId } from '../../core/contract';
import { formatDate, formatDateTime, formatRange } from '../../core/time/reset';
import { Button, CalendarBar, ExampleNotice, ExampleTag, GameTag, NoData, UnverifiedTag } from '../../core/ui';
import type { GameLists } from '../today/lists';
import { gameTimeline, moments, type GameTimeline, type Lane, type Span } from './timeline';
import c from './calendar.module.css';

const DAY = 86_400_000;
const WEEKS_BACK = 1;
const WEEKS_TOTAL = 6;

export interface CalendarProps {
  games: GameContract[];
  servers: Record<GameId, string>;
  lists: Record<GameId, GameLists>;
  now: number;
  openAccount: () => void;
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

/** Calendar (R41): one week back, five ahead, today line; banners, events, endgame, version, resets, your plans. */
export function Calendar({ games, servers, lists, now, openAccount }: CalendarProps) {
  const tags = games.length > 1;
  const from = localDayStart(now) - WEEKS_BACK * 7 * DAY;
  const to = from + WEEKS_TOTAL * 7 * DAY;
  const pct = (t: number) => Math.min(100, Math.max(0, ((t - from) / (to - from)) * 100));

  const timelines = games.map((game) => {
    const l = lists[game.id] ?? { characters: [], banners: [], events: [], versions: [], materials: [] };
    return { game, timeline: gameTimeline({ game, serverId: servers[game.id], characters: l.characters, banners: l.banners, events: l.events, versions: l.versions, now, from, to }) };
  });
  const laneExample = (lane: Lane) => timelines.some(({ timeline }) => timeline.example[lane]);
  const anyExample = LANES.some((l) => laneExample(l.id));
  const upcoming = moments(timelines, now, to);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // On a phone the timeline scrolls sideways: start with today in view.
  const scroller = useRef<HTMLDivElement>(null);
  const todayPct = pct(now);
  useEffect(() => {
    const el = scroller.current;
    if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = Math.max(0, (todayPct / 100) * el.scrollWidth - 48);
  }, [todayPct]);

  const exampleParts = [laneExample('banners') && 'banners', laneExample('events') && 'events', laneExample('endgame') && 'endgame cycle dates', laneExample('version') && 'the version end'].filter(Boolean);

  return (
    <div className={c.stack}>
      {anyExample && (
        <ExampleNotice>
          {cap(joinWords(exampleParts as string[]))} marked EXAMPLE stand in until {tags ? 'the games’' : 'the game’s'} lists are added (that part is on us, not you).
        </ExampleNotice>
      )}

      <section className={c.card} aria-label="Timeline">
        <div className={c.cardHead}>
          <h3 className={c.cardTitle}>Next six weeks</h3>
          <span className={c.sub}>
            {formatRange(from, to - 1)} · your time ({zone})
          </span>
        </div>
        <div className={c.scroller} ref={scroller}>
          <div className={c.timeline}>
            <div className={c.scale} aria-hidden="true">
              {Array.from({ length: WEEKS_TOTAL }, (_, i) => from + i * 7 * DAY).map((t) => (
                <span key={t} className={c.scaleMark} style={{ left: `${pct(t)}%` }}>
                  {formatDate(t)}
                </span>
              ))}
            </div>
            <div className={c.lanes}>
              <div className={c.today} style={{ left: `${todayPct}%` }} aria-hidden="true">
                <span className={c.todayLabel}>TODAY</span>
              </div>
              {LANES.map((lane) => (
                <LaneRows key={lane.id} label={lane.label} example={laneExample(lane.id)} spans={timelines.flatMap(({ timeline }) => timeline.spans.filter((s) => s.lane === lane.id))} pct={pct} tags={tags} />
              ))}
              <Resets timelines={timelines} pct={pct} tags={tags} openAccount={openAccount} />
              <div className={c.laneHead}>Your plans</div>
              <div className={c.emptyRow}>Plans you approve from the Assistant will show here.</div>
            </div>
          </div>
        </div>
        <div className={c.legend}>
          <span>Solid bar: confirmed</span>
          <span>Dashed bar with ? UNVERIFIED: leak, source shown</span>
          <span>
            Monthly reset <NoData dash={false} />
          </span>
        </div>
      </section>

      <section className={c.card} aria-label="Coming up">
        <div className={c.cardHead}>
          <h3 className={c.cardTitle}>Coming up</h3>
          <span className={c.sub}>In date order, your time</span>
        </div>
        {upcoming.length > 0 ? (
          <ol className={c.list}>
            {upcoming.map((m) => (
              <li key={m.id} className={c.item}>
                <time className={c.when} dateTime={new Date(m.at).toISOString()}>
                  {formatDateTime(m.at)}
                </time>
                <span className={c.what}>
                  {m.text}
                  {tags && <GameTag label={m.game.short} vent={m.game.vent} />}
                  {m.example && <ExampleTag />}
                  {m.leak && <UnverifiedTag source={m.leak.source} />}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className={c.sub}>Nothing on the lists in the next five weeks.</p>
        )}
      </section>
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
              vent={tags ? s.game.vent : undefined}
              tag={tags ? { label: s.game.short, vent: s.game.vent } : undefined}
              source={s.leak?.source}
            />
          </div>
        );
      })}
    </>
  );
}

function Resets({ timelines, pct, tags, openAccount }: { timelines: { game: GameContract; timeline: GameTimeline }[]; pct: (t: number) => number; tags: boolean; openAccount: () => void }) {
  return (
    <>
      <div className={c.laneHead}>Weekly resets</div>
      {timelines.map(({ game, timeline }) =>
        timeline.resets ? (
          <div key={game.id} className={c.row}>
            {timeline.resets.map((r) => (
              <span key={r} className={c.resetMark} style={{ left: `${pct(r)}%`, ...(tags ? { '--tag-vent': game.vent } : {}) } as CSSProperties} title={formatDateTime(r)}>
                Reset{tags ? ` · ${game.short}` : ''}
              </span>
            ))}
          </div>
        ) : (
          <div key={game.id} className={c.emptyRow}>
            Choose your {game.short} server to see its weekly resets.
            <Button variant="quiet" onClick={openAccount}>
              Choose server
            </Button>
          </div>
        ),
      )}
    </>
  );
}

const joinWords = (w: string[]) => (w.length <= 1 ? (w[0] ?? '') : `${w.slice(0, -1).join(', ')} and ${w[w.length - 1]}`);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
