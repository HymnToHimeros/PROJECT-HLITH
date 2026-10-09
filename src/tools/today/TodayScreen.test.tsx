import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Banner, Character, GameContract } from '../../core/contract';
import { gameData, resetUserData, setRosterEntry, setTick } from '../../core/data/userData';
import { serverRule } from '../../core/time/reset';
import { buildTasks, byUrgency, tickCounts } from './tasks';
import TodayScreen from './TodayScreen';

const HOUR = 3_600_000;
// Wednesday 7 Oct 2026, 12:00 UTC. Server is UTC+1 with a 04:00 reset → daily reset at 03:00 UTC.
const NOW = Date.UTC(2026, 9, 7, 12);
const NEXT_DAILY = Date.UTC(2026, 9, 8, 3);

const chars: Character[] = [
  { id: 'c1', name: 'Newest Star', rarity: 'top', element: 'e', role: 'r', releasedAt: '2026-09-01' },
  { id: 'c2', name: 'Older Star', rarity: 'top', element: 'e', role: 'r', releasedAt: '2025-01-01' },
];

const banners: Banner[] = [
  { id: 'b1', type: 'character', title: 'Starfall', featured: ['c1'], start: new Date(NOW - 48 * HOUR).toISOString(), end: new Date(NOW + 200 * HOUR).toISOString() },
  { id: 'b2', type: 'character', title: 'Old Light', featured: ['c2'], start: new Date(NOW + 300 * HOUR).toISOString(), end: new Date(NOW + 600 * HOUR).toISOString() },
];

const makeGame = (withBanners: boolean): GameContract =>
  ({
    id: 'aa',
    short: 'AA',
    name: 'Game A',
    vent: '#A99BFF',
    terms: { rarity: { top: '5★', mid: '4★' }, gear: 'Gear', weapon: 'Cone', skill: 'Skill', character: 'Character', endgame: [] },
    elements: [{ id: 'e', label: 'E', color: '#ffffff' }],
    roles: [{ id: 'r', label: 'R' }],
    currencies: [{ id: 'gem', name: 'Gem', perPull: 160 }],
    stamina: [{ id: 'power', name: 'Power', max: 240, minutesPerPoint: 6 }],
    servers: [{ id: 'eu', label: 'Europe', utcOffset: 1 }],
    reset: { hour: 4, weekday: 1 },
    modules: ['today'],
    bannerTypes: [{ id: 'character', label: 'Character banner', pullItem: 'gem', target: 'character', pity: { kind: 'hard-pity', hardPity: 90, baseRate: 0.006 } }],
    income: [
      { id: 'aa.daily', source: 'daily', label: 'Daily task', currency: 'gem', amount: 60, schedule: { kind: 'per-reset' } },
      { id: 'aa.weekly', source: 'weekly', label: 'Weekly task', currency: 'gem', amount: 200, schedule: { kind: 'weekly' } },
    ],
    historyImporters: [],
    data: {
      characters: async () => chars,
      banners: async () => (withBanners ? banners : []),
      events: async () => [],
      versions: async () => [],
      backlog: async () => [],
    },
    rules: {},
    sources: [],
  }) as unknown as GameContract;

const game = makeGame(true);

const props = (over: Partial<Parameters<typeof TodayScreen>[0]> = {}) => ({
  games: [game],
  scope: 'aa',
  servers: { aa: 'eu' },
  openTab: () => {},
  open: () => {},
  openAccount: () => {},
  now: NOW,
  ...over,
});

describe('Today', () => {
  beforeEach(() => {
    localStorage.clear();
    resetUserData();
  });

  it('a tick counts until the next daily reset, then clears by itself', async () => {
    act(() => setTick('aa', 'income:aa.daily', new Date(NOW - HOUR).toISOString()));
    const { rerender } = render(<TodayScreen {...props()} />);
    const box = await screen.findByRole('checkbox', { name: 'Daily task' });
    expect(box).toBeChecked();
    rerender(<TodayScreen {...props({ now: NEXT_DAILY + 60_000 })} />);
    expect(screen.getByRole('checkbox', { name: 'Daily task' })).not.toBeChecked();
    // The tick itself is never deleted; it simply no longer counts.
    expect(gameData('aa').ticks['income:aa.daily']).toBeDefined();
  });

  it('a tick made before the last reset does not count', () => {
    const rule = serverRule(game, 'eu');
    expect(tickCounts(new Date(NOW - 10 * HOUR).toISOString(), 'daily', NOW, rule)).toBe(false); // 02:00 UTC, before 03:00 reset
    expect(tickCounts(new Date(NOW - 8 * HOUR).toISOString(), 'daily', NOW, rule)).toBe(true); // 04:00 UTC
    expect(tickCounts(new Date(NOW - 8 * HOUR).toISOString(), 'weekly', NOW, rule)).toBe(true); // weekly reset was Monday
  });

  it('ticking in the checklist stores the time and moves the task out of tonight’s run', async () => {
    render(<TodayScreen {...props()} />);
    const run = await screen.findByLabelText('Tonight’s run');
    expect(within(run).getByText('Daily task')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Daily task' }));
    expect(gameData('aa').ticks['income:aa.daily']).toBe(new Date(NOW).toISOString());
    // Wait for the screen to redraw after the tick.
    await waitFor(() => expect(within(screen.getByLabelText('Tonight’s run')).queryByText('Daily task')).not.toBeInTheDocument());
    expect(await within(screen.getByLabelText('Tonight’s run')).findByText('1/3 done')).toBeInTheDocument();
  });

  it('tonight’s run puts what resets first at the top, each with a reason', () => {
    const tasks = buildTasks({ game, serverId: 'eu', user: gameData('aa'), events: [], farmNames: ['Newest Star'], now: NOW }).sort(byUrgency);
    expect(tasks.map((t) => t.label)).toEqual(['Daily task', 'Spend Power', 'Weekly task']);
    expect(tasks[1]?.why).toMatch(/Newest Star/);
    expect(tasks.every((t) => t.why.length > 0)).toBe(true);
  });

  it('with no server: resets are unknown and it asks you to choose one', async () => {
    const openAccount = vi.fn();
    render(<TodayScreen {...props({ servers: {}, openAccount })} />);
    expect(await screen.findByText(/Choose your server first/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Daily task' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Choose my server' }));
    expect(openAccount).toHaveBeenCalled();
    expect(screen.getAllByText(/No data yet/).length).toBeGreaterThan(1);
  });

  it('stamina is honest: no live link, so no number', async () => {
    render(<TodayScreen {...props()} />);
    const tile = (await screen.findByText('Power', { selector: 'span' })).closest('div')?.parentElement as HTMLElement;
    expect(within(tile).getByText(/No data yet/)).toBeInTheDocument();
    expect(within(tile).getByRole('button', { name: 'Connect account' })).toBeInTheDocument();
  });

  it('wishlist: empty asks you to pick wanted characters', async () => {
    const open = vi.fn();
    render(<TodayScreen {...props({ open })} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Pick wanted characters' }));
    expect(open).toHaveBeenCalledWith('roster', 'characters');
  });

  it('wishlist shows banners featuring your wanted characters', async () => {
    act(() => setRosterEntry('aa', 'c1', { owned: false, wanted: true, dupes: 0 }));
    render(<TodayScreen {...props()} />);
    const wish = await screen.findByLabelText('Wishlist');
    expect(within(wish).getAllByText('Newest Star')).toHaveLength(2); // the banner row and the wanted chip
    expect(within(wish).getByText(/Character banner/)).toBeInTheDocument();
    expect(within(wish).queryByText('Older Star')).not.toBeInTheDocument();
    expect(within(wish).queryByText('EXAMPLE')).not.toBeInTheDocument();
  });

  it('without a banner list, examples are shown and marked', async () => {
    render(<TodayScreen {...props({ games: [makeGame(false)] })} />);
    expect(await screen.findByText(/Example data, not yours/)).toBeInTheDocument();
    expect(screen.getAllByText('EXAMPLE').length).toBeGreaterThan(1);
  });

  it('the server chip opens the server picker for that game', async () => {
    const openServer = vi.fn();
    render(<TodayScreen {...props({ servers: {}, openServer })} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Choose your AA server' }));
    expect(openServer).toHaveBeenCalledWith('aa');
  });

  it('open tasks count what is ticked, with a Daily or Weekly label', async () => {
    act(() => setTick('aa', 'income:aa.daily', new Date(NOW - HOUR).toISOString()));
    render(<TodayScreen {...props()} />);
    const card = await screen.findByLabelText('Open tasks');
    expect(within(card).getByText('1/3')).toBeInTheDocument();
    expect(within(card).getAllByText('Daily').length).toBe(2);
    expect(within(card).getByText('Weekly')).toBeInTheDocument();
  });

  it('All games: one merged screen with game tags', async () => {
    const other = { ...makeGame(true), id: 'bb', short: 'BB', name: 'Game B' } as GameContract;
    render(<TodayScreen {...props({ games: [game, other], scope: 'all', servers: { aa: 'eu', bb: 'eu' } })} />);
    const run = await screen.findByLabelText('Tonight’s run');
    expect(within(run).getAllByText('Daily task')).toHaveLength(2);
    expect(within(run).getAllByText('BB').length).toBeGreaterThan(0);
  });
});
