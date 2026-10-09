import type { Banner, GameContract, GameEvent, GameId, ModuleId } from '../../core/contract';
import { known, unknown } from '../../core/contract/known';
import { balances, EMPTY_GAME, setTick, type GameUserData } from '../../core/data/userData';
import { formatNumber } from '../../core/time/format';
import { formatDateTime, formatRange, formatTime, nextDailyReset, nextWeeklyReset, serverRule } from '../../core/time/reset';
import { BannerCard, Button, EventRow, ExampleNotice, ExampleTag, GameTag, StatTile, Timer } from '../../core/ui';
import { cx } from '../../core/ui/cx';
import { pullsFor } from '../budget/budget';
import { exampleEvents } from '../calendar/examples';
import { exampleBanners } from '../pulls/examples';
import type { GameLists } from './lists';
import { buildTasks, type Task } from './tasks';
import { TonightsRun } from './TonightsRun';
import { Wishlist } from './Wishlist';
import t from './today.module.css';

const DAY = 86_400_000;

export interface TodayProps {
  games: GameContract[];
  servers: Record<GameId, string>;
  lists: Record<GameId, GameLists>;
  user: Record<GameId, GameUserData>;
  now: number;
  open: (module: ModuleId, tab?: string) => void;
  openAccount: () => void;
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

/** Today (R42): resets, stamina, pulls available, tonight's run, dailies and weeklies, banners, events, wishlist. */
export function Today({ games, servers, lists, user, now, open, openAccount }: TodayProps) {
  const tags = games.length > 1;
  const days: GameToday[] = games.map((game) => {
    const l = lists[game.id] ?? { characters: [], banners: [], events: [], versions: [], materials: [] };
    const u = user[game.id] ?? EMPTY_GAME;
    const chosen = servers[game.id];
    const serverId = game.servers.some((s) => s.id === chosen) ? chosen : undefined;
    const farmNames = u.farm.map((id) => l.characters.find((c) => c.id === id)?.name ?? id);
    const tasks = serverId ? buildTasks({ game, serverId, user: u, events: l.events, farmNames, now }) : [];
    return {
      game,
      user: u,
      lists: l,
      serverId,
      banners: l.banners.length ? { list: l.banners, example: false } : { list: exampleBanners(game, l.characters, now), example: true },
      events: l.events.length ? { list: l.events, example: false } : { list: exampleEvents(game, now), example: true },
      tasks,
    };
  });
  const anyExample = days.some((d) => d.banners.example || d.events.example);
  const noServer = days.filter((d) => !d.serverId).map((d) => d.game);

  return (
    <div className={t.stack}>
      {anyExample && (
        <ExampleNotice>
          Banners and events marked EXAMPLE stand in until {tags ? 'the games’' : 'the game’s'} banner and event lists are added (that part is on us, not you).
          Your ticks, wanted characters and Farm list are always your own.
        </ExampleNotice>
      )}

      <div className={t.tiles}>
        {days.map((d) => (
          <Tiles key={d.game.id} day={d} tags={tags} now={now} open={open} openAccount={openAccount} />
        ))}
      </div>

      <div className={t.columns}>
        <div className={t.stack}>
          <TonightsRun tasks={days.flatMap((d) => d.tasks)} noServer={noServer} tags={tags} now={now} openAccount={openAccount} />
          <Checklist days={days} tags={tags} now={now} openAccount={openAccount} />
        </div>
        <div className={t.stack}>
          <Banners days={days} tags={tags} now={now} />
          <EventsEnding days={days} tags={tags} now={now} />
          <Wishlist
            games={days.map((d) => ({ game: d.game, user: d.user, characters: d.lists.characters, banners: d.banners.list, example: d.banners.example }))}
            tags={tags}
            now={now}
            openRoster={() => open('roster', 'characters')}
          />
        </div>
      </div>
    </div>
  );
}

function Tiles({ day, tags, now, open, openAccount }: { day: GameToday; tags: boolean; now: number; open: TodayProps['open']; openAccount: () => void }) {
  const { game, serverId } = day;
  const tag = tags ? { label: game.short, vent: game.vent } : undefined;
  const rule = serverId ? serverRule(game, serverId) : null;
  const daily = rule ? nextDailyReset(now, rule) : null;
  const weekly = rule ? nextWeeklyReset(now, rule) : null;
  const bank = balances(day.user.ledger);
  const main = game.bannerTypes.find((b) => b.target === 'character') ?? game.bannerTypes[0];
  return (
    <>
      <div className={t.bigTime}>
        <StatTile
          label="Daily reset"
          tag={tag}
          value={daily ? known(<Timer to={daily} />, 'official') : unknown('choose-server')}
          caption={daily ? `${formatTime(daily)} your time` : undefined}
          onFix={openAccount}
        />
      </div>
      <div className={t.bigTime}>
        <StatTile
          label="Weekly reset"
          tag={tag}
          value={weekly ? known(<Timer to={weekly} />, 'official') : unknown('choose-server')}
          caption={weekly ? `${formatDateTime(weekly)} your time` : undefined}
          onFix={openAccount}
        />
      </div>
      {game.stamina.map((pool) => (
        // Live stamina needs a game-account link; until then it is honestly unknown.
        <StatTile key={pool.id} label={`${pool.name} · max ${formatNumber(pool.max)}`} tag={tag} value={unknown('connect-account')} onFix={openAccount} />
      ))}
      {main && (
        <StatTile
          label="Pulls available"
          tag={tag}
          value={bank.known ? known(formatNumber(pullsFor(game, bank.value, main.id)), bank.source, bank.at) : unknown('enter-manually')}
          caption={bank.known ? `${main.label} · from your Bank log` : undefined}
          onFix={() => open('pulls', 'log')}
        />
      )}
    </>
  );
}

function Checklist({ days, tags, now, openAccount }: { days: GameToday[]; tags: boolean; now: number; openAccount: () => void }) {
  return (
    <section className={t.card} aria-label="Dailies and weeklies">
      <div className={t.cardHead}>
        <h3 className={t.cardTitle}>Dailies and weeklies</h3>
      </div>
      <p className={t.sub}>Tick what you’ve done. Ticks clear by themselves at your server’s next reset.</p>
      {days.map((d) => {
        // Without a server the tasks are listed but can't be ticked: we wouldn't know when to clear them.
        const fallback = d.game.servers[0]?.id;
        const tasks = d.serverId ? d.tasks : fallback ? buildTasks({ game: d.game, serverId: fallback, user: d.user, events: [], farmNames: [], now }) : [];
        const rule = d.serverId ? serverRule(d.game, d.serverId) : null;
        const groups = [
          { id: 'daily', label: rule ? `Daily · clears ${formatTime(nextDailyReset(now, rule))}` : 'Daily', rows: tasks.filter((x) => x.kind === 'daily' || x.kind === 'stamina') },
          { id: 'weekly', label: rule ? `Weekly · clears ${formatDateTime(nextWeeklyReset(now, rule))}` : 'Weekly', rows: tasks.filter((x) => x.kind === 'weekly') },
        ].filter((g) => g.rows.length > 0);
        return (
          <div key={d.game.id} className={t.stack} style={{ gap: 'var(--s-2)' }}>
            {tags && (
              <span className={t.label}>
                <GameTag label={d.game.short} vent={d.game.vent} />
              </span>
            )}
            {groups.length === 0 && <p className={t.muted}>The game record lists no daily or weekly tasks yet.</p>}
            {groups.map((g) => (
              <div key={g.id} className={t.stack} style={{ gap: 'var(--s-2)' }}>
                <span className={t.label}>{g.label}</span>
                <ul className={t.list}>
                  {g.rows.map((task) => {
                    const done = Boolean(d.serverId) && task.done;
                    return (
                      <li key={task.id}>
                        <label className={cx(t.task, done && t.done, !d.serverId && t.disabled)}>
                          <input
                            type="checkbox"
                            checked={done}
                            disabled={!d.serverId}
                            onChange={(e) => setTick(d.game.id, task.id, e.target.checked ? new Date(now).toISOString() : null)}
                            aria-label={task.label}
                          />
                          <span className={t.taskBody}>
                            <span className={t.taskTop}>
                              {task.label}
                              {task.reward && <span className={t.reward}>{task.reward}</span>}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {!d.serverId && groups.length > 0 && (
              <div className={t.prompt}>
                <p>Choose your {d.game.short} server so ticks clear at your reset.</p>
                <Button onClick={openAccount}>Choose server</Button>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

function Banners({ days, tags, now }: { days: GameToday[]; tags: boolean; now: number }) {
  const rows = days.flatMap((d) => d.banners.list.map((b) => ({ d, b, example: d.banners.example })));
  const live = rows.filter(({ b }) => Date.parse(b.start) <= now && Date.parse(b.end) > now).sort((x, y) => Date.parse(x.b.end) - Date.parse(y.b.end));
  const soon = rows.filter(({ b }) => Date.parse(b.start) > now && Date.parse(b.start) - now <= 42 * DAY).sort((x, y) => Date.parse(x.b.start) - Date.parse(y.b.start));
  const typeLabel = (g: GameContract, id: string) => g.bannerTypes.find((x) => x.id === id)?.label ?? id;
  return (
    <section className={t.card} aria-label="Live banners">
      <div className={t.cardHead}>
        <h3 className={t.cardTitle}>Live banners</h3>
      </div>
      {live.length > 0 ? (
        <div className={t.banners}>
          {live.map(({ d, b, example }) => (
            <div key={`${d.game.id}:${b.id}`} className={t.exWrap}>
              <BannerCard kind={typeLabel(d.game, b.type)} title={b.title} ends={Date.parse(b.end)} tag={tags ? { label: d.game.short, vent: d.game.vent } : undefined} unverified={b.leak} />
              {example && (
                <span className={t.exCorner}>
                  <ExampleTag />
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className={t.muted}>No banner on the list is live right now.</p>
      )}
      {soon.length > 0 && (
        <>
          <span className={t.label}>Coming up</span>
          <div className={t.list}>
            {soon.map(({ d, b, example }) => (
              <EventRow
                key={`${d.game.id}:${b.id}`}
                label={`${b.title} · ${typeLabel(d.game, b.type)} · ${formatRange(Date.parse(b.start), Date.parse(b.end))}`}
                tag={tags ? { label: d.game.short, vent: d.game.vent } : undefined}
                unverified={b.leak}
                end={
                  <span className={t.end}>
                    {example && <ExampleTag />}
                    <Timer to={Date.parse(b.start)} prefix="opens in" />
                  </span>
                }
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function EventsEnding({ days, tags, now }: { days: GameToday[]; tags: boolean; now: number }) {
  const rows = days
    .flatMap((d) => d.events.list.map((e) => ({ d, e, example: d.events.example })))
    .filter(({ d, e }) => Date.parse(e.start) <= now && Date.parse(e.end) > now && (d.user.events[e.id]?.state ?? 'open') === 'open')
    .sort((x, y) => Date.parse(x.e.end) - Date.parse(y.e.end))
    .slice(0, 6);
  return (
    <section className={t.card} aria-label="Events ending soon">
      <div className={t.cardHead}>
        <h3 className={t.cardTitle}>Events ending soon</h3>
      </div>
      {rows.length > 0 ? (
        <div className={t.list}>
          {rows.map(({ d, e, example }) => (
            <EventRow
              key={`${d.game.id}:${e.id}`}
              label={e.title}
              tag={tags ? { label: d.game.short, vent: d.game.vent } : undefined}
              unverified={e.leak}
              end={
                <span className={t.end}>
                  {example && <ExampleTag />}
                  <Timer to={Date.parse(e.end)} deadline prefix="ends in" />
                </span>
              }
            />
          ))}
        </div>
      ) : (
        <p className={t.muted}>No open event is running right now.</p>
      )}
    </section>
  );
}
