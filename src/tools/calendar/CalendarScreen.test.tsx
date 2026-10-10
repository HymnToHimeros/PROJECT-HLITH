import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GameContract, GameEvent } from '../../core/contract';
import { act } from '@testing-library/react';
import { addPlan, gameData, resetUserData } from '../../core/data/userData';
import CalendarScreen from './CalendarScreen';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 7, 12);
const at = (days: number) => new Date(NOW + days * DAY).toISOString();

const events: GameEvent[] = [
  { id: 'late', title: 'Late event', kind: 'event', start: at(-3), end: at(20), reward: null, currency: 'gem' },
  { id: 'soon', title: 'Soon event', kind: 'event', start: at(-3), end: at(2), reward: null, currency: 'gem' },
  { id: 'mid', title: 'Middle event', kind: 'event', start: at(5), end: at(9), reward: null, currency: 'gem' },
  { id: 'leak', title: 'Leaked event', kind: 'event', start: at(12), end: at(18), reward: null, currency: 'gem', leak: { source: 'a forum' } },
];

const game = {
  id: 'aa',
  short: 'AA',
  name: 'Game A',
  vent: '#A99BFF',
  terms: { rarity: { top: '5★', mid: '4★' }, gear: 'Gear', weapon: 'Cone', skill: 'Skill', character: 'Character', endgame: [] },
  elements: [],
  roles: [],
  currencies: [{ id: 'gem', name: 'Gem', perPull: 160 }],
  stamina: [],
  servers: [{ id: 'eu', label: 'Europe', utcOffset: 1 }],
  reset: { hour: 4, weekday: 1 },
  modules: ['calendar'],
  bannerTypes: [],
  income: [{ id: 'aa.abyss', source: 'endgame', label: 'Deep Tower', currency: 'gem', amount: null, schedule: { kind: 'cycle', days: 14, anchor: at(-4) } }],
  historyImporters: [],
  data: {
    characters: async () => [],
    banners: async () => [],
    events: async () => events,
    versions: async () => [{ id: '1.2', start: at(-20), end: at(22) }],
    backlog: async () => [],
  },
  rules: {},
  sources: [],
} as unknown as GameContract;

const show = (servers: Record<string, string>, openAccount = () => {}) =>
  render(<CalendarScreen games={[game]} scope="aa" servers={servers} openTab={() => {}} open={() => {}} openAccount={openAccount} now={NOW} />);

describe('Calendar', () => {
  it('Dates shows what’s next (two weeks), soonest change first, with a countdown; the rest folds behind "Show N more dates"', async () => {
    show({ aa: 'eu' });
    const list = await screen.findByLabelText('Dates');
    const texts = () =>
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.textContent ?? '');
    const pos = (s: string) => texts().findIndex((t) => t.includes(s));
    // Next 7 days, then 1–2 weeks: ordered by when each next starts or ends.
    expect(within(list).getByRole('heading', { name: 'Next 7 days' })).toBeInTheDocument();
    expect(within(list).getByRole('heading', { name: 'In 1–2 weeks' })).toBeInTheDocument();
    expect(pos('Soon event')).toBe(0);
    expect(pos('Soon event')).toBeLessThan(pos('Middle event'));
    expect(pos('Middle event')).toBeLessThan(pos('Leaked event'));
    // Running: "ends in"; not started: "in".
    expect(texts()[pos('Soon event')]).toMatch(/ends in/);
    expect(texts()[pos('Middle event')]).toMatch(/in \d/);
    expect(texts()[pos('Middle event')]).not.toMatch(/ends in/);
    // More than two weeks away: folded, not gone.
    expect(pos('Late event')).toBe(-1);
    expect(pos('Version 1.2')).toBe(-1);
    const more = within(list).getByRole('button', { name: 'Show 3 more dates' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(more);
    expect(within(list).getByRole('heading', { name: 'Later' })).toBeInTheDocument();
    expect(pos('Leaked event')).toBeLessThan(pos('Late event'));
    expect(pos('Late event')).toBeLessThan(pos('Version 1.2'));
    expect(texts()[pos('Late event')]).toMatch(/ends in/);
    // Unfolded, every date not over yet is listed: 4 events, the version and 3 Deep Tower cycles.
    expect(texts()).toHaveLength(8);
    fireEvent.click(within(list).getByRole('button', { name: 'Show fewer dates' }));
    expect(pos('Late event')).toBe(-1);
  });

  it('a busy lane shows its soonest changes in a few rows; "Show N more" opens the rest', async () => {
    const busy: GameEvent[] = Array.from({ length: 7 }, (_, i) => ({ id: `b${i}`, title: `Busy ${i}`, kind: 'event', start: at(-2), end: at(3 + i * 2), reward: null, currency: 'gem' }));
    const crowded = { ...game, data: { ...game.data, events: async () => busy } } as unknown as GameContract;
    render(<CalendarScreen games={[crowded]} scope="aa" servers={{ aa: 'eu' }} openTab={() => {}} open={() => {}} openAccount={() => {}} now={NOW} />);
    const timeline = await screen.findByLabelText('Timeline');
    await within(timeline).findByText('Busy 0');
    // All 7 overlap, so 4 rows show: the 4 ending soonest. The 3 ending latest wait behind the button.
    for (const i of [0, 1, 2, 3]) expect(within(timeline).getByText(`Busy ${i}`)).toBeInTheDocument();
    for (const i of [4, 5, 6]) expect(within(timeline).queryByText(`Busy ${i}`)).toBeNull();
    fireEvent.click(within(timeline).getByRole('button', { name: 'Show 3 more events' }));
    for (const i of [4, 5, 6]) expect(within(timeline).getByText(`Busy ${i}`)).toBeInTheDocument();
    fireEvent.click(within(timeline).getByRole('button', { name: 'Show fewer events' }));
    expect(within(timeline).queryByText('Busy 6')).toBeNull();
  });

  it('weekly resets come from your server; endgame cycles from the record’s start date', async () => {
    show({ aa: 'eu' });
    await screen.findByLabelText('Dates');
    expect(screen.getAllByText('Weekly reset').length).toBeGreaterThan(3);
    expect(screen.getAllByText(/Deep Tower/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Example data, not yours/)).toBeNull();
  });

  it('leaks are marked unverified with their source', async () => {
    show({ aa: 'eu' });
    await screen.findByLabelText('Dates');
    expect(screen.getAllByText('? UNVERIFIED').length).toBeGreaterThan(0);
    expect(screen.getAllByText('a forum').length).toBeGreaterThan(0);
  });

  it('no server: asks you to choose one for weekly resets', async () => {
    const openAccount = vi.fn();
    show({}, openAccount);
    expect(await screen.findByText(/Choose your AA server to see its weekly resets/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Choose server' }));
    expect(openAccount).toHaveBeenCalled();
  });

  it('a lane with nothing in the window says so', async () => {
    show({ aa: 'eu' });
    await screen.findByLabelText('Dates');
    // This game has no character banner types, so there are no example banners either, and the lane says so.
    expect(screen.getAllByText('Nothing in these six weeks.').length).toBeGreaterThan(0);
  });

  it('shows your approved plans in "Your plans" instead of the example plan', async () => {
    resetUserData();
    act(() => addPlan('aa', { id: 'p1', title: 'Farm relics before the banner', start: new Date(NOW + 2 * 86_400_000).toISOString(), source: 'assistant', status: 'active', at: new Date(NOW).toISOString() }));
    show({ aa: 'eu' });
    expect((await screen.findAllByText('Farm relics before the banner')).length).toBeGreaterThan(0);
    resetUserData();
  });

  it('tapping a plan bar shows its details; Undo takes it off (kept, can come back)', async () => {
    resetUserData();
    act(() => addPlan('aa', { id: 'p1', title: 'Farm relics', start: at(2), source: 'assistant', status: 'active', at: at(0) }));
    show({ aa: 'eu' });
    fireEvent.click(await screen.findByRole('button', { name: 'Plan: Farm relics. Show details' }));
    const sheet = screen.getByRole('dialog', { name: 'Your plan' });
    expect(within(sheet).getByText(/Proposed by the Assistant/)).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Undo plan' }));
    expect(gameData('aa').plans[0]?.status).toBe('undone');
    expect(await screen.findByText(/undone\. It’s kept/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Plan: Farm relics. Show details' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Bring it back' }));
    expect(gameData('aa').plans[0]?.status).toBe('active');
    expect(await screen.findByRole('button', { name: 'Plan: Farm relics. Show details' })).toBeInTheDocument();
    resetUserData();
  });

  it('the EXAMPLE plan opens too, and says how to get a real one', async () => {
    resetUserData();
    const withBanners = { ...game, bannerTypes: [{ id: 'character', label: 'Character banner', pullItem: 'gem', target: 'character', pity: { kind: 'hard-pity', hardPity: 90, baseRate: 0.006 } }] } as unknown as GameContract;
    render(<CalendarScreen games={[withBanners]} scope="aa" servers={{ aa: 'eu' }} openTab={() => {}} open={() => {}} openAccount={() => {}} now={NOW} />);
    fireEvent.click(await screen.findByRole('button', { name: /^Plan: Save pulls for/ }));
    const sheet = screen.getByRole('dialog', { name: 'Example plan' });
    expect(within(sheet).getByText(/isn’t saved\. Open the Assistant/)).toBeInTheDocument();
    expect(within(sheet).queryByRole('button', { name: 'Undo plan' })).toBeNull();
  });

  it('no plans: says where the Assistant is; an empty Banners lane offers to add your own', async () => {
    resetUserData();
    show({ aa: 'eu' });
    await screen.findByLabelText('Dates');
    expect(screen.getByText(/No plans yet\. Open the Assistant/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add your own banner' }));
    expect(screen.getByRole('dialog', { name: 'Edit mode · Banners · AA' })).toBeInTheDocument();
  });
});
