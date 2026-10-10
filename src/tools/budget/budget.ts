/**
 * The one pull-budget engine (docs/PLAN.md §4, FEATURES Connection 1).
 * Pure: no React, no database. Planner, Calculator, Today, Banners, the evening
 * message and the Assistant all call budget() with different horizons.
 *
 * Rules (each has a test in budget.test.ts):
 *  1. Only the future counts: income claimable in (now, until], plus anything
 *     claimable right now that isn't claimed yet. Past rewards are in the bank.
 *  2. Daily / weekly / pass / cycle income for the current period counts only if
 *     it isn't marked done for that period.
 *  3. Done and skipped events count zero; open events count if they end after now.
 *  4. Login events count the days left to claim, limited by days left to claim them.
 *  5. Endgame cycles count each cycle start in the window (needs a known anchor).
 *  6. A monthly pass counts per day while active, never past its end.
 *  7. Paid rows count only when "paid extras" is on.
 *  8. Enabled Backlog categories add their rewards left; income rows covered by an
 *     enabled category are skipped, so nothing is counted twice.
 *  9. Unknown amounts are left out and listed by name. Never a zero or a guess.
 * 10. No bank → no total (rows are still listed).
 * 11. Pulls = floor(premium / per-pull) + pull items usable on that banner.
 */
import type { GameContract, IncomeRow } from '../../core/contract';
import { known, unknown, type Known } from '../../core/contract/known';
import { dailyResetsBetween, serverRule, weeklyResetsBetween, type ServerRule } from '../../core/time/reset';

export type Source = IncomeRow['source'] | 'backlog';

export interface BudgetInput {
  game: GameContract;
  serverId: string | undefined;
  now: number;
  until: number;
  /** Current balances by currency id. Unknown → no total. */
  bank: Known<Record<string, number>>;
  /** Income row ids already claimed in their current period (today, this week, this cycle). */
  doneThisPeriod?: ReadonlySet<string>;
  /** One-time income already claimed. */
  claimedOnce?: ReadonlySet<string>;
  events?: { id: string; title: string; reward: number | null; currency: string; end: number; state: 'open' | 'done' | 'skipped' }[];
  logins?: { id: string; title: string; perDay: number | null; currency: string; days: number; daysClaimed: number; claimedToday: boolean; end: number }[];
  backlog?: { category: string; label: string; enabled: boolean; rewardLeft: number | null; currency: string }[];
  /** Active passes: income row id → when the pass runs out. */
  passes?: Record<string, number>;
  /** Cycle start anchors when the game record has none (e.g. from the owner's lists). */
  cycleAnchors?: Record<string, number>;
  paidExtras: boolean;
  /** Paid rows you switched off one by one while paid extras are on (income row ids). */
  paidOff?: string[] | undefined;
}

export type RowStatus =
  | 'counted'
  | 'already-earned'
  | 'skipped'
  | 'skipped-backlog'
  | 'off-paid'
  | 'not-active'
  | 'no-data';

export interface BudgetRow {
  id: string;
  label: string;
  source: Source;
  currency: string;
  occurrences: number;
  amount: number; // total in this window (0 unless counted)
  status: RowStatus;
  /** Why a row has no data: shown next to it. */
  reason?: string;
}

export interface Budget {
  rows: BudgetRow[];
  /** Counted income by currency (bank not included). */
  income: Record<string, number>;
  bySource: Partial<Record<Source, number>>;
  /** Bank + counted income by currency. */
  total: Known<Record<string, number>>;
  /** Labels of rows left out for lack of data. */
  leftOut: string[];
  /** Rewards in Backlog categories that are switched off, by currency. */
  backlogPotential: Record<string, number>;
}

const DAY = 86_400_000;

export function budget(input: BudgetInput): Budget {
  const { game, now, until } = input;
  const done = input.doneThisPeriod ?? new Set<string>();
  const claimed = input.claimedOnce ?? new Set<string>();
  const rule: ServerRule | null = input.serverId ? serverRule(game, input.serverId) : null;
  const enabledBacklog = new Set((input.backlog ?? []).filter((b) => b.enabled).map((b) => b.category));
  const rows: BudgetRow[] = [];

  const push = (r: BudgetRow) => rows.push(r);
  const noData = (base: Omit<BudgetRow, 'occurrences' | 'amount' | 'status'>, reason: string) =>
    push({ ...base, occurrences: 0, amount: 0, status: 'no-data', reason });

  for (const row of game.income) {
    const base = { id: row.id, label: row.label, source: row.source, currency: row.currency };
    if (row.coveredByBacklog && enabledBacklog.has(row.coveredByBacklog)) {
      push({ ...base, occurrences: 0, amount: 0, status: 'skipped-backlog' });
      continue;
    }
    if (row.paid && (!input.paidExtras || input.paidOff?.includes(row.id))) {
      push({ ...base, occurrences: 0, amount: 0, status: 'off-paid' });
      continue;
    }
    const s = row.schedule;
    if (s.kind === 'from-events' || s.kind === 'from-login-events') continue; // expanded below

    // How many times this row pays out in the window.
    let occurrences: number | null;
    let reason = '';
    switch (s.kind) {
      case 'per-reset':
        occurrences = rule ? dailyResetsBetween(now, until, rule) + (done.has(row.id) ? 0 : 1) : null;
        reason = 'choose your server';
        break;
      case 'weekly':
        occurrences = rule ? weeklyResetsBetween(now, until, rule) + (done.has(row.id) ? 0 : 1) : null;
        reason = 'choose your server';
        break;
      case 'cycle': {
        const anchor = s.anchor ? Date.parse(s.anchor) : input.cycleAnchors?.[row.id];
        occurrences = anchor === undefined ? null : cycleStarts(anchor, s.days, now, until) + (done.has(row.id) ? 0 : 1);
        reason = 'cycle dates not known yet';
        break;
      }
      case 'pass': {
        const end = input.passes?.[row.id];
        if (end === undefined || end <= now) {
          push({ ...base, occurrences: 0, amount: 0, status: 'not-active' });
          continue;
        }
        occurrences = rule ? dailyResetsBetween(now, Math.min(until, end), rule) + (done.has(row.id) ? 0 : 1) : null;
        reason = 'choose your server';
        if (occurrences !== null) {
          const perDay = s.perDay;
          push({ ...base, occurrences, amount: occurrences * perDay, status: occurrences > 0 ? 'counted' : 'already-earned' });
          continue;
        }
        break;
      }
      case 'once': {
        const at = s.at ? Date.parse(s.at) : undefined;
        if (claimed.has(row.id) || (at !== undefined && at <= now && done.has(row.id))) {
          push({ ...base, occurrences: 0, amount: 0, status: 'already-earned' });
          continue;
        }
        occurrences = at === undefined || at <= until ? 1 : 0;
        break;
      }
    }
    if (occurrences === null) {
      noData(base, reason);
      continue;
    }
    if (row.amount === null) {
      noData(base, 'reward amount not known yet');
      continue;
    }
    push({ ...base, occurrences, amount: occurrences * row.amount, status: occurrences > 0 ? 'counted' : 'already-earned' });
  }

  // Events: open and ending after now count; done = already in the bank; skipped = zero.
  const eventRow = game.income.find((r) => r.schedule.kind === 'from-events');
  const eventsOff = eventRow && ((eventRow.coveredByBacklog && enabledBacklog.has(eventRow.coveredByBacklog)) || (eventRow.paid && (!input.paidExtras || Boolean(input.paidOff?.includes(eventRow.id)))));
  for (const e of eventsOff ? [] : (input.events ?? [])) {
    const base = { id: `event:${e.id}`, label: e.title, source: 'events' as const, currency: e.currency };
    if (e.state === 'done') push({ ...base, occurrences: 0, amount: 0, status: 'already-earned' });
    else if (e.state === 'skipped') push({ ...base, occurrences: 0, amount: 0, status: 'skipped' });
    else if (e.end <= now) push({ ...base, occurrences: 0, amount: 0, status: 'skipped', reason: 'ended' });
    else if (e.reward === null) noData(base, 'reward amount not known yet');
    else push({ ...base, occurrences: 1, amount: e.reward, status: 'counted' });
  }

  // Login events: days left to claim, limited by the days left to claim them.
  for (const l of input.logins ?? []) {
    const base = { id: `login:${l.id}`, label: l.title, source: 'login' as const, currency: l.currency };
    const remaining = Math.max(0, l.days - l.daysClaimed);
    if (remaining === 0) {
      push({ ...base, occurrences: 0, amount: 0, status: 'already-earned' });
      continue;
    }
    if (l.end <= now) {
      push({ ...base, occurrences: 0, amount: 0, status: 'skipped', reason: 'ended' });
      continue;
    }
    if (!rule) {
      noData(base, 'choose your server');
      continue;
    }
    const daysLeft = dailyResetsBetween(now, Math.min(l.end, until), rule) + (l.claimedToday ? 0 : 1);
    const n = Math.min(remaining, Math.max(0, daysLeft));
    if (l.perDay === null) noData(base, 'reward amount not known yet');
    else push({ ...base, occurrences: n, amount: n * l.perDay, status: n > 0 ? 'counted' : 'already-earned' });
  }

  // Backlog: enabled categories count any time; disabled ones are potential.
  const backlogPotential: Record<string, number> = {};
  for (const b of input.backlog ?? []) {
    const base = { id: `backlog:${b.category}`, label: b.label, source: 'backlog' as const, currency: b.currency };
    if (b.rewardLeft === null) {
      if (b.enabled) noData(base, 'reward amount not known yet');
      continue;
    }
    if (b.enabled) push({ ...base, occurrences: 1, amount: b.rewardLeft, status: b.rewardLeft > 0 ? 'counted' : 'already-earned' });
    else backlogPotential[b.currency] = (backlogPotential[b.currency] ?? 0) + b.rewardLeft;
  }

  const income: Record<string, number> = {};
  const bySource: Partial<Record<Source, number>> = {};
  for (const r of rows) {
    if (r.status !== 'counted') continue;
    income[r.currency] = (income[r.currency] ?? 0) + r.amount;
    bySource[r.source] = (bySource[r.source] ?? 0) + r.amount;
  }

  const total: Known<Record<string, number>> = input.bank.known
    ? known(addInto({ ...input.bank.value }, income), input.bank.source, input.bank.at)
    : unknown(input.bank.fix ?? 'enter-manually');

  return {
    rows,
    income,
    bySource,
    total,
    leftOut: rows.filter((r) => r.status === 'no-data').map((r) => r.label),
    backlogPotential,
  };
}

/** Pulls on a banner type from a set of balances (rule 11). */
export function pullsFor(game: GameContract, balances: Record<string, number>, bannerType: string): number {
  let premium = 0;
  let items = 0;
  for (const c of game.currencies) {
    const amount = balances[c.id] ?? 0;
    if (c.perPull && !c.paid) premium += amount / c.perPull;
    if (c.pullItemFor?.includes(bannerType)) items += amount;
  }
  return Math.floor(premium + 1e-9) + Math.floor(items);
}

/** Pulls from a budget's total; unknown when the bank is unknown. */
export function budgetPulls(game: GameContract, b: Budget, bannerType: string): Known<number> {
  return b.total.known ? known(pullsFor(game, b.total.value, bannerType), b.total.source, b.total.at) : unknown(b.total.fix ?? 'enter-manually');
}

/** How many cycle starts fall in (from, to]. */
export function cycleStarts(anchor: number, days: number, from: number, to: number): number {
  if (to <= from || days <= 0) return 0;
  const len = days * DAY;
  const first = Math.floor((from - anchor) / len) + 1; // first start strictly after `from`
  const last = Math.floor((to - anchor) / len); // last start at or before `to`
  return Math.max(0, last - first + 1);
}

function addInto(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  for (const [k, v] of Object.entries(b)) a[k] = (a[k] ?? 0) + v;
  return a;
}
