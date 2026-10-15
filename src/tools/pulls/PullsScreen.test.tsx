import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character, GameContract, PityState } from '../../core/contract';
import { reloadPrefs, updatePrefs } from '../../core/data/prefs';
import { addLedgerEntry, balances, gameData, importPulls, resetUserData, setEventProgress } from '../../core/data/userData';
import { readForm } from './BankLog';
import { withBalances } from './bankLog';
import { topsWithPity } from './History';
import { pityFor } from './Planner';
import PullsScreen from './PullsScreen';

const chars: Character[] = [
  {
    id: 'c1',
    name: 'Newest Star',
    rarity: 'top',
    element: 'e',
    role: 'r',
    releasedAt: '2026-09-01',
  },
  {
    id: 'c2',
    name: 'Older Star',
    rarity: 'top',
    element: 'e',
    role: 'r',
    releasedAt: '2025-01-01',
  },
  { id: 'c3', name: 'Helper', rarity: 'mid', element: 'e', role: 'r' },
];

const game: GameContract = {
  id: 'aa',
  short: 'AA',
  name: 'Game A',
  vent: '#A99BFF',
  terms: {
    rarity: { top: '5★', mid: '4★' },
    gear: 'G',
    weapon: 'Cone',
    skill: 'S',
    character: 'C',
    endgame: [],
  },
  elements: [{ id: 'e', label: 'E', color: '#ffffff' }],
  roles: [{ id: 'r', label: 'R' }],
  currencies: [
    { id: 'gem', name: 'Gem', perPull: 160 },
    { id: 'ticket', name: 'Ticket', pullItemFor: ['character'] },
  ],
  teamSize: 4,
  stamina: [],
  servers: [{ id: 'eu', label: 'Europe', utcOffset: 1 }],
  reset: { hour: 4, weekday: 1 },
  modules: ['pulls'],
  bannerTypes: [
    {
      id: 'character',
      label: 'Character banner',
      pullItem: 'ticket',
      target: 'character',
      pity: {
        kind: 'hard-pity',
        hardPity: 90,
        baseRate: 0.006,
        featured: { winRate: 0.5, guaranteeAfterLoss: true },
      },
    },
  ],
  income: [],
  historyImporters: [{ id: 'uigf-v4', kind: 'file', label: 'UIGF v4 export file' }],
  historyMapping: {
    uigfKey: 'hkrpg',
    gachaTypes: { '11': 'character' },
    rarity: { '5': 'top', '4': 'mid', '3': 'low' },
  },
  data: {
    characters: async () => chars,
    banners: async () => [],
    events: async () => [],
    versions: async () => [],
    backlog: async () => [],
  },
  rules: [],
  sources: [],
} as unknown as GameContract;

const show = async (tab: string) => {
  render(<PullsScreen games={[game]} scope="aa" tab={tab} servers={{ aa: 'eu' }} openTab={() => {}} open={() => {}} openAccount={() => {}} />);
  await screen.findByText(/Example data, not yours/);
};

describe('Pulls screen', () => {
  beforeEach(() => {
    localStorage.clear();
    reloadPrefs();
    resetUserData();
  });

  it('Planner shows example banners, built from the game’s newest character, clearly marked', async () => {
    await show('planner');
    expect(screen.getByText('Newest Star')).toBeInTheDocument();
    expect(screen.getAllByText('EXAMPLE').length).toBeGreaterThan(1);
    expect(screen.getAllByText(/Chance by then · official rates/).length).toBeGreaterThan(0);
  });

  it('Planner lays banners out like Banners: Now, Next and Later columns, each card led by who the banner is for (T70)', async () => {
    await show('planner');
    const cols = ['Now', 'Next', 'Later'].map((name) => screen.getByRole('group', { name }));
    expect(cols).toHaveLength(3);
    // The featured character's name sits on the banner picture, not only the banner title.
    expect(within(cols[0] as HTMLElement).getAllByText('Newest Star').length).toBeGreaterThan(0);
    // The same column notes as Banners.
    expect(within(cols[0] as HTMLElement).getByText(/^Live · .* until the first one ends$/)).toBeInTheDocument();
    expect(within(cols[2] as HTMLElement).getAllByText(/ · opens in |^Nothing further listed$/).length).toBeGreaterThan(0);
    // On a phone the columns become tabs.
    expect(screen.getByRole('tablist', { name: /phases/ })).toBeInTheDocument();
  });

  it('History shows the example pity and a Luck report card', async () => {
    await show('history');
    expect(screen.getByLabelText('Luck report')).toBeInTheDocument();
    expect(screen.getByText('18/90')).toBeInTheDocument();
    expect(screen.getByText('lost 50/50')).toBeInTheDocument();
  });

  it('Bank log: your first entry replaces the example balance and is stored', async () => {
    await show('log');
    fireEvent.change(screen.getByPlaceholderText('e.g. 8400'), {
      target: { value: '1,234' },
    });
    await act(async () => {
      fireEvent.submit(screen.getByPlaceholderText('e.g. 8400').closest('form') as HTMLFormElement);
    });
    expect(gameData('aa').ledger).toHaveLength(1);
    expect(screen.getAllByText('1,234').length).toBeGreaterThan(0);
  });

  it('Calculator counts a real event until you mark it done', async () => {
    const start = new Date(Date.now() - 86_400_000).toISOString();
    const end = new Date(Date.now() + 5 * 86_400_000).toISOString();
    const withEvent = { ...game, data: { ...game.data, events: async () => [{ id: 'ev1', title: 'Real event', kind: 'event', start, end, reward: 800, currency: 'gem' }] } } as GameContract;
    const view = render(<PullsScreen games={[withEvent]} scope="aa" tab="calculator" servers={{ aa: 'eu' }} openTab={() => {}} open={() => {}} openAccount={() => {}} />);
    expect(await screen.findByText(/Real event · \+800/)).toBeInTheDocument();
    view.unmount();
    act(() => setEventProgress('aa', 'ev1', { state: 'done' }));
    render(<PullsScreen games={[withEvent]} scope="aa" tab="calculator" servers={{ aa: 'eu' }} openTab={() => {}} open={() => {}} openAccount={() => {}} />);
    expect(await screen.findByText('Real event · done')).toBeInTheDocument();
    expect(screen.queryByText(/Real event · \+800/)).not.toBeInTheDocument();
  });

  it('Bank log shows example entries with a running balance until you add your own', async () => {
    await show('log');
    const log = screen.getByRole('region', { name: 'Bank log entries' });
    expect(within(log).getAllByText('EXAMPLE').length).toBeGreaterThan(0);
    // The newest example row ends at the example balance.
    expect(within(log).getAllByText('8,400').length).toBeGreaterThan(0);
  });

  it('Bank log: a balance check then a spend shows the change and the new balance', async () => {
    act(() => {
      addLedgerEntry('aa', { at: '2026-01-01T10:00:00.000Z', currency: 'gem', kind: 'have', amount: 5000 });
      addLedgerEntry('aa', { at: '2026-01-02T10:00:00.000Z', currency: 'gem', kind: 'spent', amount: 1600, note: '10 pulls' });
    });
    render(<PullsScreen games={[game]} scope="aa" tab="log" servers={{ aa: 'eu' }} openTab={() => {}} open={() => {}} openAccount={() => {}} />);
    const log = await screen.findByRole('region', { name: 'Bank log entries' });
    expect(within(log).queryByText('EXAMPLE')).not.toBeInTheDocument();
    expect(within(log).getByText('10 pulls')).toBeInTheDocument();
    expect(within(log).getByText('3,400')).toBeInTheDocument();
  });

  it('History offers the link, the cache file and export files, each with its own guide', async () => {
    const withLink = { ...game, historyImporters: [...game.historyImporters, { id: 'aa-link', kind: 'link', label: 'In-game history link' }] } as GameContract;
    render(<PullsScreen games={[withLink]} scope="aa" tab="history" servers={{ aa: 'eu' }} openTab={() => {}} open={() => {}} openAccount={() => {}} />);
    await screen.findByText('No pull history yet');
    fireEvent.click(screen.getByRole('button', { name: /Upload a file/ }));
    expect(screen.getByText('How do I get an export file?')).toBeInTheDocument();
    expect(screen.getByLabelText(/Export file/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Pick the game’s cache file/ }));
    // Without an account the link can't be imported: it says so instead of failing.
    expect(screen.getByText(/Sign in \(Account\) to import from the game’s link/)).toBeInTheDocument();
  });

  it('Planner: a game’s own pity rule (no guarantee after a loss) gives its ceiling and worst case, and no “guaranteed” choice', async () => {
    const own = {
      ...game,
      bannerTypes: [
        {
          ...game.bannerTypes[0],
          pity: {
            kind: 'custom',
            describe: 'test: featured certain at the 120th pull on a banner',
            source: 'test',
            hardPity: 80,
            featured: { winRate: 0.5, guaranteeAfterLoss: false },
            pull: (s: PityState) => [
              { p: 0.004, next: { ...s, pulls: 0 }, copies: 1 },
              { p: 0.996, next: { ...s, pulls: s.pulls + 1 }, copies: 0 },
            ],
            worstCase: (s: PityState) => 120 - (s.extra?.banner ?? 0),
          },
        },
      ],
    } as GameContract;
    render(<PullsScreen games={[own]} scope="aa" tab="planner" servers={{ aa: 'eu' }} openTab={() => {}} open={() => {}} openAccount={() => {}} />);
    await screen.findByText(/Example data, not yours/);
    // A banner not open yet: nothing pulled on it, so the worst case is the full 120.
    expect(screen.getAllByText('120').length).toBeGreaterThan(0);
    fireEvent.change(screen.getByPlaceholderText('e.g. 40'), { target: { value: '200' } });
    expect(screen.getByPlaceholderText('e.g. 40')).toHaveValue(79); // capped below the game's own ceiling
    expect(screen.queryByText('Guaranteed (lost the last 50/50)')).not.toBeInTheDocument();
  });

  it('Calculator: a banner bought with its own currency gets a line, with what your pulls surely add to it', async () => {
    const side = {
      ...game,
      currencies: [...game.currencies, { id: 'coin', name: 'Coin', perPullOn: { side: 100 }, fromPulls: { on: ['character'], atLeastPerPull: 10, why: 'test: 10 a pull' } }],
      bannerTypes: [...game.bannerTypes, { id: 'side', label: 'Side banner', pullItem: 'coin', target: 'weapon', pity: { kind: 'hard-pity', hardPity: 40, baseRate: 0.04 }, currencies: ['coin'] }],
    } as GameContract;
    render(<PullsScreen games={[side]} scope="aa" tab="calculator" servers={{ aa: 'eu' }} openTab={() => {}} open={() => {}} openAccount={() => {}} />);
    // Example bank: 8,400 Gem (52 pulls) + 12 Tickets = 64 pulls; at least 640 Coin from them = 6 side pulls. Gem never buys side pulls.
    const line = await screen.findByLabelText('Side banner budget');
    expect(line).toHaveTextContent('at least 640 Coin from those 64 pulls (test: 10 a pull)');
    expect(within(line).getByText('6')).toBeInTheDocument();
  });

  it('Planner: typing your own pity shows it as a what-if, never saved', async () => {
    await show('planner');
    fireEvent.change(screen.getByPlaceholderText('e.g. 40'), { target: { value: '70' } });
    expect(screen.getAllByText('Your pity (what-if, not saved)').length).toBeGreaterThan(0);
    expect(gameData('aa').pulls).toHaveLength(0);
    expect(gameData('aa').pityManual?.character).toBeUndefined();
  });

  it('Planner: "Save as my pity" keeps it, the cards say so, and Clear removes it', async () => {
    await show('planner');
    fireEvent.change(screen.getByPlaceholderText('e.g. 40'), { target: { value: '70' } });
    fireEvent.change(screen.getByLabelText(/^Next 5★/), { target: { value: 'g' } });
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Save as my pity' })));
    expect(gameData('aa').pityManual?.character).toMatchObject({ pity: 70, guaranteed: true });
    // Saved pity wins over example pulls.
    expect(screen.getAllByText('Pity you saved').length).toBeGreaterThan(0);
    expect(screen.getAllByText('70/90 · guaranteed').length).toBeGreaterThan(0);
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Clear saved pity' })));
    expect(gameData('aa').pityManual?.character).toBeUndefined();
  });

  it('Planner: imported history wins over a saved pity', () => {
    const user = { ...gameData('aa'), pityManual: { character: { pity: 70, guaranteed: true, at: '2026-01-01T00:00:00.000Z' } } };
    const pulls = [
      { id: '1', bannerType: 'character', itemId: 'x', name: 'Top', rarity: 'top' as const, time: '2026-01-01T00:00:00.000Z', featured: true },
      { id: '2', bannerType: 'character', itemId: 'y', name: 'Low', rarity: 'low' as const, time: '2026-01-02T00:00:00.000Z' },
    ];
    expect(pityFor({ user, history: { list: pulls, example: false } }, 'character', undefined)).toEqual({ state: { pulls: 1, guaranteed: false }, source: 'history' });
    expect(pityFor({ user, history: { list: pulls, example: true } }, 'character', undefined)?.source).toBe('saved');
    expect(pityFor({ user: gameData('aa'), history: { list: [], example: false } }, 'character', undefined)).toBeNull();
  });

  it('Bank log: Undo keeps the entry, strikes it through and stops counting it', async () => {
    act(() => {
      addLedgerEntry('aa', { at: '2026-01-01T10:00:00.000Z', currency: 'gem', kind: 'have', amount: 5000 });
      addLedgerEntry('aa', { at: '2026-01-02T10:00:00.000Z', currency: 'gem', kind: 'earned', amount: 800, note: 'Endgame' });
    });
    render(<PullsScreen games={[game]} scope="aa" tab="log" servers={{ aa: 'eu' }} openTab={() => {}} open={() => {}} openAccount={() => {}} />);
    const log = await screen.findByRole('region', { name: 'Bank log entries' });
    expect(within(log).getByText('5,800')).toBeInTheDocument();
    act(() => fireEvent.click(within(log).getByRole('button', { name: /^Undo Endgame/ })));
    expect(gameData('aa').ledger).toHaveLength(2 + 1);
    expect(balances(gameData('aa').ledger)).toMatchObject({ known: true, value: { gem: 5000 } });
    expect(within(log).getByText('UNDONE')).toBeInTheDocument();
    expect(within(log).getByText('Undo: Endgame')).toBeInTheDocument();
    // Counted once, not twice: no balance of 6,600 anywhere, and the newest balance is back to 5,000.
    expect(within(log).queryByText('6,600')).not.toBeInTheDocument();
    expect(within(log).queryByText('5,800')).not.toBeInTheDocument();
    expect(within(log).queryByRole('button', { name: /^Undo Endgame/ })).not.toBeInTheDocument();
  });

  it('Bank log: a check saved with every currency is one entry; a rise counts as Earned; Undo cancels the whole entry', async () => {
    act(() => {
      for (const [at, gem, ticket] of [
        ['2026-01-01T10:00:00.000Z', 1654, 12],
        ['2026-01-05T10:00:00.000Z', 5281, 15],
      ] as const) {
        addLedgerEntry('aa', { at, currency: 'gem', kind: 'have', amount: gem });
        addLedgerEntry('aa', { at, currency: 'ticket', kind: 'have', amount: ticket });
      }
    });
    render(<PullsScreen games={[game]} scope="aa" tab="log" servers={{ aa: 'eu' }} openTab={() => {}} open={() => {}} openAccount={() => {}} />);
    const log = await screen.findByRole('region', { name: 'Bank log entries' });
    expect(within(log).getAllByRole('listitem')).toHaveLength(2); // not 4
    expect(within(log).getByText('+3,627')).toBeInTheDocument();
    expect(within(log).getByText('≈ +25.7 pulls')).toBeInTheDocument();
    expect(within(log).getByText('From balance check: Earned 3,627 Gem, 3 Ticket')).toBeInTheDocument();
    expect(within(log).getByText('First balance check: this sets your bank')).toBeInTheDocument();
    const earned = screen.getByText('Earned for free').parentElement as HTMLElement;
    expect(earned).toHaveTextContent('3,627');
    expect(earned).toHaveTextContent('1 balance check');
    const undo = within(log).getAllByRole('button', { name: /^Undo Balance check/ })[0] as HTMLElement;
    act(() => fireEvent.click(undo));
    expect(gameData('aa').ledger).toHaveLength(4 + 2); // both currencies cancelled, nothing removed
    expect(balances(gameData('aa').ledger)).toMatchObject({ value: { gem: 1654, ticket: 12 } });
    expect(within(log).getByText('UNDONE')).toBeInTheDocument();
    expect(screen.getByText('Earned for free').parentElement).toHaveTextContent('0');
  });

  it('Bank log running balance skips undone pairs, like balances()', () => {
    const entries = [
      { id: 'a', at: '2026-01-01T10:00:00.000Z', currency: 'gem', kind: 'have' as const, amount: 1000 },
      { id: 'b', at: '2026-01-02T10:00:00.000Z', currency: 'gem', kind: 'earned' as const, amount: 800 },
      { id: 'c', at: '2026-01-03T10:00:00.000Z', currency: 'gem', kind: 'earned' as const, amount: 800, reverses: 'b' },
      { id: 'd', at: '2026-01-04T10:00:00.000Z', currency: 'gem', kind: 'spent' as const, amount: 160 },
    ];
    expect(withBalances(entries).map((r) => [r.entry.id, r.state, r.balance])).toEqual([
      ['a', 'counted', 1000],
      ['b', 'undone', 1000],
      ['c', 'undo', 1000],
      ['d', 'counted', 840],
    ]);
    expect(balances(entries)).toMatchObject({ value: { gem: 840 } });
  });

  it('Bank log: typing something that isn’t a number says so and keeps what you typed', async () => {
    await show('log');
    const input = screen.getByPlaceholderText('e.g. 8400');
    fireEvent.change(input, { target: { value: 'abc' } });
    act(() => {
      fireEvent.submit(input.closest('form') as HTMLFormElement);
    });
    expect(screen.getByRole('alert')).toHaveTextContent('“abc” for Gem isn’t a whole number');
    expect(input).toHaveValue('abc');
    expect(gameData('aa').ledger).toHaveLength(0);
    fireEvent.change(input, { target: { value: '' } });
    act(() => {
      fireEvent.submit(input.closest('form') as HTMLFormElement);
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Type at least one amount');
  });

  it('Bank log refuses a date in the future', () => {
    const r = readForm(game.currencies, { gem: '100' }, '2999-01-01', '2026-10-10');
    expect(r).toEqual({ ok: false, problem: 'That date is in the future. Pick today or an earlier day.' });
    expect(readForm(game.currencies, { gem: '1 234' }, '2026-10-01', '2026-10-10')).toEqual({ ok: true, values: [['gem', 1234]] });
  });

  it('Bank log with examples hidden: no example rows, an empty state with the form', async () => {
    act(() => updatePrefs((p) => ({ ...p, hideExamples: true })));
    render(<PullsScreen games={[game]} scope="aa" tab="log" servers={{ aa: 'eu' }} openTab={() => {}} open={() => {}} openAccount={() => {}} />);
    expect(await screen.findByText('No entries yet')).toBeInTheDocument();
    expect(screen.queryByText('EXAMPLE')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. 8400')).toBeInTheDocument();
  });

  it('History: a file with two accounts asks which one, and the import can be undone', async () => {
    const row = (id: string, rank: string, time: string) => ({ id, gacha_type: '11', item_id: id, name: `Item ${id}`, rank_type: rank, time });
    const file = {
      info: { version: 'v4.0' },
      hkrpg: [
        { uid: '111', timezone: 8, list: [row('1', '3', '2026-01-01 10:00:00'), row('2', '5', '2026-01-01 10:01:00')] },
        { uid: '222', timezone: 8, list: [row('9', '3', '2026-01-01 10:00:00')] },
      ],
    };
    act(() => {
      importPulls('aa', [{ id: 'old', bannerType: 'character', itemId: 'o', name: 'Mine', rarity: 'low', time: '2025-01-01T00:00:00.000Z' }]);
    });
    render(<PullsScreen games={[game]} scope="aa" tab="history" servers={{ aa: 'eu' }} openTab={() => {}} open={() => {}} openAccount={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: /Upload a file/ }));
    const input = screen.getByLabelText(/^Export file/);
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File([JSON.stringify(file)], 'export.json', { type: 'application/json' })] } });
    });
    const pickCard = await screen.findByRole('region', { name: 'Which account to import' });
    expect(gameData('aa').pulls).toHaveLength(1);
    act(() => fireEvent.click(within(pickCard).getByRole('button', { name: 'UID 111 · 2 pulls' })));
    expect(gameData('aa').pulls.map((x) => x.id).sort()).toEqual(['1', '2', 'old']);
    expect(screen.getByRole('status')).toHaveTextContent('Added 2 new pulls');
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Undo this import' })));
    expect(gameData('aa').pulls.map((x) => x.id)).toEqual(['old']);
    expect(screen.getByRole('status')).toHaveTextContent('removed the 2 pulls it added');
  });

  it('History: after a lost 50/50 the next featured top result is “guaranteed”, not a won 50/50', () => {
    const p = (id: string, rarity: 'top' | 'low', featured?: boolean) => ({ id, bannerType: 'character', itemId: id, name: id, rarity, time: `2026-01-0${id}T00:00:00.000Z`, ...(featured === undefined ? {} : { featured }) });
    const out = topsWithPity([p('1', 'top', false), p('2', 'low'), p('3', 'top', true), p('4', 'top', true)]);
    expect(out.map((x) => x.result)).toEqual(['lost', 'guaranteed', 'won']);
    expect(out.map((x) => x.pity)).toEqual([1, 2, 1]);
  });

  it('History: “Show all” lists every top result, not just the newest 10', async () => {
    const pulls = Array.from({ length: 12 }, (_, i) => ({ id: `t${i}`, bannerType: 'character', itemId: 'x', name: `Top ${i}`, rarity: 'top' as const, time: new Date(Date.UTC(2026, 0, i + 1)).toISOString() }));
    act(() => {
      importPulls('aa', pulls);
    });
    render(<PullsScreen games={[game]} scope="aa" tab="history" servers={{ aa: 'eu' }} openTab={() => {}} open={() => {}} openAccount={() => {}} />);
    const card = await screen.findByRole('region', { name: 'Every 5★' });
    expect(within(card).getAllByRole('listitem')).toHaveLength(10);
    fireEvent.click(within(card).getByRole('button', { name: 'Show all 12' }));
    expect(within(card).getAllByRole('listitem')).toHaveLength(12);
  });

  it('Calculator without a version end still shows your bank and lets you pick the end date', async () => {
    act(() => updatePrefs((p) => ({ ...p, hideExamples: true })));
    const openTab = vi.fn();
    const paidGame = { ...game, income: [{ id: 'pass', label: 'Monthly pass', currency: 'gem', amount: 90, paid: true, schedule: { kind: 'pass' } }] } as unknown as GameContract;
    render(<PullsScreen games={[paidGame]} scope="aa" tab="calculator" servers={{ aa: 'eu' }} openTab={openTab} open={() => {}} openAccount={() => {}} />);
    expect(await screen.findByText('Budget to the date you choose')).toBeInTheDocument();
    expect(screen.getByText('Bank now')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Count paid extra: Monthly pass' })).toBeInTheDocument();
    // "No data yet · Add it" opens the Bank log.
    fireEvent.click(screen.getAllByRole('button', { name: 'Add it' })[0] as HTMLElement);
    expect(openTab).toHaveBeenCalledWith('log');
    fireEvent.click(screen.getByRole('button', { name: 'A date I pick' }));
    fireEvent.change(screen.getByLabelText('Count until'), { target: { value: '2999-01-01' } });
    expect(screen.getByText(/your choice, not the version end/)).toBeInTheDocument();
  });

  it('Planner: with no banners, “Add my own banner” opens Edit mode', async () => {
    act(() => updatePrefs((p) => ({ ...p, hideExamples: true })));
    render(<PullsScreen games={[game]} scope="aa" tab="planner" servers={{ aa: 'eu' }} openTab={() => {}} open={() => {}} openAccount={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add my own banner' }));
    expect(await screen.findByText(/Edit mode · Banners/)).toBeInTheDocument();
  });
});
