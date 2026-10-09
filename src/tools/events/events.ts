/**
 * Events logic, no React: grouping, endgame cycles and what each event still
 * gives. The amounts come from the one pull-budget engine (tools/budget), so
 * Events and Pulls can never disagree. `eventsForBudget` is the input the
 * Pulls screens pass to budget() to count events.
 */
import type { GameContract, GameEvent, IncomeRow } from '../../core/contract';
import { known } from '../../core/contract/known';
import type { EventProgress, GameUserData } from '../../core/data/userData';
import { budget, type Budget, type BudgetInput } from '../budget/budget';

const DAY = 86_400_000;

export type EventGroup = 'live' | 'upcoming' | 'ended';

export function groupOf(e: GameEvent, now: number): EventGroup {
  if (Date.parse(e.end) <= now) return 'ended';
  if (Date.parse(e.start) > now) return 'upcoming';
  return 'live';
}

/** Live (ending soonest first), upcoming (starting soonest first), ended (most recent first). */
export function groupEvents(list: GameEvent[], now: number): Record<EventGroup, GameEvent[]> {
  const out: Record<EventGroup, GameEvent[]> = { live: [], upcoming: [], ended: [] };
  for (const e of list) out[groupOf(e, now)].push(e);
  out.live.sort((a, b) => Date.parse(a.end) - Date.parse(b.end));
  out.upcoming.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  out.ended.sort((a, b) => Date.parse(b.end) - Date.parse(a.end));
  return out;
}

export const progressOf = (user: GameUserData, id: string): EventProgress => user.events[id] ?? { state: 'open' };

// ── Endgame cycles (income rows with schedule kind 'cycle') ─────────────

export interface Cycle {
  row: IncomeRow;
  days: number;
  /** Known only when the game record has an anchor date. */
  current: { start: number; end: number; key: string } | null;
}

export function cycles(game: GameContract, now: number): Cycle[] {
  const out: Cycle[] = [];
  for (const row of game.income) {
    const s = row.schedule;
    if (s.kind !== 'cycle') continue;
    if (!s.anchor || s.days <= 0) {
      out.push({ row, days: s.days, current: null });
      continue;
    }
    const anchor = Date.parse(s.anchor);
    const len = s.days * DAY;
    const start = anchor + Math.floor((now - anchor) / len) * len;
    // Your state is saved per cycle, so a new cycle starts open again.
    out.push({ row, days: s.days, current: { start, end: start + len, key: `${row.id}@${new Date(start).toISOString()}` } });
  }
  return out;
}

// ── Budget input ───────────────────────────────────────────────────────

/** Which events count toward "still to earn" before `until`: confirmed ones that start before it. */
export const countsBefore = (e: GameEvent, until: number) => !e.leak && Date.parse(e.start) < until;

/**
 * What budget() needs to count events, login days and endgame cycles. Done
 * events are already in the bank, skipped ones count zero, open login events
 * count their unclaimed days. A skipped login event is passed as a skipped event.
 */
export function eventsForBudget(
  game: GameContract,
  list: GameEvent[],
  user: GameUserData,
  now: number,
  until: number,
): Pick<BudgetInput, 'events' | 'logins' | 'doneThisPeriod'> {
  const events: NonNullable<BudgetInput['events']> = [];
  const logins: NonNullable<BudgetInput['logins']> = [];
  for (const e of list) {
    if (!countsBefore(e, until)) continue;
    const p = progressOf(user, e.id);
    const end = Date.parse(e.end);
    if (e.kind === 'login' && e.loginDays && p.state === 'open') {
      logins.push({
        id: e.id,
        title: e.title,
        perDay: e.reward === null ? null : e.reward / e.loginDays,
        currency: e.currency,
        days: e.loginDays,
        daysClaimed: p.daysClaimed ?? 0,
        // We don't know whether today's day is claimed yet; the unclaimed-days limit keeps this honest.
        claimedToday: false,
        end,
      });
    } else {
      events.push({ id: e.id, title: e.title, reward: e.reward, currency: e.currency, end, state: p.state });
    }
  }
  // Endgame cycles you marked done or skipped this cycle don't count again until the next one.
  const doneThisPeriod = new Set<string>();
  for (const c of cycles(game, now)) if (c.current && progressOf(user, c.current.key).state !== 'open') doneThisPeriod.add(c.row.id);
  return { events, logins, doneThisPeriod };
}

/**
 * Everything still to earn from events (and endgame cycles) until `until`.
 * Endgame cycles from the game record are counted only when the event list
 * has no endgame entries of its own, so nothing is counted twice.
 */
export function eventsBudget(game: GameContract, list: GameEvent[], user: GameUserData, now: number, until: number, serverId: string | undefined): Budget {
  const listHasEndgame = list.some((e) => e.kind === 'endgame');
  const income = game.income.filter((r) => r.schedule.kind === 'from-events' || (!listHasEndgame && r.schedule.kind === 'cycle'));
  return budget({
    game: { ...game, income },
    serverId,
    now,
    until,
    bank: known({}, 'user'),
    paidExtras: user.paidExtras,
    ...eventsForBudget(game, list, user, now, until),
  });
}
