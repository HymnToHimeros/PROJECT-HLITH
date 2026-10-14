/**
 * Bank log logic, the same for every game. Stored entries are never changed:
 * everything here (the change a balance check makes, Earned or Spent from a
 * balance check, groups, totals) is worked out from them each time, so old
 * entries show the new way too.
 */
import type { Currency } from '../../core/contract';
import type { LedgerEntry } from '../../core/data/userData';

export type RowState = 'counted' | 'undone' | 'undo';
/** What a change counts as in the totals. */
export type Flow = 'earned' | 'bought' | 'spent';

export interface LogLine {
  entry: LedgerEntry;
  state: RowState;
  /** Balance of this currency right after the entry; null until the first balance check. */
  balance: number | null;
  /**
   * How much the entry moved the balance (minus = down). A balance check: what
   * it shows minus the balance expected from earlier entries (the last check
   * plus earned and bought, minus spent); null for the first check of a
   * currency, which has nothing to compare with. Undone entries keep what they
   * would have done, shown struck through.
   */
  change: number | null;
  /** A counted balance check that moved the balance: the difference counts as Earned (up) or Spent (down). */
  fromCheck?: 'earned' | 'spent';
}

/** Entries that don't count: every undone entry and every Undo entry (as in balances() in userData). */
export function undoneIds(entries: LedgerEntry[]): Set<string> {
  const out = new Set<string>();
  for (const e of entries) {
    if (!e.reverses) continue;
    out.add(e.id);
    out.add(e.reverses);
  }
  return out;
}

/**
 * Each entry in time order with the balance of its currency right after it and
 * the change it made. Undone entries and their Undo entries are listed but
 * skipped, so the balance matches balances() in userData.
 */
export function withBalances(entries: LedgerEntry[]): LogLine[] {
  const skip = undoneIds(entries);
  const sorted = [...entries].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  const bal: Record<string, number> = {};
  return sorted.map((entry) => {
    const state: RowState = entry.reverses ? 'undo' : skip.has(entry.id) ? 'undone' : 'counted';
    const before = entry.currency in bal ? (bal[entry.currency] ?? null) : null;
    const change = entry.kind === 'have' ? (state === 'counted' && before !== null ? entry.amount - before : null) : entry.kind === 'spent' ? -entry.amount : entry.amount;
    if (state === 'counted') {
      if (entry.kind === 'have') bal[entry.currency] = entry.amount;
      else if (before !== null) bal[entry.currency] = before + (change ?? 0);
    }
    const line: LogLine = { entry, state, balance: entry.currency in bal ? (bal[entry.currency] ?? null) : null, change };
    if (state === 'counted' && entry.kind === 'have' && change) line.fromCheck = change > 0 ? 'earned' : 'spent';
    return line;
  });
}

export interface LogGroup {
  /** Stable key: the entries saved together share their time, kind, note and undo. */
  key: string;
  at: string;
  kind: LedgerEntry['kind'];
  note?: string;
  /** 'partly': some currencies in it were undone one by one (older entries). */
  state: RowState | 'partly';
  lines: LogLine[];
}

/**
 * One group per Add entry (or per Undo): the currencies saved together share
 * the same time, kind and note, so older entries group the same way without
 * being rewritten. Lines follow the game's currency order; groups stay in time order.
 */
export function groupLines(lines: LogLine[], currencies: Currency[]): LogGroup[] {
  const order = (id: string) => {
    const i = currencies.findIndex((c) => c.id === id);
    return i < 0 ? currencies.length : i;
  };
  const groups = new Map<string, LogGroup>();
  for (const line of lines) {
    const e = line.entry;
    const key = `${e.at}|${e.kind}|${e.note ?? ''}|${e.reverses ? 'undo' : ''}`;
    const g = groups.get(key) ?? { key, at: e.at, kind: e.kind, ...(e.note ? { note: e.note } : {}), state: line.state, lines: [] };
    g.lines.push(line);
    groups.set(key, g);
  }
  for (const g of groups.values()) {
    g.lines.sort((a, b) => order(a.entry.currency) - order(b.entry.currency));
    const states = new Set(g.lines.map((l) => l.state));
    g.state = states.size === 1 ? ([...states][0] ?? 'counted') : states.has('counted') ? 'partly' : 'undone';
  }
  return [...groups.values()];
}

/** Pulls a currency amount is worth, by the game's own rules (its contract); null when it doesn't make pulls by itself. */
export function pullsWorth(currency: Currency | undefined, amount: number): number | null {
  if (!currency) return null;
  if (currency.perPull && !currency.paid) return amount / currency.perPull;
  if (currency.pullItemFor?.length) return amount;
  return null;
}

export interface FlowTotal {
  /** Currency id → amount (always positive). */
  amounts: Record<string, number>;
  /** Pulls those amounts are worth (currencies that make pulls only). */
  pulls: number;
  /** Groups you logged with this kind. */
  logged: number;
  /** Balance checks whose difference counts here. */
  fromChecks: number;
}

/** Earned, Bought and Spent totals: logged entries plus the differences balance checks found. Undone entries never count. */
export function flowTotals(groups: LogGroup[], currencies: Currency[]): Record<Flow, FlowTotal> {
  const empty = (): FlowTotal => ({ amounts: {}, pulls: 0, logged: 0, fromChecks: 0 });
  const out: Record<Flow, FlowTotal> = { earned: empty(), bought: empty(), spent: empty() };
  for (const g of groups) {
    const seen = new Set<Flow>();
    for (const l of g.lines) {
      if (l.state !== 'counted') continue;
      const flow: Flow | undefined = l.entry.kind === 'have' ? l.fromCheck : l.entry.kind;
      if (!flow || l.change === null) continue;
      const t = out[flow];
      const amount = Math.abs(l.change);
      t.amounts[l.entry.currency] = (t.amounts[l.entry.currency] ?? 0) + amount;
      t.pulls += pullsWorth(currencies.find((c) => c.id === l.entry.currency), amount) ?? 0;
      if (!seen.has(flow)) {
        seen.add(flow);
        if (l.entry.kind === 'have') t.fromChecks += 1;
        else t.logged += 1;
      }
    }
  }
  return out;
}

/**
 * The pulls a group's changes add up to (minus = fewer): its counted lines, or
 * all of them for an undone group (shown struck through). Null when none of its
 * currencies make pulls.
 */
export function groupPulls(g: LogGroup, currencies: Currency[]): number | null {
  let sum: number | null = null;
  for (const l of g.lines) {
    if (l.change === null || (g.state !== 'undone' && l.state !== 'counted')) continue;
    const worth = pullsWorth(currencies.find((c) => c.id === l.entry.currency), l.change);
    if (worth !== null) sum = (sum ?? 0) + worth;
  }
  return sum;
}
