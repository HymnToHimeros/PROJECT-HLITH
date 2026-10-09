/**
 * Builds the schedule snapshot (supabase/functions/_shared/schedule.ts) from the
 * game records and your own data. Real lists only: example banners and events are
 * never sent to the server, the calendar feed or the evening message.
 */
import type { GameContract, GameId } from '../../core/contract';
import { gameData } from '../../core/data/userData';
import { buildTasks } from '../today/tasks';
import type { Schedule, ScheduleDate, ScheduleGame } from '../../../supabase/functions/_shared/schedule.ts';

const DAY = 86_400_000;

export async function buildSnapshot(games: GameContract[], servers: Record<GameId, string>, now: number, hiddenTasks: Record<GameId, string[]> = {}): Promise<Schedule> {
  const out: Schedule = { games: [], dates: [], openTasks: [], savedAt: new Date(now).toISOString() };
  for (const game of games) {
    const server = game.servers.find((s) => s.id === servers[game.id]);
    if (!server) continue; // no server chosen: no reset times we could stand behind
    const entry: ScheduleGame = { id: game.id, short: game.short, name: game.name, serverLabel: server.label, utcOffset: server.utcOffset, resetHour: game.reset.hour, resetWeekday: game.reset.weekday };
    out.games.push(entry);
    const user = gameData(game.id);
    const [banners, events] = await Promise.all([game.data.banners(), game.data.events()]);
    const horizon = now + 63 * DAY;
    const keep = (start: string, end: string) => Date.parse(end) > now - 7 * DAY && Date.parse(start) < horizon;
    for (const b of banners) {
      if (!keep(b.start, b.end)) continue;
      const d: ScheduleDate = { game: game.id, kind: 'banner', title: b.title, start: b.start, end: b.end };
      if (b.featured.some((id) => user.roster[id]?.wanted)) d.wanted = true;
      if (b.leak) d.unverified = true;
      out.dates.push(d);
    }
    for (const e of events) {
      if (!keep(e.start, e.end) || (user.events[e.id]?.state ?? 'open') !== 'open') continue;
      const d: ScheduleDate = { game: game.id, kind: e.kind === 'endgame' ? 'endgame' : 'event', title: e.title, start: e.start, end: e.end };
      if (e.leak) d.unverified = true;
      out.dates.push(d);
    }
    const hidden = new Set(hiddenTasks[game.id] ?? []);
    const tasks = buildTasks({ game, serverId: server.id, user, events, farmNames: [], now }).filter((t) => !t.done && !hidden.has(t.id));
    out.openTasks?.push(...tasks.map((t) => ({ game: game.id, label: t.label })));
  }
  return out;
}
