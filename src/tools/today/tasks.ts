/**
 * Today's tasks, built from the game record: daily and weekly income rows,
 * spending stamina, and events about to end. A tick (userData.ticks) counts
 * only if it was made after the last reset, so ticks clear by themselves at
 * the next daily or weekly reset of your server. Pure: no React.
 */
import type { GameContract, GameEvent } from '../../core/contract';
import type { GameUserData } from '../../core/data/userData';
import { formatCountdown, formatNumber } from '../../core/time/format';
import { dayStart, formatDateTime, formatTime, nextDailyReset, nextWeeklyReset, serverRule, weekStart, type ServerRule } from '../../core/time/reset';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export type TaskKind = 'event' | 'daily' | 'stamina' | 'weekly';
export type Period = 'daily' | 'weekly';

export interface Task {
  /** Tick id in userData.ticks. */
  id: string;
  game: GameContract;
  kind: TaskKind;
  period: Period;
  label: string;
  reward?: string | undefined;
  /** When this task stops mattering: its reset, or the event's end. */
  deadline: number;
  /** One line: why it sits where it sits in tonight's run. */
  why: string;
  done: boolean;
}

/** When the current period began: a tick older than this no longer counts. */
export const periodStart = (period: Period, now: number, rule: ServerRule) => (period === 'daily' ? dayStart(now, rule) : weekStart(now, rule));

export function tickCounts(at: string | undefined, period: Period, now: number, rule: ServerRule): boolean {
  if (!at) return false;
  const t = Date.parse(at);
  return Number.isFinite(t) && t >= periodStart(period, now, rule) && t <= now + 60_000;
}

const RANK: Record<TaskKind, number> = { event: 0, daily: 1, stamina: 2, weekly: 3 };

/** Tonight's order: whatever runs out first goes first; on a tie, events, then dailies, stamina, weeklies. */
export const byUrgency = (a: Task, b: Task) => a.deadline - b.deadline || RANK[a.kind] - RANK[b.kind] || a.label.localeCompare(b.label);

const hours = (ms: number) => {
  const h = Math.floor(ms / HOUR);
  const m = Math.round((ms % HOUR) / 60_000);
  return m ? `${h}h ${m}m` : `${h}h`;
};

/** Events still running, not marked done or skipped, ending within a week. Only real events: examples are never tasks. */
export function eventsEndingSoon(events: GameEvent[], user: GameUserData, now: number, within = 7 * DAY): GameEvent[] {
  return events
    .filter((e) => Date.parse(e.start) <= now && Date.parse(e.end) > now && Date.parse(e.end) - now <= within)
    .filter((e) => (user.events[e.id]?.state ?? 'open') === 'open')
    .sort((a, b) => Date.parse(a.end) - Date.parse(b.end));
}

interface Input {
  game: GameContract;
  serverId: string;
  user: GameUserData;
  /** Real events only. */
  events: GameEvent[];
  /** Names of the characters on your Farm list, in order. */
  farmNames: string[];
  now: number;
}

/** Every task for one game whose server is known. */
export function buildTasks({ game, serverId, user, events, farmNames, now }: Input): Task[] {
  const rule = serverRule(game, serverId);
  const daily = nextDailyReset(now, rule);
  const weekly = nextWeeklyReset(now, rule);
  const currency = (id: string) => game.currencies.find((c) => c.id === id)?.name ?? id;
  const done = (id: string, period: Period) => tickCounts(user.ticks[id], period, now, rule);
  const out: Task[] = [];

  for (const row of game.income) {
    if (row.paid) continue;
    const period: Period | null = row.schedule.kind === 'per-reset' ? 'daily' : row.schedule.kind === 'weekly' ? 'weekly' : null;
    if (!period) continue;
    const id = `income:${row.id}`;
    const reward = row.amount === null ? undefined : `+${formatNumber(row.amount)} ${currency(row.currency)}`;
    const left = (period === 'daily' ? daily : weekly) - now;
    const why =
      period === 'daily'
        ? left < 3 * HOUR
          ? `Daily reset in ${formatCountdown(left)}: do it first`
          : `Clears at the daily reset, ${formatTime(daily)} your time`
        : left < DAY
          ? `Weekly reset in ${formatCountdown(left)}: this week’s reward is gone after that`
          : `Clears at the weekly reset, ${formatDateTime(weekly)} your time`;
    out.push({ id, game, kind: period, period, label: row.label, reward, deadline: period === 'daily' ? daily : weekly, why, done: done(id, period) });
  }

  for (const pool of game.stamina) {
    const id = `stamina:${pool.id}`;
    const fill = pool.max * pool.minutesPerPoint * 60_000;
    const spendOn = farmNames.length ? ` · spend it on ${list(farmNames)} (your Farm list)` : ' · pick characters in Farm to know what to spend it on';
    out.push({
      id,
      game,
      kind: 'stamina',
      period: 'daily',
      label: `Spend ${pool.name}`,
      deadline: daily,
      why: `Fills from empty to ${formatNumber(pool.max)} in ${hours(fill)}; anything past the cap is lost${spendOn}`,
      done: done(id, 'daily'),
    });
  }

  for (const e of eventsEndingSoon(events, user, now)) {
    const id = `event:${e.id}`;
    const end = Date.parse(e.end);
    const left = end - now;
    const why = end <= daily ? `Ends in ${formatCountdown(left)}, before the next reset: last chance tonight` : left < 72 * HOUR ? `Ends in ${formatCountdown(left)}: less than 3 days left` : `Ends in ${formatCountdown(left)}`;
    out.push({ id, game, kind: 'event', period: 'daily', label: e.kind === 'login' ? `Claim today’s login reward: ${e.title}` : `Play ${e.title}`, deadline: end, why, done: done(id, 'daily') });
  }
  return out;
}

const list = (names: string[]) => (names.length <= 2 ? names.join(' and ') : `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`);
