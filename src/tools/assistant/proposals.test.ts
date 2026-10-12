import { beforeEach, describe, expect, it } from 'vitest';
import type { GameContract } from '../../core/contract';
import { balances, gameData, resetUserData, setBacklogDone } from '../../core/data/userData';
import type { Lookup } from './context';
import { applyProposal, readProposal, undoProposal } from './proposals';

const game = {
  id: 'aa',
  short: 'AA',
  name: 'Game A',
  currencies: [{ id: 'gem', name: 'Gem', perPull: 160 }],
  dupes: { prefix: 'E', name: 'Eidolon', max: 6 },
  servers: [{ id: 'eu', label: 'Europe', utcOffset: 1 }],
} as unknown as GameContract;

const lookup = (): Lookup =>
  new Map([
    [
      'aa',
      {
        game,
        serverId: 'eu',
        user: gameData('aa'),
        characters: new Map([['c1', { id: 'c1', name: 'Star', rarity: 'top', element: 'e', role: 'r' }]]),
        events: new Map([['ev1', { id: 'ev1', title: 'Big Event', kind: 'event', start: '2026-10-01T00:00:00Z', end: '2026-10-20T00:00:00Z', reward: 800, currency: 'gem' }]]),
        backlog: new Map([['bl1', { id: 'bl1', title: 'Side quests', category: 'side-quests', total: 10, reward: 300, currency: 'gem' }]]),
        banners: [],
        tasks: new Map([['income:daily', { label: 'Daily Training', done: false }]]),
      },
    ],
  ]);

const call = (name: string, input: Record<string, unknown>, id = `t-${name}`) => readProposal({ id, name, input: { game: 'aa', why: 'because', ...input } }, lookup());

describe('Assistant proposals: approve and undo through your data', () => {
  beforeEach(() => resetUserData());

  it('reading a proposal changes nothing (nothing is applied without approval)', () => {
    const before = JSON.stringify(gameData('aa'));
    call('log_bank_balance', { currency: 'gem', kind: 'have', amount: 500, note: '' });
    call('set_backlog_done', { item_id: 'bl1', done: 4 });
    expect(JSON.stringify(gameData('aa'))).toBe(before);
  });

  it('flags unknown ids instead of guessing', () => {
    expect(call('set_event_state', { event_id: 'nope', state: 'done', login_days_claimed: null }).problem).toMatch(/Unknown event/);
    expect(call('set_backlog_done', { item_id: 'bl1', done: 11 }).problem).toMatch(/between 0 and 10/);
    expect(call('log_bank_balance', { currency: 'gold', kind: 'have', amount: 1, note: '' }).problem).toMatch(/Unknown currency/);
    // Strict tool schemas can't carry `minimum`, so negative numbers are refused here, as an error card.
    expect(call('log_bank_balance', { currency: 'gem', kind: 'have', amount: -5, note: '' }).problem).toMatch(/amount/);
    expect(call('set_backlog_done', { item_id: 'bl1', done: -1 }).problem).toMatch(/between 0 and 10/);
    expect(call('set_event_state', { event_id: 'ev1', state: 'done', login_days_claimed: -2 }).problem).toMatch(/0 or more/);
    expect(call('set_event_state', { event_id: 'ev1', state: 'done', login_days_claimed: null }).problem).toBeNull();
    expect(call('set_roster', { character_id: 'c1', owned: true, wanted: false, dupes: -1 }).problem).toMatch(/0 or more/);
    expect(call('propose_route', { title: 'R', date: '2026-10-09T19:00:00Z', stops: [{ title: 'A', minutes: -10, items: [] }] }).problem).toMatch(/0 or more/);
    expect(readProposal({ id: 'x', name: 'set_backlog_done', input: { game: 'zz', item_id: 'bl1', done: 1 } }, lookup()).problem).toMatch(/no game/);
    const bad = call('set_backlog_done', { item_id: 'nope', done: 1 });
    expect(applyProposal(bad)).toEqual({ ok: false, error: bad.problem });
  });

  it('bank log: undo adds a correcting entry and never deletes one', () => {
    const p = call('log_bank_balance', { currency: 'gem', kind: 'have', amount: 500, note: '' });
    expect(p.title).toBe('You have 500 Gem');
    expect(applyProposal(p).ok).toBe(true);
    expect(gameData('aa').ledger).toHaveLength(1);
    const b1 = balances(gameData('aa').ledger);
    expect(b1.known && b1.value.gem).toBe(500);

    expect(undoProposal('aa', p.id).ok).toBe(true);
    const ledger = gameData('aa').ledger;
    expect(ledger).toHaveLength(2); // the original is still there
    expect(ledger[1]?.reverses).toBe(ledger[0]?.id);
    expect(balances(ledger).known).toBe(false); // back to "no data yet", as before
    expect(gameData('aa').assistantActions[0]?.status).toBe('undone');
    expect(undoProposal('aa', p.id).ok).toBe(false); // only once
  });

  it('an undo only cancels its own entry; earlier balances stand', () => {
    applyProposal(call('log_bank_balance', { currency: 'gem', kind: 'have', amount: 100, note: '' }, 'a'));
    const p = call('log_bank_balance', { currency: 'gem', kind: 'earned', amount: 60, note: '' }, 'b');
    applyProposal(p);
    const mid = balances(gameData('aa').ledger);
    expect(mid.known && mid.value.gem).toBe(160);
    undoProposal('aa', 'b');
    const after = balances(gameData('aa').ledger);
    expect(after.known && after.value.gem).toBe(100);
    expect(gameData('aa').ledger).toHaveLength(3);
  });

  it('event, backlog, roster and Today: undo puts the value back', () => {
    const ev = call('set_event_state', { event_id: 'ev1', state: 'done', login_days_claimed: null });
    const bl = call('set_backlog_done', { item_id: 'bl1', done: 4 });
    const ro = call('set_roster', { character_id: 'c1', owned: true, wanted: false, dupes: 2 });
    const tk = call('tick_today_task', { task_id: 'income:daily', done: true });
    expect(ro.title).toBe('Star: owned · E2');
    for (const p of [ev, bl, ro, tk]) expect(applyProposal(p).ok).toBe(true);
    expect(gameData('aa').events.ev1?.state).toBe('done');
    expect(gameData('aa').backlog.bl1).toBe(4);
    expect(gameData('aa').roster.c1).toEqual({ owned: true, wanted: false, dupes: 2 });
    expect(gameData('aa').ticks['income:daily']).toBeDefined();
    for (const p of [ev, bl, ro, tk]) expect(undoProposal('aa', p.id).ok).toBe(true);
    expect(gameData('aa').events.ev1?.state).toBe('open');
    expect(gameData('aa').backlog.bl1).toBe(0);
    expect(gameData('aa').roster.c1?.owned).toBe(false);
    expect(gameData('aa').ticks['income:daily']).toBeUndefined();
    expect(gameData('aa').assistantActions.every((a) => a.status === 'undone')).toBe(true);
  });

  it('refuses to undo over a change you made since', () => {
    const bl = call('set_backlog_done', { item_id: 'bl1', done: 4 });
    applyProposal(bl);
    setBacklogDone('aa', 'bl1', 7);
    expect(undoProposal('aa', bl.id)).toMatchObject({ ok: false });
    expect(gameData('aa').backlog.bl1).toBe(7);
  });

  it('plans and routes become plans; undo marks them undone (kept)', () => {
    const plan = call('propose_plan', { title: 'Farm ornaments', start: '2026-10-12T10:00:00Z', end: null, note: '' });
    const route = call('propose_route', { title: 'Mission route', date: '2026-10-09T19:00:00Z', stops: [{ title: 'Area 1', minutes: 15, items: ['a', 'b'] }] });
    expect(route.detail).toMatch(/1 stops · 2 steps · about 15 min/);
    applyProposal(plan);
    applyProposal(route);
    expect(gameData('aa').plans).toHaveLength(2);
    expect(gameData('aa').plans[1]?.steps?.[0]?.items).toEqual(['a', 'b']);
    undoProposal('aa', plan.id);
    expect(gameData('aa').plans).toHaveLength(2);
    expect(gameData('aa').plans[0]?.status).toBe('undone');
  });
});
