/**
 * Proposals (ROADMAP R49): the Assistant's tool calls, checked, shown as cards,
 * applied only when you tap Approve, and undone on request. Pure logic on top
 * of the userData setters: no React.
 *
 * Undo never deletes: a bank log change is undone by adding a correcting entry
 * that cancels it; other changes put back the value from before; plans are
 * marked undone. Every applied change is recorded in userData.assistantActions.
 */
import {
  addLedgerEntry,
  addPlan,
  gameData,
  markAssistantActionUndone,
  recordAssistantAction,
  reverseLedgerEntry,
  setBacklogDone,
  setEventProgress,
  setPlanStatus,
  setRosterEntry,
  setTick,
  type AssistantAction,
  type EventProgress,
  type RosterEntry,
  type UserPlan,
} from '../../core/data/userData';
import type { Lookup } from './context';

export type ProposalKind = 'bank' | 'event' | 'backlog' | 'roster' | 'today' | 'plan' | 'route';

export interface Proposal {
  /** The tool call id. */
  id: string;
  tool: string;
  kind: ProposalKind;
  game: string;
  /** What will change, in plain words. */
  title: string;
  /** Before → after, when there is a before. */
  detail: string;
  why: string;
  input: Record<string, unknown>;
  /** Route stops, for route cards. */
  stops?: { title: string; minutes: number | null; items: string[] }[];
  /** Why it can't be applied (unknown id, wrong game…); null = fine. */
  problem: string | null;
}

export const KIND_LABEL: Record<ProposalKind, string> = {
  bank: 'BANK LOG',
  event: 'EVENT',
  backlog: 'BACKLOG',
  roster: 'ROSTER',
  today: 'TODAY',
  plan: 'PLAN',
  route: 'ROUTE',
};

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const int = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null);
const when = (s: string) => {
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;
};

/** Read one tool call into a card. Anything it can't check gets a `problem` and no Approve button. */
export function readProposal(call: { id: string; name: string; input: unknown }, lookup: Lookup): Proposal {
  const input = (call.input && typeof call.input === 'object' ? call.input : {}) as Record<string, unknown>;
  const gameId = str(input.game);
  const l = lookup.get(gameId);
  const why = str(input.why);
  const base = { id: call.id, tool: call.name, game: gameId, why, input, detail: '', problem: null as string | null };
  const fail = (kind: ProposalKind, title: string, problem: string): Proposal => ({ ...base, kind, title, problem });
  if (!l) return fail('plan', 'A change for a game that isn’t switched on', `There is no game "${gameId}" in view.`);
  const { game, user } = l;

  switch (call.name) {
    case 'log_bank_balance': {
      const currency = game.currencies.find((c) => c.id === str(input.currency));
      const amount = int(input.amount);
      const kind = str(input.kind) as 'have' | 'earned' | 'bought' | 'spent';
      if (!currency) return fail('bank', 'Bank log entry', `Unknown currency "${str(input.currency)}".`);
      if (amount === null || !['have', 'earned', 'bought', 'spent'].includes(kind)) return fail('bank', 'Bank log entry', 'The amount or kind is not valid.');
      const verb = { have: 'You have', earned: 'You earned', bought: 'You bought', spent: 'You spent' }[kind];
      return { ...base, kind: 'bank', title: `${verb} ${amount.toLocaleString()} ${currency.name}`, detail: str(input.note) };
    }
    case 'set_event_state': {
      const e = l.events.get(str(input.event_id));
      const state = str(input.state);
      if (!e) return fail('event', 'Event progress', `Unknown event "${str(input.event_id)}".`);
      if (!['open', 'done', 'skipped'].includes(state)) return fail('event', e.title, 'The state is not valid.');
      const days = int(input.login_days_claimed);
      const now = user.events[e.id];
      const label = (p: { state: string; daysClaimed?: number | undefined } | undefined) => `${p?.state ?? 'open'}${e.loginDays ? ` · ${p?.daysClaimed ?? 0}/${e.loginDays} days` : ''}`;
      return {
        ...base,
        kind: 'event',
        title: `Mark “${e.title}” ${state}${days !== null && e.loginDays ? `, ${days} days claimed` : ''}`,
        detail: `Now: ${label(now)} → ${label({ state, daysClaimed: days ?? now?.daysClaimed })}`,
      };
    }
    case 'set_backlog_done': {
      const b = l.backlog.get(str(input.item_id));
      const done = int(input.done);
      if (!b) return fail('backlog', 'Backlog progress', `Unknown backlog item "${str(input.item_id)}".`);
      if (done === null || done > b.total) return fail('backlog', b.title, `The count must be between 0 and ${b.total}.`);
      return { ...base, kind: 'backlog', title: `“${b.title}”: ${done}/${b.total} done`, detail: `Now: ${user.backlog[b.id] ?? 0}/${b.total}` };
    }
    case 'set_roster': {
      const c = l.characters.get(str(input.character_id));
      if (!c) return fail('roster', 'Roster', `Unknown character "${str(input.character_id)}".`);
      const owned = input.owned === true;
      const wanted = input.wanted === true;
      const dupes = int(input.dupes);
      const cur = user.roster[c.id];
      const show = (o: boolean, w: boolean, d: number | undefined) => [o ? 'owned' : 'not owned', w ? 'wanted' : null, game.dupes && o ? `${game.dupes.prefix}${d ?? 0}` : null].filter(Boolean).join(' · ');
      return {
        ...base,
        kind: 'roster',
        title: `${c.name}: ${show(owned, wanted, dupes ?? cur?.dupes)}`,
        detail: `Now: ${cur ? show(cur.owned, cur.wanted, cur.dupes) : 'not marked'}`,
      };
    }
    case 'tick_today_task': {
      const t = l.tasks.get(str(input.task_id));
      if (!l.serverId) return fail('today', 'Today’s task', `Choose your ${game.short} server first.`);
      if (!t) return fail('today', 'Today’s task', `Unknown task "${str(input.task_id)}".`);
      const done = input.done === true;
      return { ...base, kind: 'today', title: `${done ? 'Tick' : 'Untick'} “${t.label}”`, detail: `Now: ${t.done ? 'done' : 'open'}` };
    }
    case 'propose_plan': {
      const title = str(input.title).trim();
      const start = when(str(input.start));
      if (!title || !start) return fail('plan', title || 'Plan', 'The plan needs a title and a valid date.');
      const end = input.end ? when(str(input.end)) : null;
      return { ...base, kind: 'plan', title, detail: `${start}${end ? ` → ${end}` : ''}${str(input.note) ? ` · ${str(input.note)}` : ''}` };
    }
    case 'propose_route': {
      const title = str(input.title).trim();
      const date = when(str(input.date));
      const stops = Array.isArray(input.stops)
        ? input.stops.map((s) => {
            const o = (s ?? {}) as Record<string, unknown>;
            return { title: str(o.title), minutes: int(o.minutes), items: Array.isArray(o.items) ? o.items.map(str).filter(Boolean) : [] };
          })
        : [];
      if (!title || !date || stops.length === 0) return fail('route', title || 'Route', 'The route needs a title, a date and at least one stop.');
      const minutes = stops.reduce((n, s) => n + (s.minutes ?? 0), 0);
      const steps = stops.reduce((n, s) => n + s.items.length, 0);
      return { ...base, kind: 'route', title, detail: `${date} · ${stops.length} stops · ${steps} steps${minutes ? ` · about ${minutes} min` : ''}`, stops };
    }
    default:
      return fail('plan', call.name, 'The app doesn’t know this kind of change.');
  }
}

export type ApplyResult = { ok: true } | { ok: false; error: string };

/** Apply an approved proposal and record it for Undo. */
export function applyProposal(p: Proposal, now: Date = new Date()): ApplyResult {
  if (p.problem) return { ok: false, error: p.problem };
  const at = now.toISOString();
  const g = gameData(p.game);
  const i = p.input;
  let before: unknown = null;
  let after: unknown;
  switch (p.tool) {
    case 'log_bank_balance': {
      const id = addLedgerEntry(p.game, {
        at,
        currency: str(i.currency),
        kind: str(i.kind) as 'have' | 'earned' | 'bought' | 'spent',
        amount: int(i.amount) ?? 0,
        note: str(i.note) || 'From the Assistant',
      });
      after = { ledgerId: id };
      break;
    }
    case 'set_event_state': {
      const eventId = str(i.event_id);
      const prev = g.events[eventId];
      const days = int(i.login_days_claimed);
      const daysClaimed = days ?? prev?.daysClaimed;
      const next: EventProgress = { state: str(i.state) as EventProgress['state'], ...(daysClaimed !== undefined ? { daysClaimed } : {}) };
      setEventProgress(p.game, eventId, next);
      before = prev ?? null;
      after = next;
      break;
    }
    case 'set_backlog_done': {
      const itemId = str(i.item_id);
      before = g.backlog[itemId] ?? null;
      after = int(i.done) ?? 0;
      setBacklogDone(p.game, itemId, after as number);
      break;
    }
    case 'set_roster': {
      const cid = str(i.character_id);
      const prev = g.roster[cid];
      const next: RosterEntry = { owned: i.owned === true, wanted: i.wanted === true, dupes: int(i.dupes) ?? prev?.dupes ?? 0 };
      setRosterEntry(p.game, cid, next);
      before = prev ?? null;
      after = next;
      break;
    }
    case 'tick_today_task': {
      const tid = str(i.task_id);
      before = g.ticks[tid] ?? null;
      after = i.done === true ? at : null;
      setTick(p.game, tid, after as string | null);
      break;
    }
    case 'propose_plan':
    case 'propose_route': {
      const plan: UserPlan = {
        id: `assistant-${p.id}`,
        title: str(i.title).trim(),
        start: new Date(Date.parse(str(p.tool === 'propose_route' ? i.date : i.start))).toISOString(),
        ...(p.tool === 'propose_plan' && i.end && Number.isFinite(Date.parse(str(i.end))) ? { end: new Date(Date.parse(str(i.end))).toISOString() } : {}),
        ...(str(i.note) ? { note: str(i.note) } : {}),
        ...(p.stops ? { steps: p.stops.map((s) => ({ title: s.title, ...(s.minutes !== null ? { minutes: s.minutes } : {}), items: s.items })) } : {}),
        source: 'assistant',
        status: 'active',
        at,
      };
      addPlan(p.game, plan);
      after = { planId: plan.id };
      break;
    }
    default:
      return { ok: false, error: 'The app doesn’t know this kind of change.' };
  }
  const action: AssistantAction = { id: p.id, at, tool: p.tool, summary: p.title, input: p.input, before: { before, after }, status: 'applied' };
  recordAssistantAction(p.game, action);
  return { ok: true };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Undo an applied change. Refuses if you changed the same thing again since
 * (Undo would overwrite your newer change).
 */
export function undoProposal(game: string, actionId: string, now: Date = new Date()): ApplyResult {
  const g = gameData(game);
  const action = g.assistantActions.find((a) => a.id === actionId);
  if (!action) return { ok: false, error: 'There is no record of this change.' };
  if (action.status === 'undone') return { ok: false, error: 'Already undone.' };
  const at = now.toISOString();
  const i = action.input as Record<string, unknown>;
  const { before, after } = action.before as { before: unknown; after: unknown };
  const changedSince = 'This was changed again since, so Undo would overwrite your newer change. Change it by hand instead.';
  switch (action.tool) {
    case 'log_bank_balance': {
      const r = reverseLedgerEntry(game, (after as { ledgerId: string }).ledgerId, at, 'Undo of an Assistant change');
      if (!r) return { ok: false, error: 'This bank log entry was already cancelled.' };
      break;
    }
    case 'set_event_state': {
      const id = str(i.event_id);
      if (!same(g.events[id], after)) return { ok: false, error: changedSince };
      setEventProgress(game, id, (before as EventProgress | null) ?? { state: 'open' });
      break;
    }
    case 'set_backlog_done': {
      const id = str(i.item_id);
      if (!same(g.backlog[id], after)) return { ok: false, error: changedSince };
      setBacklogDone(game, id, (before as number | null) ?? 0);
      break;
    }
    case 'set_roster': {
      const id = str(i.character_id);
      if (!same(g.roster[id], after)) return { ok: false, error: changedSince };
      setRosterEntry(game, id, (before as RosterEntry | null) ?? { owned: false, wanted: false, dupes: 0 });
      break;
    }
    case 'tick_today_task': {
      const id = str(i.task_id);
      if (!same(g.ticks[id], after)) return { ok: false, error: changedSince };
      setTick(game, id, before as string | null);
      break;
    }
    case 'propose_plan':
    case 'propose_route':
      setPlanStatus(game, (after as { planId: string }).planId, 'undone');
      break;
    default:
      return { ok: false, error: 'The app doesn’t know how to undo this.' };
  }
  markAssistantActionUndone(game, actionId, at);
  return { ok: true };
}
