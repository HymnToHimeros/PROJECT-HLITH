import { describe, expect, it } from 'vitest';
import type { GameContract, IncomeRow } from '../../core/contract';
import { known, unknown } from '../../core/contract/known';
import { budget, budgetPulls, cycleStarts, pullsFor, type BudgetInput } from './budget';

const DAY = 86_400_000;
// Friday 2026-10-09 12:00 UTC. Server "eu": UTC+1, reset 04:00 (03:00 UTC), weekly Monday.
const NOW = Date.parse('2026-10-09T12:00:00Z');
const at = (iso: string) => Date.parse(iso);

function game(income: IncomeRow[]): GameContract {
  return {
    id: 'g',
    short: 'G',
    name: 'Game',
    vent: '#A99BFF',
    terms: { rarity: { top: '5★', mid: '4★' }, gear: 'G', weapon: 'W', skill: 'S', character: 'C', endgame: [] },
    elements: [],
    roles: [],
    currencies: [
      { id: 'gem', name: 'Gem', perPull: 160 },
      { id: 'ticket', name: 'Ticket', pullItemFor: ['limited'] },
      { id: 'std', name: 'Standard ticket', pullItemFor: ['standard'] },
      { id: 'paid', name: 'Paid gem', paid: true },
    ],
    teamSize: 4,
    stamina: [],
    servers: [{ id: 'eu', label: 'Europe', utcOffset: 1 }],
    reset: { hour: 4, weekday: 1 },
    modules: ['pulls'],
    bannerTypes: [],
    income,
    historyImporters: [],
    data: {
      characters: async () => [],
      banners: async () => [],
      events: async () => [],
      backlog: async () => [],
      materials: async () => [],
      teams: async () => [],
      versions: async () => [],
    },
    rules: {},
    sources: [],
  };
}

const daily: IncomeRow = { id: 'daily', source: 'daily', label: 'Daily', currency: 'gem', amount: 60, schedule: { kind: 'per-reset' } };
const weekly: IncomeRow = { id: 'weekly', source: 'weekly', label: 'Weekly', currency: 'gem', amount: 225, schedule: { kind: 'weekly' } };
const base = (g: GameContract, over: Partial<BudgetInput> = {}): BudgetInput => ({
  game: g,
  serverId: 'eu',
  now: NOW,
  until: NOW + 7 * DAY,
  bank: known({ gem: 1000, ticket: 2 }, 'user', '2026-10-09T11:00:00Z'),
  paidExtras: false,
  ...over,
});
const row = (b: ReturnType<typeof budget>, id: string) => b.rows.find((r) => r.id === id);

describe('rule 1–2 · only the future counts, today only if not done', () => {
  it('counts today plus each reset in the window', () => {
    // Resets in (Fri 12:00, next Fri 12:00]: Sat..Fri = 7, plus today's unclaimed daily = 8.
    expect(row(budget(base(game([daily]))), 'daily')).toMatchObject({ occurrences: 8, amount: 480, status: 'counted' });
  });
  it('skips today once it is done', () => {
    const b = budget(base(game([daily]), { doneThisPeriod: new Set(['daily']) }));
    expect(row(b, 'daily')?.occurrences).toBe(7);
  });
  it('a window ending now counts only what is claimable now', () => {
    expect(row(budget(base(game([daily]), { until: NOW })), 'daily')?.occurrences).toBe(1);
    expect(row(budget(base(game([daily]), { until: NOW, doneThisPeriod: new Set(['daily']) })), 'daily')?.status).toBe('already-earned');
  });
  it('weekly counts this week if not done, plus each Monday reset', () => {
    // One Monday reset (Oct 12) in the next 7 days, plus this week's.
    expect(row(budget(base(game([weekly]))), 'weekly')?.occurrences).toBe(2);
    expect(row(budget(base(game([weekly]), { doneThisPeriod: new Set(['weekly']) })), 'weekly')?.occurrences).toBe(1);
  });
  it('without a server, reset-based rows are left out with the reason', () => {
    const b = budget(base(game([daily]), { serverId: undefined }));
    expect(row(b, 'daily')).toMatchObject({ status: 'no-data', reason: 'choose your server' });
    expect(b.leftOut).toEqual(['Daily']);
  });
});

describe('rule 3 · events', () => {
  const g = game([{ id: 'ev', source: 'events', label: 'Events', currency: 'gem', amount: null, schedule: { kind: 'from-events' } }]);
  const events: BudgetInput['events'] = [
    { id: 'a', title: 'Open event', reward: 400, currency: 'gem', end: NOW + 2 * DAY, state: 'open' },
    { id: 'b', title: 'Done event', reward: 300, currency: 'gem', end: NOW + 2 * DAY, state: 'done' },
    { id: 'c', title: 'Skipped event', reward: 300, currency: 'gem', end: NOW + 2 * DAY, state: 'skipped' },
    { id: 'd', title: 'Ended event', reward: 300, currency: 'gem', end: NOW - 1, state: 'open' },
    { id: 'e', title: 'Mystery event', reward: null, currency: 'gem', end: NOW + DAY, state: 'open' },
  ];
  it('counts open ones only, never twice, and lists unknown rewards', () => {
    const b = budget(base(g, { events }));
    expect(b.bySource.events).toBe(400);
    expect(row(b, 'event:b')?.status).toBe('already-earned');
    expect(row(b, 'event:c')?.status).toBe('skipped');
    expect(row(b, 'event:d')?.status).toBe('skipped');
    expect(b.leftOut).toEqual(['Mystery event']);
  });
});

describe('rule 4 · login events', () => {
  const login = { id: 'l', title: 'Login', perDay: 100, currency: 'gem', days: 7, daysClaimed: 3, claimedToday: false, end: NOW + 10 * DAY };
  it('counts days left to claim', () => {
    expect(row(budget(base(game([]), { logins: [login] })), 'login:l')).toMatchObject({ occurrences: 4, amount: 400 });
  });
  it('is limited by days left before the event or the window ends', () => {
    const b = budget(base(game([]), { logins: [{ ...login, end: at('2026-10-11T02:00:00Z') }] }));
    // Today + Sat 03:00 reset = 2 claims before Sun 02:00.
    expect(row(b, 'login:l')?.occurrences).toBe(2);
  });
  it('already claimed today removes today', () => {
    const b = budget(base(game([]), { logins: [{ ...login, claimedToday: true, end: at('2026-10-11T02:00:00Z') }] }));
    expect(row(b, 'login:l')?.occurrences).toBe(1);
  });
  it('fully claimed counts zero', () => {
    expect(row(budget(base(game([]), { logins: [{ ...login, daysClaimed: 7 }] })), 'login:l')?.status).toBe('already-earned');
  });
});

describe('rule 5 · endgame cycles', () => {
  const cycle: IncomeRow = { id: 'end', source: 'endgame', label: 'Endgame', currency: 'gem', amount: 800, schedule: { kind: 'cycle', days: 14 } };
  it('needs a known anchor, otherwise it is left out', () => {
    expect(row(budget(base(game([cycle]))), 'end')).toMatchObject({ status: 'no-data', reason: 'cycle dates not known yet' });
  });
  it('counts the current cycle if not done, plus starts in the window', () => {
    const anchor = NOW + 3 * DAY - 14 * DAY; // next start in 3 days
    const b = budget(base(game([cycle]), { cycleAnchors: { end: anchor } }));
    expect(row(b, 'end')?.occurrences).toBe(2);
    const done = budget(base(game([cycle]), { cycleAnchors: { end: anchor }, doneThisPeriod: new Set(['end']) }));
    expect(row(done, 'end')?.occurrences).toBe(1);
  });
  it('cycleStarts counts starts in (from, to]', () => {
    expect(cycleStarts(0, 1, 0, 3 * DAY)).toBe(3);
    expect(cycleStarts(0, 1, 0.5 * DAY, 0.9 * DAY)).toBe(0);
  });
});

describe('rule 6–7 · monthly pass and paid extras', () => {
  const pass: IncomeRow = { id: 'pass', source: 'monthly', label: 'Pass', currency: 'gem', amount: 90, schedule: { kind: 'pass', perDay: 90 }, paid: true };
  it('paid rows are off unless paid extras is on', () => {
    expect(row(budget(base(game([pass]), { passes: { pass: NOW + 30 * DAY } })), 'pass')?.status).toBe('off-paid');
  });
  it('counts per day while active, never past its end', () => {
    const b = budget(base(game([pass]), { paidExtras: true, passes: { pass: at('2026-10-11T12:00:00Z') } }));
    // Today + Sat + Sun resets before Sun 12:00 = 3 days.
    expect(row(b, 'pass')).toMatchObject({ occurrences: 3, amount: 270, status: 'counted' });
  });
  it('one paid row can be switched off while the others stay on', () => {
    const b = budget(base(game([pass]), { paidExtras: true, paidOff: ['pass'], passes: { pass: NOW + 30 * DAY } }));
    expect(row(b, 'pass')?.status).toBe('off-paid');
  });
  it('an expired or missing pass is not active', () => {
    expect(row(budget(base(game([pass]), { paidExtras: true })), 'pass')?.status).toBe('not-active');
    expect(row(budget(base(game([pass]), { paidExtras: true, passes: { pass: NOW - 1 } })), 'pass')?.status).toBe('not-active');
  });
});

describe('rule 8 · Backlog, never counted twice', () => {
  const story: IncomeRow = { id: 'story', source: 'one-time', label: 'Story quests', currency: 'gem', amount: 500, schedule: { kind: 'once' }, coveredByBacklog: 'story' };
  it('an enabled category counts and skips the income row it covers', () => {
    const b = budget(base(game([story]), { backlog: [{ category: 'story', label: 'Story', enabled: true, rewardLeft: 1200, currency: 'gem' }] }));
    expect(row(b, 'story')?.status).toBe('skipped-backlog');
    expect(b.bySource.backlog).toBe(1200);
    expect(b.income.gem).toBe(1200);
  });
  it('a disabled category does not count but shows as potential', () => {
    const b = budget(base(game([story]), { backlog: [{ category: 'story', label: 'Story', enabled: false, rewardLeft: 1200, currency: 'gem' }] }));
    expect(row(b, 'story')?.status).toBe('counted');
    expect(b.backlogPotential).toEqual({ gem: 1200 });
  });
});

describe('rule 9–10 · honest totals', () => {
  it('unknown amounts are left out and listed, never counted as zero or guessed', () => {
    const g = game([daily, { ...weekly, amount: null }]);
    const b = budget(base(g));
    expect(b.leftOut).toEqual(['Weekly']);
    expect(b.income.gem).toBe(480);
    expect(b.total).toMatchObject({ known: true, value: { gem: 1480, ticket: 2 } });
  });
  it('no bank means no total, but rows are still listed', () => {
    const b = budget(base(game([daily]), { bank: unknown('enter-manually') }));
    expect(b.total).toEqual({ known: false, fix: 'enter-manually' });
    expect(row(b, 'daily')?.status).toBe('counted');
  });
});

describe('rule 11 · pulls', () => {
  const g = game([]);
  it('premium currency rounds down; pull items only count on their banner', () => {
    expect(pullsFor(g, { gem: 1599, ticket: 3, std: 5, paid: 9999 }, 'limited')).toBe(9 + 3);
    expect(pullsFor(g, { gem: 1600, ticket: 3, std: 5 }, 'standard')).toBe(10 + 5);
  });
  it('a paid currency with a pull rule counts like the premium one (Oneiric Shard, Monochrome: 160 a pull)', () => {
    const shard = { ...g, currencies: g.currencies.map((c) => (c.id === 'paid' ? { ...c, perPull: 160 } : c)) };
    // 1,500 gem + 100 paid = 1,600 = 10 pulls: added up before rounding down.
    expect(pullsFor(shard, { gem: 1500, paid: 100, ticket: 3 }, 'limited')).toBe(10 + 3);
    expect(pullsFor(g, { gem: 1500, paid: 100 }, 'limited')).toBe(9); // no rule, not counted
  });
  it('budget pulls follow the total, and are unknown without a bank', () => {
    expect(budgetPulls(g, budget(base(g)), 'limited')).toMatchObject({ known: true, value: 6 + 2 });
    expect(budgetPulls(g, budget(base(g, { bank: unknown() })), 'limited').known).toBe(false);
  });
});
