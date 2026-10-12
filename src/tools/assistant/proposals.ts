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
  revertOwnItem,
  saveOwnItem,
  setBacklogDone,
  setEventProgress,
  setOwnItemHidden,
  setPlanStatus,
  setRosterEntry,
  setTick,
  type AssistantAction,
  type EventProgress,
  type OwnItemEdit,
  type RosterEntry,
  type UserPlan,
} from '../../core/data/userData';
import type { Lookup } from './context';
import { formatDateTime } from '../../core/time/reset';
import type { BacklogItem } from '../../core/contract';
import { categoryLabel } from '../backlog/backlog';

const TITLE_MAX = 80;
const TOTAL_MAX = 100_000;
/** Your own item added from a proposal: the tool call id makes it unique ("own-" like Edit mode's). */
const ownIdFor = (callId: string) => `own-a-${callId.replace(/[^A-Za-z0-9_-]/g, '').slice(-24)}`;
const categoryId = (v: string) => v.trim().toLowerCase().replace(/\s+/g, '-');

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
  /** A new backlog item's currency (the game's premium one, like Edit mode). */
  currency?: string;
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
/** Given but not a whole number of 0 or more (the tool schemas can't enforce it: strict mode has no `minimum`). */
const badCount = (v: unknown) => v !== null && v !== undefined && int(v) === null;
const when = (s: string) => {
  const t = Date.parse(s);
  return Number.isFinite(t) ? formatDateTime(t) : null;
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
      if (badCount(input.login_days_claimed)) return fail('event', e.title, 'The login days must be 0 or more.');
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
    case 'add_backlog_item': {
      const title = str(input.title).trim();
      const category = categoryId(str(input.category));
      const total = int(input.total);
      if (!title || title.length > TITLE_MAX) return fail('backlog', title || 'New backlog item', `The name must be 1 to ${TITLE_MAX} characters.`);
      if (!/^[a-z0-9-]{1,40}$/.test(category)) return fail('backlog', title, 'The category must be a short id like "side-quests".');
      if (total === null || total < 1 || total > TOTAL_MAX) return fail('backlog', title, `How much there is to do must be a whole number from 1 to ${TOTAL_MAX.toLocaleString()}.`);
      if (badCount(input.reward)) return fail('backlog', title, 'The reward must be 0 or more (or unknown).');
      const reward = int(input.reward);
      const currency = game.currencies.find((c) => c.perPull && !c.paid)?.id ?? game.currencies[0]?.id ?? '';
      const twin = [...l.backlog.values()].some((b) => b.title.trim().toLowerCase() === title.toLowerCase());
      return {
        ...base,
        kind: 'backlog',
        currency,
        title: `Add “${title}” to Backlog`,
        detail: [categoryLabel(category), total === 1 ? 'a single tick box' : `0/${total.toLocaleString()}`, reward === null ? null : `${reward.toLocaleString()} reward`, str(input.note).trim() || null, twin ? 'You already have an item with this name' : null]
          .filter(Boolean)
          .join(' · '),
      };
    }
    case 'edit_backlog_item': {
      const b = l.backlog.get(str(input.item_id));
      if (!b) return fail('backlog', 'Change a backlog item', `Unknown backlog item "${str(input.item_id)}".`);
      const title = input.title === null || input.title === undefined ? null : str(input.title).trim();
      if (title !== null && (!title || title.length > TITLE_MAX)) return fail('backlog', b.title, `The name must be 1 to ${TITLE_MAX} characters.`);
      if (badCount(input.total)) return fail('backlog', b.title, 'The total must be 1 or more.');
      const total = int(input.total);
      if (total !== null && (total < 1 || total > TOTAL_MAX)) return fail('backlog', b.title, `The total must be from 1 to ${TOTAL_MAX.toLocaleString()}.`);
      if (total !== null && b.steps?.length) return fail('backlog', b.title, 'This item is a list of steps: change them in Edit mode.');
      if ((title === null || title === b.title) && (total === null || total === b.total)) return fail('backlog', b.title, 'Nothing would change.');
      const done = user.backlog[b.id];
      const clamp = total !== null && done !== undefined && done > total;
      return {
        ...base,
        kind: 'backlog',
        title: `Change “${b.title}”`,
        detail: [title !== null && title !== b.title ? `Name: “${b.title}” → “${title}”` : null, total !== null && total !== b.total ? `Total: ${b.total} → ${total}` : null, clamp ? `progress ${done} becomes ${total}` : null].filter(Boolean).join(' · '),
      };
    }
    case 'hide_backlog_item': {
      const b = l.backlog.get(str(input.item_id));
      if (!b) return fail('backlog', 'Hide a backlog item', `Unknown backlog item "${str(input.item_id)}".`);
      return { ...base, kind: 'backlog', title: `Hide “${b.title}” from Backlog`, detail: 'Nothing is deleted: show it again in Edit mode.' };
    }
    case 'set_roster': {
      const c = l.characters.get(str(input.character_id));
      if (!c) return fail('roster', 'Roster', `Unknown character "${str(input.character_id)}".`);
      if (badCount(input.dupes)) return fail('roster', c.name, `The ${game.dupes?.name ?? 'dupe'} count must be 0 or more.`);
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
      if (Array.isArray(input.stops) && input.stops.some((s) => badCount((s as Record<string, unknown> | null)?.minutes))) return fail('route', title, 'Minutes must be 0 or more.');
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
    case 'add_backlog_item': {
      const fields: Partial<BacklogItem> = {
        title: str(i.title).trim(),
        category: categoryId(str(i.category)),
        total: int(i.total) ?? 1,
        reward: int(i.reward),
        currency: p.currency ?? '',
        steps: [],
        group: '',
        unit: '',
        note: str(i.note).trim(),
      };
      const entry: OwnItemEdit<BacklogItem> = { id: ownIdFor(p.id), mine: true, fields, hidden: false, at };
      saveOwnItem(p.game, 'backlog', entry);
      after = entry;
      break;
    }
    case 'edit_backlog_item': {
      const itemId = str(i.item_id);
      const prev = g.ownItems.backlog[itemId];
      const change: Partial<BacklogItem> = { ...(i.title !== null && i.title !== undefined ? { title: str(i.title).trim() } : {}), ...(int(i.total) !== null ? { total: int(i.total) as number } : {}) };
      const entry: OwnItemEdit<BacklogItem> = prev ? { ...prev, fields: { ...prev.fields, ...change }, at } : { id: itemId, mine: false, fields: change, hidden: false, at };
      const doneBefore = g.backlog[itemId];
      saveOwnItem(p.game, 'backlog', entry);
      const total = change.total;
      if (total !== undefined && doneBefore !== undefined && doneBefore > total) setBacklogDone(p.game, itemId, total);
      before = { entry: prev ?? null, done: doneBefore ?? null };
      after = { entry, done: gameData(p.game).backlog[itemId] ?? null };
      break;
    }
    case 'hide_backlog_item': {
      const itemId = str(i.item_id);
      before = g.ownItems.backlog[itemId]?.hidden ?? false;
      setOwnItemHidden(p.game, 'backlog', itemId, true, at);
      after = true;
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
    case 'add_backlog_item': {
      const entry = after as OwnItemEdit<BacklogItem>;
      if (!same(g.ownItems.backlog[entry.id], entry)) return { ok: false, error: changedSince };
      // Undo hides it (nothing is ever deleted); Edit mode can show it again.
      setOwnItemHidden(game, 'backlog', entry.id, true, at);
      break;
    }
    case 'edit_backlog_item': {
      const id = str(i.item_id);
      const a = after as { entry: OwnItemEdit<BacklogItem>; done: number | null };
      const b = before as { entry: OwnItemEdit<BacklogItem> | null; done: number | null };
      if (!same(g.ownItems.backlog[id], a.entry) || !same(g.backlog[id] ?? null, a.done)) return { ok: false, error: changedSince };
      if (b.entry) saveOwnItem(game, 'backlog', { ...b.entry, at });
      else revertOwnItem(game, 'backlog', id, at);
      if (b.done !== null && b.done !== a.done) setBacklogDone(game, id, b.done);
      break;
    }
    case 'hide_backlog_item': {
      const id = str(i.item_id);
      if (g.ownItems.backlog[id]?.hidden !== true) return { ok: false, error: changedSince };
      setOwnItemHidden(game, 'backlog', id, before === true, at);
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
