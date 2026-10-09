import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GameContract, GameEvent } from '../../core/contract';
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
  it('lists every date not over yet, by start, with a countdown', async () => {
    show({ aa: 'eu' });
    const list = await screen.findByLabelText('Dates');
    const texts = within(list)
      .getAllByRole('listitem')
      .map((li) => li.textContent ?? '');
    const pos = (s: string) => texts.findIndex((t) => t.includes(s));
    expect(pos('Version 1.2')).toBe(0);
    expect(pos('Soon event')).toBeLessThan(pos('Middle event'));
    expect(pos('Late event')).toBeLessThan(pos('Middle event'));
    expect(pos('Middle event')).toBeLessThan(pos('Leaked event'));
    // Running: "ends in"; not started: "in".
    expect(texts[pos('Soon event')]).toMatch(/ends in/);
    expect(texts[pos('Middle event')]).toMatch(/in \d/);
    expect(texts[pos('Middle event')]).not.toMatch(/ends in/);
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
});
