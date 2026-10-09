import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { GameContract, GameEvent } from '../../core/contract';
import { gameData, resetUserData } from '../../core/data/userData';
import EventsScreen from './EventsScreen';

const DAY = 86_400_000;

const makeGame = (events: GameEvent[] = []): GameContract =>
  ({
    id: 'aa',
    short: 'AA',
    name: 'Game A',
    vent: '#A99BFF',
    terms: { rarity: { top: '5★', mid: '4★' }, gear: 'G', weapon: 'Cone', skill: 'S', character: 'Hero', endgame: ['Tower'] },
    elements: [],
    roles: [],
    currencies: [
      { id: 'gem', name: 'Gem', perPull: 160 },
      { id: 'ticket', name: 'Ticket', pullItemFor: ['character'] },
    ],
    teamSize: 4,
    stamina: [],
    servers: [{ id: 'eu', label: 'Europe', utcOffset: 1 }],
    reset: { hour: 4, weekday: 1 },
    modules: ['events'],
    bannerTypes: [{ id: 'character', label: 'Character banner', pullItem: 'ticket', target: 'character', pity: { kind: 'hard-pity', hardPity: 90, baseRate: 0.006 } }],
    income: [
      { id: 'aa.tower', source: 'endgame', label: 'Tower', currency: 'gem', amount: null, schedule: { kind: 'cycle', days: 14 } },
      { id: 'aa.events', source: 'events', label: 'Events', currency: 'gem', amount: null, schedule: { kind: 'from-events' } },
    ],
    historyImporters: [],
    data: {
      characters: async () => [],
      banners: async () => [],
      events: async () => events,
      versions: async () => [],
      backlog: async () => [],
      materials: async () => [],
      teams: async () => [],
    },
    rules: {},
    sources: [],
  }) as unknown as GameContract;

const show = async (game = makeGame(), servers: Record<string, string> = {}) => {
  render(<EventsScreen games={[game]} scope="aa" servers={servers} openTab={() => {}} open={() => {}} openAccount={() => {}} />);
  await screen.findByText('Rewards left');
};

const row = (title: string) => screen.getByRole('listitem', { name: title });
const stillToEarn = () => screen.getByText('Rewards left').closest('div')?.parentElement as HTMLElement;

describe('Events screen', () => {
  beforeEach(() => {
    localStorage.clear();
    resetUserData();
  });

  it('shows example events, clearly marked, and says the list is ours to add', async () => {
    await show();
    expect(screen.getByText(/Example data, not yours/)).toBeInTheDocument();
    expect(screen.getByText(/still has to be added by us/)).toBeInTheDocument();
    expect(screen.getByText('Limited story event')).toBeInTheDocument();
    expect(screen.getAllByText('EXAMPLE').length).toBeGreaterThan(3);
    // The leak is marked unverified, with its source.
    expect(within(row('Rumoured collaboration event')).getByText('? UNVERIFIED')).toBeInTheDocument();
    // Endgame cycle from the game record, honest about missing dates.
    expect(within(row('Tower')).getByText('Dates not known yet')).toBeInTheDocument();
  });

  it('marking an event done or skipped saves it and stops counting its reward', async () => {
    await show();
    // No server: login days are left out, so the total is 1,000 + 120 + 900.
    expect(within(stillToEarn()).getByText(/2,020/)).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole('group', { name: 'State of Limited story event' })).getByRole('button', { name: 'Done' }));
    expect(gameData('aa').events['example-limited']).toEqual({ state: 'done' });
    expect(within(row('Limited story event')).getByText(/already in your bank/)).toBeInTheDocument();
    expect(within(stillToEarn()).getByText(/1,020/)).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole('group', { name: 'State of Web event' })).getByRole('button', { name: 'Skip' }));
    expect(gameData('aa').events['example-web']?.state).toBe('skipped');
    expect(within(row('Web event')).getByText(/Skipped · not counted/)).toBeInTheDocument();
  });

  it('claims login days with + / − and by tapping a day', async () => {
    await show(makeGame(), { aa: 'eu' });
    const login = row('Daily login event');
    fireEvent.click(within(login).getByRole('button', { name: 'Claim one more day for Daily login event' }));
    fireEvent.click(within(login).getByRole('button', { name: 'Claim one more day for Daily login event' }));
    expect(gameData('aa').events['example-login']).toEqual({ state: 'open', daysClaimed: 2 });
    expect(within(login).getByText('2/7 days')).toBeInTheDocument();

    fireEvent.click(within(login).getByRole('button', { name: 'Undo one day for Daily login event' }));
    expect(gameData('aa').events['example-login']?.daysClaimed).toBe(1);

    fireEvent.click(within(login).getByRole('button', { name: 'Day 5' }));
    expect(gameData('aa').events['example-login']?.daysClaimed).toBe(5);
    // 2 of 7 days left: 700 / 7 × 2.
    expect(within(login).getByText('200')).toBeInTheDocument();
  });

  it('a real event list replaces the examples, and unknown rewards show No data yet', async () => {
    const now = Date.now();
    await show(
      makeGame([{ id: 'ev1', title: 'Real event', kind: 'event', start: new Date(now - DAY).toISOString(), end: new Date(now + 3 * DAY).toISOString(), reward: null, currency: 'gem' }]),
    );
    expect(screen.getByText('Real event')).toBeInTheDocument();
    expect(screen.queryByText('Limited story event')).not.toBeInTheDocument();
    expect(within(row('Real event')).queryByText('EXAMPLE')).not.toBeInTheDocument();
    expect(within(row('Real event')).getByText(/No data yet/)).toBeInTheDocument();
  });

  it('filters by login events and by ending soon', async () => {
    await show();
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByRole('listitem', { name: 'Daily login event' })).toBeInTheDocument();
    expect(screen.queryByRole('listitem', { name: 'Limited story event' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ending soon' }));
    expect(screen.getByRole('listitem', { name: 'Web event' })).toBeInTheDocument();
    expect(screen.queryByRole('listitem', { name: 'Limited story event' })).not.toBeInTheDocument();
  });
});
