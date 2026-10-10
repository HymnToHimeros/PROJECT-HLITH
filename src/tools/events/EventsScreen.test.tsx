import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GameContract, GameEvent } from '../../core/contract';
import { act } from '@testing-library/react';
import { updatePrefs } from '../../core/data/prefs';
import { gameData, resetUserData, setEventProgress } from '../../core/data/userData';
import { resetHideLeaks, setHideLeaks } from '../banners/leakPref';
import EventsScreen from './EventsScreen';

const DAY = 86_400_000;

const makeGame = (events: GameEvent[] = [], withCycle = true): GameContract =>
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
      ...(withCycle ? [{ id: 'aa.tower', source: 'endgame', label: 'Tower', currency: 'gem', amount: null, schedule: { kind: 'cycle', days: 14 } }] : []),
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
  afterEach(() => {
    updatePrefs((p) => ({ ...p, hideExamples: false }));
    resetHideLeaks();
  });

  it('shows example events, clearly marked, and says the list is ours to add', async () => {
    await show();
    expect(screen.getByText(/Example data, not yours/)).toBeInTheDocument();
    expect(screen.getByText(/still has to be added by us/)).toBeInTheDocument();
    expect(screen.getByText('Limited story event')).toBeInTheDocument();
    expect(screen.getAllByText('EXAMPLE').length).toBeGreaterThan(3);
    // The leak is marked unverified, with its source.
    expect(within(row('Rumoured collaboration event')).getByText('? UNVERIFIED')).toBeInTheDocument();
    // Endgame cycle without a start date: the same EXAMPLE dates Calendar draws, marked as such.
    expect(within(row('Tower')).getByText(/example dates/)).toBeInTheDocument();
    expect(within(row('Tower')).getByText('EXAMPLE')).toBeInTheDocument();
    expect(screen.getByText(/Endgame cycle dates marked EXAMPLE/)).toBeInTheDocument();
  });

  it('with examples hidden, an endgame cycle without a start date says its dates are not known', async () => {
    act(() => updatePrefs((p) => ({ ...p, hideExamples: true })));
    await show();
    expect(within(row('Tower')).getByText('Dates not known yet')).toBeInTheDocument();
    expect(within(row('Tower')).queryByText('EXAMPLE')).not.toBeInTheDocument();
  });

  it('with no event running or coming up, says so and points to Edit list; cycles still show', async () => {
    const now = Date.now();
    await show(makeGame([{ id: 'old', title: 'Old event', kind: 'event', start: new Date(now - 9 * DAY).toISOString(), end: new Date(now - DAY).toISOString(), reward: null, currency: 'gem' }]));
    expect(screen.getByText(/No events running or coming up/)).toBeInTheDocument();
    expect(screen.getByText(/Edit list/, { selector: 'p' })).toBeInTheDocument();
    expect(row('Tower')).toBeInTheDocument();
  });

  it('the version end is "an example", not "an example too", when nothing else is', async () => {
    const now = Date.now();
    await show(makeGame([{ id: 'ev1', title: 'Real event', kind: 'event', start: new Date(now - DAY).toISOString(), end: new Date(now + 3 * DAY).toISOString(), reward: null, currency: 'gem' }], false));
    expect(screen.getByText(/The version end date is an example, until/)).toBeInTheDocument();
    expect(screen.queryByText(/an example too/)).not.toBeInTheDocument();
  });

  it('login days can be claimed only while the event runs, but − still undoes on an ended one', async () => {
    const now = Date.now();
    const ended: GameEvent = { id: 'lg', title: 'Old login', kind: 'login', start: new Date(now - 9 * DAY).toISOString(), end: new Date(now - DAY).toISOString(), reward: 700, currency: 'gem', loginDays: 7 };
    act(() => setEventProgress('aa', 'lg', { state: 'open', daysClaimed: 2 }));
    await show(makeGame([ended]), { aa: 'eu' });
    fireEvent.click(screen.getByRole('button', { name: 'Show 1 ended' }));
    const login = row('Old login');
    expect(within(login).getByRole('button', { name: 'Claim one more day for Old login' })).toBeDisabled();
    expect(within(login).getByRole('button', { name: 'Day 3' })).toBeDisabled();
    fireEvent.click(within(login).getByRole('button', { name: 'Undo one day for Old login' }));
    expect(gameData('aa').events['lg']?.daysClaimed).toBe(1);
  });

  it('Hide leaks hides leaked events here too', async () => {
    act(() => setHideLeaks(true));
    await show();
    expect(screen.queryByText('Rumoured collaboration event')).not.toBeInTheDocument();
    expect(screen.getByText('Limited story event')).toBeInTheDocument();
  });

  it('marking an event done (one tap) or skipped (from its menu) saves it and stops counting its reward', async () => {
    await show();
    // No server: login days are left out, so the total is 1,000 + 120 + 900.
    expect(within(stillToEarn()).getByText(/2,020/)).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole('group', { name: 'State of Limited story event' })).getByRole('button', { name: 'Mark Limited story event done' }));
    expect(gameData('aa').events['example-limited']).toEqual({ state: 'done' });
    expect(within(stillToEarn()).getByText(/1,020/)).toBeInTheDocument();
    // It folds away under "Done or skipped"; Show brings it back.
    expect(screen.queryByRole('listitem', { name: 'Limited story event' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show 1 done or skipped' }));
    expect(within(row('Limited story event')).getByText(/already in your bank/)).toBeInTheDocument();

    fireEvent.click(within(row('Web event')).getByRole('button', { name: 'More for Web event' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Skip/ }));
    expect(gameData('aa').events['example-web']?.state).toBe('skipped');
    expect(within(row('Web event')).getByText(/Skipped · not counted/)).toBeInTheDocument();
  });

  it('every change can be undone, and a settled row can be reopened or switched', async () => {
    await show();
    fireEvent.click(screen.getByRole('button', { name: 'Mark Limited story event done' }));
    expect(screen.getByRole('status')).toHaveTextContent('“Limited story event” marked done.');
    const undo = screen.getByRole('button', { name: /^Undo: Limited story event/ });
    expect(undo).toHaveFocus();
    fireEvent.click(undo);
    expect(gameData('aa').events['example-limited']).toEqual({ state: 'open' });
    expect(screen.getByRole('status')).toHaveTextContent('back to open');
    expect(within(row('Limited story event')).getByRole('button', { name: 'Mark Limited story event done' })).toBeInTheDocument();

    // Done, then from the menu: skip instead, then reopen.
    fireEvent.click(screen.getByRole('button', { name: 'Mark Limited story event done' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show 1 done or skipped' }));
    fireEvent.click(screen.getByRole('button', { name: 'More for Limited story event' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Skip instead' }));
    expect(gameData('aa').events['example-limited']?.state).toBe('skipped');
    fireEvent.click(within(row('Limited story event')).getByRole('button', { name: 'Reopen Limited story event' }));
    expect(gameData('aa').events['example-limited']?.state).toBe('open');
  });

  it('changing the state keeps the login days already claimed', async () => {
    act(() => setEventProgress('aa', 'example-login', { state: 'open', daysClaimed: 3 }));
    await show(makeGame(), { aa: 'eu' });
    fireEvent.click(screen.getByRole('button', { name: 'Mark Daily login event done' }));
    expect(gameData('aa').events['example-login']).toEqual({ state: 'done', daysClaimed: 3 });
    fireEvent.click(screen.getByRole('button', { name: /^Undo/ }));
    expect(gameData('aa').events['example-login']).toEqual({ state: 'open', daysClaimed: 3 });
  });

  it('the ⋯ menu works from the keyboard and Escape closes it', async () => {
    await show();
    const trigger = within(row('Web event')).getByRole('button', { name: 'More for Web event' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: /Skip/ })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('groups rows into ending soon, running now and coming up; ended ones fold behind Show N', async () => {
    await show();
    const group = (name: string) => screen.getByRole('list', { name });
    expect(within(group('Ending soon')).getByRole('listitem', { name: 'Web event' })).toBeInTheDocument();
    expect(within(group('Running now')).getByRole('listitem', { name: 'Limited story event' })).toBeInTheDocument();
    expect(within(group('Coming up')).getByRole('listitem', { name: 'Next limited event' })).toBeInTheDocument();
    // Ended: folded until asked.
    expect(screen.queryByRole('listitem', { name: 'Previous limited event' })).not.toBeInTheDocument();
    const showEnded = screen.getByRole('button', { name: 'Show 1 ended' });
    expect(showEnded).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(showEnded);
    expect(within(group('Ended')).getByRole('listitem', { name: 'Previous limited event' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hide ended' }));
    expect(screen.queryByRole('listitem', { name: 'Previous limited event' })).not.toBeInTheDocument();
  });

  it('a long Coming up list shows the first rows and folds the rest behind Show N more', async () => {
    const now = Date.now();
    const next = (i: number): GameEvent => ({ id: `n${i}`, title: `Next ${i}`, kind: 'event', start: new Date(now + (i + 1) * DAY).toISOString(), end: new Date(now + (i + 9) * DAY).toISOString(), reward: 100, currency: 'gem' });
    await show(makeGame([1, 2, 3, 4, 5, 6].map(next)));
    expect(within(screen.getByRole('list', { name: 'Coming up' })).getAllByRole('listitem')).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: 'Show 2 more coming up' }));
    expect(within(screen.getByRole('list', { name: 'Coming up' })).getAllByRole('listitem')).toHaveLength(6);
  });

  it('bigger rewards stand out and rows worth nothing stay quiet', async () => {
    const now = Date.now();
    const ev = (id: string, reward: number): GameEvent => ({ id, title: id, kind: 'event', start: new Date(now - DAY).toISOString(), end: new Date(now + 9 * DAY).toISOString(), reward, currency: 'gem' });
    await show(makeGame([ev('Big', 800), ev('Small', 320), ev('Zero', 0)], false));
    expect(row('Big')).toHaveAttribute('data-weight', 'high');
    expect(row('Small')).toHaveAttribute('data-weight', 'normal');
    expect(row('Zero')).toHaveAttribute('data-weight', 'none');
  });

  it('Edit list sits with the list actions next to the filters', async () => {
    await show();
    const filters = screen.getByRole('group', { name: 'Show events' });
    expect(filters.parentElement).toContainElement(screen.getByRole('button', { name: /Add, change or hide/ }));
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
