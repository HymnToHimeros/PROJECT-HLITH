/**
 * Ticks that HoYoLAB's numbers prove, taken on each live stamina read (owner's ask):
 * - Stamina spent: the new read is lower than the last read counted forward with the
 *   game's rate. Stamina only goes up by itself, so a drop means it was spent. It counts
 *   only when the last read was in the same game day (otherwise the spending may have
 *   been yesterday).
 * - Dailies done: HoYoLAB's daily activity is full (HSR Daily Training, ZZZ Daily
 *   Engagement), so the game's daily income row is done.
 * Honest data: nothing else is ticked. Each task is ticked by HoYoLAB at most once per
 * period, so if you untick it, it stays unticked.
 */
import type { GameContract } from '../../core/contract';
import type { ServerRule } from '../../core/time/reset';
import { projectStamina, type StaminaReading } from '../account-links/liveStamina';
import { periodStart, tickCounts } from './tasks';

export interface AutoTick {
  taskId: string;
  /** When the numbers proved it (the read time). */
  at: string;
  why: string;
}

interface Input {
  game: GameContract;
  rule: ServerRule;
  previous: StaminaReading | null;
  next: StaminaReading;
  dailies: { current: number; max: number } | null | undefined;
  ticks: Record<string, string>;
}

export function autoTicks({ game, rule, previous, next, dailies, ticks }: Input): AutoTick[] {
  const at = next.readAt;
  const readMs = Date.parse(at);
  if (!Number.isFinite(readMs)) return [];
  const out: AutoTick[] = [];
  const open = (id: string) => !tickCounts(ticks[id], 'daily', readMs, rule);

  const pool = game.stamina[0];
  if (pool && previous) {
    const prevMs = Date.parse(previous.readAt);
    const sameDay = Number.isFinite(prevMs) && prevMs >= periodStart('daily', readMs, rule) && prevMs <= readMs;
    const expected = projectStamina(previous, pool, readMs).value;
    const id = `stamina:${pool.id}`;
    if (sameDay && next.current < expected && open(id)) {
      out.push({ taskId: id, at, why: `HoYoLAB: ${pool.name} went from ${expected} to ${next.current}, so it was spent` });
    }
  }

  if (dailies && dailies.max > 0 && dailies.current >= dailies.max) {
    for (const row of game.income) {
      const id = `income:${row.id}`;
      if (row.source === 'daily' && !row.paid && row.schedule.kind === 'per-reset' && open(id)) {
        out.push({ taskId: id, at, why: `HoYoLAB: daily activity ${dailies.current}/${dailies.max}` });
      }
    }
  }
  return out;
}

// What HoYoLAB ticked, per period, on this device: so a task you unticked isn't ticked again.
const KEY = 'hlith.autotick';
type Memo = Record<string, { period: string; why: string }>;

function readMemo(): Memo {
  try {
    const o: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return o && typeof o === 'object' ? (o as Memo) : {};
  } catch {
    return {};
  }
}

/** The reason HoYoLAB ticked this task in the current period, or null. */
export function autoTickWhy(gameId: string, taskId: string, rule: ServerRule, now: number): string | null {
  const m = readMemo()[`${gameId}:${taskId}`];
  return m && m.period === new Date(periodStart('daily', now, rule)).toISOString() ? m.why : null;
}

/** Keep only the ticks HoYoLAB hasn't made already this period, and remember them. */
export function claimAutoTicks(gameId: string, rule: ServerRule, ticks: AutoTick[]): AutoTick[] {
  const memo = readMemo();
  const fresh = ticks.filter((t) => {
    const period = new Date(periodStart('daily', Date.parse(t.at), rule)).toISOString();
    const key = `${gameId}:${t.taskId}`;
    if (memo[key]?.period === period) return false;
    memo[key] = { period, why: t.why };
    return true;
  });
  try {
    localStorage.setItem(KEY, JSON.stringify(memo));
  } catch {
    /* storage blocked: tick anyway, once */
  }
  return fresh;
}
