import type { CSSProperties } from 'react';
import type { Banner, GameContract, GameEvent, GameId, ModuleId, Version } from '../../core/contract';
import { known, unknown } from '../../core/contract/known';
import { getPrefs, useExamplesShown, usePrefs } from '../../core/data/prefs';
import { balances, EMPTY_GAME, setTick, type GameUserData } from '../../core/data/userData';
import { formatNumber } from '../../core/time/format';
import { formatTime, nextDailyReset, nextWeeklyReset, serverRule } from '../../core/time/reset';
import { BannerCard, CurrencyChip, ExampleNotice, ExampleTag, GameTag, HowTo, StatTile, Timer, UnverifiedTag } from '../../core/ui';
import { cx } from '../../core/ui/cx';
import { clock, fullInText, projectStamina, type LiveStamina } from '../account-links/liveStamina';
import { pullsFor } from '../budget/budget';
import { AddOwnButton, examplesFor } from './AddOwn';
import { autoTickWhy } from './autoTick';
import type { GameLists } from './lists';
import { buildTasks, type Task } from './tasks';
import { TonightsRun } from './TonightsRun';
import { Wishlist } from './Wishlist';
import t from './today.module.css';

const DAY = 86_400_000;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const utc = (h: number) => `UTC${h >= 0 ? '+' : '−'}${Math.abs(h)}`;
const two = (n: number) => String(n).padStart(2, '0');

export interface TodayProps {
  games: GameContract[];
  servers: Record<GameId, string>;
  lists: Record<GameId, GameLists>;
  user: Record<GameId, GameUserData>;
  now: number;
  open: (module: ModuleId, tab?: string) => void;
  openAccount: () => void;
  /** Open the server picker for one game (falls back to the Account panel). */
  openServer?: ((game: GameId) => void) | undefined;
  /** Live stamina per game (main pool), read from a linked HoYoLAB account. Absent = no link. */
  stamina?: Record<GameId, LiveStamina> | undefined;
  /** Read one game's stamina again now. */
  retryStamina?: ((game: GameId) => void) | undefined;
}

interface GameToday {
  game: GameContract;
  user: GameUserData;
  lists: GameLists;
  serverId: string | undefined;
  banners: { list: Banner[]; example: boolean };
  events: { list: GameEvent[]; example: boolean };
  tasks: Task[];
}

/**
 * Today (R42), drawn to the design's Today screen: reset, pulls and stamina tiles;
 * server and currency chips; Open tasks; Live banners; Coming up. Plus Tonight's
 * run and the Wishlist (Override 5: no design yet, built from the same parts).
 */
export function Today({ games, servers, lists, user, now, open, openAccount, openServer, stamina, retryStamina }: TodayProps) {
  const tags = games.length > 1;
  const prefs = usePrefs();
  const showExamples = useExamplesShown();
  const chooseServer = (id: GameId) => (openServer ? openServer(id) : openAccount());
  const days: GameToday[] = games.map((game) => {
    const l = lists[game.id] ?? { characters: [], banners: [], events: [], versions: [], materials: [] };
    const u = user[game.id] ?? EMPTY_GAME;
    const chosen = servers[game.id];
    const serverId = game.servers.some((s) => s.id === chosen) ? chosen : undefined;
    const farmNames = u.farm.map((id) => l.characters.find((c) => c.id === id)?.name ?? id);
    const hidden = new Set(prefs.hiddenTasks?.[game.id] ?? []);
    const tasks = serverId ? buildTasks({ game, serverId, user: u, events: l.real?.events ?? l.events, farmNames, now }).filter((x) => !hidden.has(x.id)) : [];
    return {
      game,
      user: u,
      lists: l,
      serverId,
      banners: { list: l.banners, example: l.banners.some((b) => l.exampleIds?.has(b.id)) },
      events: { list: l.events, example: l.events.some((e) => l.exampleIds?.has(e.id)) },
      tasks,
    };
  });
  const anyExample = days.some((d) => d.banners.example || d.events.example);
  const noServer = days.filter((d) => !d.serverId).map((d) => d.game);

  return (
    <div className={t.page}>
      {anyExample && (
        <ExampleNotice>
          Banners and events marked EXAMPLE stand in until {tags ? 'the games’' : 'the game’s'} banner and event lists are added (that part is on us, not you).
          Your ticks, wanted characters and Farm list are always your own.
        </ExampleNotice>
      )}

      <div className={t.tiles}>
        {days.map((d) => (
          <Tiles
            key={d.game.id}
            day={d}
            tags={tags}
            now={now}
            open={open}
            chooseServer={() => chooseServer(d.game.id)}
            openAccount={openAccount}
            live={stamina?.[d.game.id] ?? { state: 'none' }}
            retry={() => retryStamina?.(d.game.id)}
          />
        ))}
      </div>

      <div className={t.chipRow}>
        {days.map((d) => (
          <ServerChip key={d.game.id} game={d.game} serverId={d.serverId} onClick={() => chooseServer(d.game.id)} />
        ))}
        {days.map((d) => (
          <Currencies key={d.game.id} day={d} />
        ))}
      </div>

      <div className={t.columns}>
        <div className={t.stack}>
          <OpenTasks days={days} tags={tags} now={now} hideTicked={Boolean(prefs.hideTicked)} chooseServer={chooseServer} />
          <TonightsRun tasks={days.flatMap((d) => d.tasks)} noServer={noServer} tags={tags} now={now} openAccount={noServer[0] ? () => chooseServer(noServer[0]?.id ?? '') : openAccount} />
        </div>
        <div className={t.stack}>
          <LiveBanners days={days} tags={tags} now={now} showExamples={showExamples} />
          <ComingUp days={days} tags={tags} now={now} showExamples={showExamples} />
          <Wishlist
            games={days.map((d) => ({ game: d.game, user: d.user, characters: d.lists.characters, banners: d.banners.list, example: d.banners.example, exampleIds: d.lists.exampleIds }))}
            tags={tags}
            now={now}
            openRoster={() => open('roster', 'characters')}
          />
        </div>
      </div>

      <HowTo
        steps={[
          'Tap the Server chip and pick the server you play on. Resets, ticks and tonight’s order all follow it.',
          'Tick a task in Open tasks when you’ve done it. Ticks clear by themselves at your server’s next reset.',
          'Tonight’s run lists what’s left, whatever runs out first at the top.',
          'Pulls available comes from your Bank log (Pulls → Bank log). Stamina is read from HoYoLAB when an account is linked (Account → Connected accounts); until then it says No data yet.',
          'Mark characters as wanted in Roster: the Wishlist shows every banner they appear on.',
        ]}
      />
    </div>
  );
}

function Tiles({
  day,
  tags,
  now,
  open,
  chooseServer,
  openAccount,
  live,
  retry,
}: {
  day: GameToday;
  tags: boolean;
  now: number;
  open: TodayProps['open'];
  chooseServer: () => void;
  openAccount: () => void;
  live: LiveStamina;
  retry: () => void;
}) {
  const { game, serverId } = day;
  const tag = tags ? { label: game.short, vent: game.vent } : undefined;
  const server = game.servers.find((s) => s.id === serverId);
  const rule = serverId ? serverRule(game, serverId) : null;
  const daily = rule ? nextDailyReset(now, rule) : null;
  const weekly = rule ? nextWeeklyReset(now, rule) : null;
  const bank = balances(day.user.ledger);
  const main = game.bannerTypes.find((b) => b.target === 'character') ?? game.bannerTypes[0];
  const premium = game.currencies.find((c) => c.perPull && !c.paid);
  const item = main ? game.currencies.find((c) => c.pullItemFor?.includes(main.id)) : undefined;
  const formula =
    bank.known && premium
      ? `${formatNumber(bank.value[premium.id] ?? 0)} ${premium.name} ÷ ${premium.perPull ?? 160}${item ? ` + ${formatNumber(bank.value[item.id] ?? 0)} ${item.name}` : ''}`
      : undefined;
  return (
    <>
      <div className={t.bigTime}>
        <StatTile
          label="Daily reset"
          tag={tag}
          value={daily ? known(<Timer to={daily} />, 'official') : unknown('choose-server')}
          caption={server && daily ? `${two(game.reset.hour)}:00 ${server.label} server (${utc(server.utcOffset)}) · ${formatTime(daily)} your time` : undefined}
          onFix={chooseServer}
        />
      </div>
      <div className={t.bigTime}>
        <StatTile
          label="Weekly reset"
          tag={tag}
          value={weekly ? known(<Timer to={weekly} />, 'official') : unknown('choose-server')}
          caption={weekly ? `${WEEKDAYS[game.reset.weekday] ?? ''} ${two(game.reset.hour)}:00 server time` : undefined}
          onFix={chooseServer}
        />
      </div>
      {main && (
        <StatTile
          label="Pulls available"
          tag={tag}
          value={bank.known ? known(formatNumber(pullsFor(game, bank.value, main.id)), bank.source, bank.at) : unknown('enter-manually')}
          caption={formula}
          onFix={() => open('pulls', 'log')}
        />
      )}
      {game.stamina.map((pool, i) =>
        // HoYoLAB reports the main pool only; any other pool stays honestly unknown.
        i === 0 ? (
          <StaminaTile key={pool.id} label={pool.name} tag={tag} pool={pool} live={live} now={now} retry={retry} openAccount={openAccount} />
        ) : (
          <StatTile key={pool.id} label={pool.name} tag={tag} value={unknown('connect-account')} onFix={openAccount} />
        ),
      )}
    </>
  );
}

/**
 * The main stamina pool, live from HoYoLAB: "182/240", "Full in 5 h 47 min",
 * and when it was read. Counted forward between reads only when the game record's
 * rate agrees with HoYoLAB (liveStamina.ts). An error shows its reason and a retry.
 */
function StaminaTile({
  label,
  tag,
  pool,
  live,
  now,
  retry,
  openAccount,
}: {
  label: string;
  tag: { label: string; vent: string } | undefined;
  pool: GameContract['stamina'][number];
  live: LiveStamina;
  now: number;
  retry: () => void;
  openAccount: () => void;
}) {
  if (live.state === 'none') return <StatTile label={label} tag={tag} value={unknown('connect-account')} onFix={openAccount} />;
  if (live.state === 'loading')
    return (
      <div className={t.liveTile}>
        <StatTile label={label} tag={tag} value={unknown()} />
        <span className={t.liveNote} role="status">
          Reading from HoYoLAB…
        </span>
      </div>
    );
  const reading = live.reading;
  // After a failed re-read the last answer is shown as it was, not counted forward.
  const p = reading ? (live.state === 'ok' ? projectStamina(reading, pool, now) : projectStamina(reading, undefined, Date.parse(reading.readAt))) : null;
  const full = p ? fullInText(p.fullInSeconds) : null;
  const when = reading ? clock(reading.readAt) : '';
  const caption = p && reading ? [full, p.projected ? `counted on from HoYoLAB’s read at ${when}` : `as of ${when} (HoYoLAB)`].filter(Boolean).join(' · ') : undefined;
  return (
    <div className={t.liveTile}>
      <StatTile
        label={label}
        tag={tag}
        value={p && reading ? known(`${formatNumber(p.value)}/${formatNumber(p.max)}`, 'hoyolab', reading.readAt) : unknown()}
        {...(p ? { progress: p.value / Math.max(1, p.max) } : {})}
        {...(caption ? { caption } : {})}
      />
      {live.state === 'ok' && live.refreshing && <span className={t.liveNote}>Reading again…</span>}
      {live.state === 'error' && (
        <span className={t.liveError} role="alert">
          {reading ? 'Couldn’t read it again: ' : 'Couldn’t read it: '}
          {live.text}{' '}
          <button type="button" className={t.liveRetry} onClick={retry}>
            Try again
          </button>
        </span>
      )}
    </div>
  );
}

/** Design: "HSR Server Europe ▼". Opens the server picker for that game. */
function ServerChip({ game, serverId, onClick }: { game: GameContract; serverId: string | undefined; onClick: () => void }) {
  const server = game.servers.find((s) => s.id === serverId);
  return (
    <button
      type="button"
      className={cx(t.serverChip, !server && t.serverChipEmpty)}
      onClick={onClick}
      aria-label={server ? `${game.short} server: ${server.label}. Change` : `Choose your ${game.short} server`}
    >
      <span className={t.chipTag} style={{ background: game.vent }}>
        {game.short}
      </span>
      Server
      <span className={t.chipValue}>{server ? server.label : 'Choose'}</span>
      <span className={t.chipCaret} aria-hidden="true">
        ▼
      </span>
    </button>
  );
}

function Currencies({ day }: { day: GameToday }) {
  const { game } = day;
  const bank = balances(day.user.ledger);
  const shown = game.currencies.filter((c) => (c.perPull && !c.paid) || c.pullItemFor?.length).slice(0, 2);
  return (
    <>
      {shown.map((c) => (
        <span key={c.id} style={{ '--vent': game.vent } as CSSProperties} className={t.chipWrap}>
          <CurrencyChip name={c.name} amount={bank.known && c.id in bank.value ? known(bank.value[c.id] ?? 0, bank.source, bank.at) : unknown('enter-manually')} />
        </span>
      ))}
    </>
  );
}

function OpenTasks({ days, tags, now, hideTicked, chooseServer }: { days: GameToday[]; tags: boolean; now: number; hideTicked: boolean; chooseServer: (id: GameId) => void }) {
  // Without a server the tasks are listed but can't be ticked: we wouldn't know when to clear them.
  const rows = days.flatMap((d) => {
    const fallback = d.game.servers[0]?.id;
    const hidden = new Set(getPrefs().hiddenTasks?.[d.game.id] ?? []);
    const list = d.serverId ? d.tasks : fallback ? buildTasks({ game: d.game, serverId: fallback, user: d.user, events: [], farmNames: [], now }).filter((x) => !hidden.has(x.id)) : [];
    // Event tasks list here too, so a tick made in Tonight's run can be taken back here.
    return list.map((task) => ({ d, task, done: Boolean(d.serverId) && task.done }));
  });
  // Counted like Tonight's run: only tasks that can be ticked (games with a server).
  const tickable = rows.filter((r) => r.d.serverId).length;
  const done = rows.filter((r) => r.done).length;
  const shown = hideTicked ? rows.filter((r) => !r.done) : rows;
  const missing = days.filter((d) => !d.serverId);
  return (
    <section className={t.card} aria-label="Open tasks">
      <div className={t.cardHead}>
        <h3 className={t.cardTitle}>Open tasks</h3>
        {tickable > 0 && (
          <span className={t.count}>
            {done}/{tickable}
          </span>
        )}
      </div>
      <div className={t.track} role="progressbar" aria-label="Tasks done" aria-valuenow={done} aria-valuemin={0} aria-valuemax={tickable}>
        <div className={t.fill} style={{ width: tickable ? `${(done / tickable) * 100}%` : '0%' }} />
      </div>
      {rows.length === 0 && <p className={t.muted}>The game record lists no daily or weekly tasks yet.</p>}
      <ul className={t.taskList}>
        {shown.map(({ d, task, done: isDone }) => (
          <li key={`${d.game.id}:${task.id}`}>
            <label className={cx(t.taskRow, isDone && t.done, !d.serverId && t.disabled)}>
              <input
                type="checkbox"
                className={t.checkInput}
                checked={isDone}
                disabled={!d.serverId}
                onChange={(e) => setTick(d.game.id, task.id, e.target.checked ? new Date(now).toISOString() : null)}
                aria-label={task.label}
              />
              <span className={t.checkBox} aria-hidden="true" style={{ '--box-vent': d.game.vent } as CSSProperties}>
                {isDone ? '✓' : ''}
              </span>
              <span className={t.taskLabel}>
                {task.label}
                {task.reward && <span className={t.reward}>{task.reward}</span>}
                {isDone && d.serverId && autoTickWhy(d.game.id, task.id, serverRule(d.game, d.serverId), now) && (
                  <span className={t.autoTick} title={autoTickWhy(d.game.id, task.id, serverRule(d.game, d.serverId), now) ?? undefined}>
                    ticked from HoYoLAB
                  </span>
                )}
              </span>
              {tags && <GameTag label={d.game.short} vent={d.game.vent} />}
              <span className={t.kind}>{task.kind === 'event' ? 'Event' : task.period === 'weekly' ? 'Weekly' : 'Daily'}</span>
            </label>
          </li>
        ))}
      </ul>
      {hideTicked && done > 0 && <p className={t.muted}>{done} ticked task{done === 1 ? '' : 's'} hidden (Account → Game settings).</p>}
      {missing.map((d) => (
        <div key={d.game.id} className={t.prompt}>
          <p>Choose your {d.game.short} server so ticks clear at your reset.</p>
          <button type="button" className={t.promptBtn} onClick={() => chooseServer(d.game.id)}>
            Choose server
          </button>
        </div>
      ))}
    </section>
  );
}

/** Ways forward from an empty card: add your own item for each game (examples passed so hidden ones can come back). */
function AddOwn({ days, kinds, tags, now, showExamples }: { days: GameToday[]; kinds: ('events' | 'banners')[]; tags: boolean; now: number; showExamples: boolean }) {
  return (
    <div className={t.addOwn}>
      {days.flatMap((d) => kinds.map((kind) => <AddOwnButton key={`${d.game.id}:${kind}`} game={d.game} kind={kind} tag={tags} examples={examplesFor(d.game, d.lists, kind, now, showExamples)} />))}
    </div>
  );
}

function LiveBanners({ days, tags, now, showExamples }: { days: GameToday[]; tags: boolean; now: number; showExamples: boolean }) {
  const rows = days.flatMap((d) => d.banners.list.map((b) => ({ d, b, example: Boolean(d.lists.exampleIds?.has(b.id)) })));
  const live = rows.filter(({ b }) => !b.permanent && Date.parse(b.start) <= now && Date.parse(b.end) > now).sort((x, y) => Date.parse(x.b.end) - Date.parse(y.b.end));
  const typeLabel = (g: GameContract, id: string) => g.bannerTypes.find((x) => x.id === id)?.label ?? id;
  // Sample art only ever decorates EXAMPLE banners.
  // Sample art only on examples; real banners use their own art or the lead character's portrait.
  const artFor = (d: GameToday, b: Banner, example: boolean) =>
    example ? d.lists.sampleArt?.find((s) => b.featured.includes(s.characterId))?.portrait : (b.art ?? d.lists.characters.find((c) => c.id === b.featured[0])?.portrait);
  return (
    <section className={t.card} aria-label="Live banners">
      <h3 className={t.cardTitle}>Live banners</h3>
      {live.length > 0 ? (
        <div className={t.banners}>
          {live.map(({ d, b, example }) => (
            <div key={`${d.game.id}:${b.id}`} className={t.exWrap} style={{ '--vent': d.game.vent } as CSSProperties}>
              <BannerCard kind={typeLabel(d.game, b.type)} title={b.title} ends={Date.parse(b.end)} art={artFor(d, b, example)} tag={tags ? { label: d.game.short, vent: d.game.vent } : undefined} unverified={b.leak} />
              {example && (
                <span className={t.exCorner}>
                  <ExampleTag />
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <>
          <p className={t.muted}>No banner on the list is live right now. Know one that’s missing? Add it yourself.</p>
          <AddOwn days={days} kinds={['banners']} tags={tags} now={now} showExamples={showExamples} />
        </>
      )}
    </section>
  );
}

interface Coming {
  key: string;
  game: GameContract;
  label: string;
  at: number;
  leak?: { source: string } | undefined;
  example: boolean;
}

function ComingUp({ days, tags, now, showExamples }: { days: GameToday[]; tags: boolean; now: number; showExamples: boolean }) {
  const items: Coming[] = [];
  for (const d of days) {
    const typeLabel = (id: string) => d.game.bannerTypes.find((x) => x.id === id)?.label ?? id;
    for (const b of d.banners.list) {
      const start = Date.parse(b.start);
      if (start > now && start - now <= 42 * DAY) items.push({ key: `b:${b.id}`, game: d.game, label: `${b.title} · ${typeLabel(b.type)} opens`, at: start, leak: b.leak, example: Boolean(d.lists.exampleIds?.has(b.id)) });
    }
    for (const e of d.events.list) {
      const start = Date.parse(e.start);
      const end = Date.parse(e.end);
      const state = d.user.events[e.id]?.state ?? 'open';
      if (start <= now && end > now && state === 'open') items.push({ key: `e:${e.id}`, game: d.game, label: `${e.title} ends`, at: end, leak: e.leak, example: Boolean(d.lists.exampleIds?.has(e.id)) });
      else if (start > now && start - now <= 42 * DAY) items.push({ key: `s:${e.id}`, game: d.game, label: `${e.title} starts`, at: start, leak: e.leak, example: Boolean(d.lists.exampleIds?.has(e.id)) });
    }
    const version = currentVersion(d.lists.versions, now);
    if (version) items.push({ key: `v:${version.id}`, game: d.game, label: `Version ${version.id} ends`, at: Date.parse(version.end), example: false });
  }
  const rows = items.sort((a, b) => a.at - b.at).slice(0, 8);
  return (
    <section className={t.card} aria-label="Coming up">
      <h3 className={t.cardTitle}>Coming up</h3>
      {rows.length > 0 ? (
        <div className={t.comingList}>
          {rows.map((r) => (
            <div key={`${r.game.id}:${r.key}`} className={t.comingRow}>
              <span className={t.comingMark} style={{ background: r.game.vent }} aria-hidden="true" />
              <span className={t.comingLabel}>{r.label}</span>
              {r.leak && <UnverifiedTag source={r.leak.source} />}
              {r.example && <ExampleTag />}
              {tags && <GameTag label={r.game.short} vent={r.game.vent} />}
              <Timer to={r.at} deadline={r.label.endsWith('ends')} className={t.comingWhen ?? ''} />
            </div>
          ))}
        </div>
      ) : (
        <>
          <p className={t.muted}>Nothing on the lists in the next six weeks. Know an event or banner that’s coming? Add it yourself.</p>
          <AddOwn days={days} kinds={['events', 'banners']} tags={tags} now={now} showExamples={showExamples} />
        </>
      )}
    </section>
  );
}

const currentVersion = (versions: Version[], now: number) => versions.find((v) => Date.parse(v.start) <= now && Date.parse(v.end) > now);
