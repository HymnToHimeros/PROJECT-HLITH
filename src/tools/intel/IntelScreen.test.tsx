import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Banner, Character, GameContract } from '../../core/contract';
import { resetHideLeaks } from '../banners/leakPref';
import IntelScreen from './IntelScreen';

const DAY = 86_400_000;
const now = Date.now();
const iso = (offsetDays: number) => new Date(now + offsetDays * DAY).toISOString();

const chars: Character[] = [
  { id: 'old', name: 'Old Friend', rarity: 'top', element: 'e', role: 'r', releasedAt: iso(-200), source: 'list A' },
  { id: 'soon', name: 'Soon Star', rarity: 'top', element: 'e', role: 'r', releasedAt: iso(12), source: 'list A' },
  { id: 'leaked', name: 'Leaked Star', rarity: 'top', element: 'e', role: 'r' },
];
const banners: Banner[] = [
  { id: 'l1', type: 'character', title: 'Leak banner', featured: ['leaked', 'old'], start: iso(20), end: iso(40), leak: { source: 'a test leaker' } },
];

const makeGame = (characters: Character[], list: Banner[]): GameContract =>
  ({
    id: 'aa',
    short: 'AA',
    name: 'Game A',
    vent: '#A99BFF',
    terms: { rarity: { top: '5★', mid: '4★' }, gear: 'G', weapon: 'Cone', skill: 'S', character: 'Agent', endgame: [] },
    elements: [{ id: 'e', label: 'Spark', color: '#ffffff' }],
    roles: [{ id: 'r', label: 'Runner' }],
    currencies: [],
    teamSize: 4,
    stamina: [],
    servers: [],
    reset: { hour: 4, weekday: 1 },
    modules: ['intel'],
    bannerTypes: [],
    income: [],
    historyImporters: [],
    data: {
      characters: async () => characters,
      banners: async () => list,
      events: async () => [],
      backlog: async () => [],
      materials: async () => [],
      teams: async () => [],
      versions: async () => [],
    },
    rules: {},
    sources: [],
  }) as GameContract;

const show = (game: GameContract) => render(<IntelScreen games={[game]} scope="aa" servers={{}} openTab={() => {}} open={() => {}} openAccount={() => {}} />);

describe('Intel screen', () => {
  beforeEach(() => {
    localStorage.clear();
    resetHideLeaks();
  });

  it('lists unreleased characters, soonest first, each unverified with its source', async () => {
    show(makeGame(chars, banners));
    await screen.findByText('Soon Star');
    // Topic tabs: all 8 tabs (All + 7 topics) always shown with counts.
    const tabs = screen.getByRole('tablist', { name: 'Topic' });
    expect(within(tabs).getAllByRole('tab').map((b) => b.textContent)).toEqual(['All (2)', 'Characters (2)', 'Story (0)', 'Weapons & items (0)', 'Events & modes (0)', 'Systems (0)', 'Codes (0)', 'Other (0)']);
    // No reliability list yet: honest "No data yet", not a made-up rating.
    expect(screen.getAllByText('Source reliability')).toHaveLength(2);
    const cards = screen.getAllByRole('article');
    expect(cards.map((c) => c.getAttribute('aria-label'))).toEqual(['Soon Star', 'Leaked Star']);
    expect(within(cards[0] as HTMLElement).getByText('list A')).toBeInTheDocument();
    expect(within(cards[1] as HTMLElement).getByText('a test leaker')).toBeInTheDocument();
    expect(within(cards[1] as HTMLElement).getByText('? UNVERIFIED')).toBeInTheDocument();
    expect(screen.queryByText('Old Friend')).not.toBeInTheDocument();
    expect(screen.queryByText(/Example data/)).not.toBeInTheDocument();
  });

  it('hides everything while "Hide leaks" is on', async () => {
    show(makeGame(chars, banners));
    await screen.findByText('Soon Star');
    fireEvent.click(screen.getByRole('switch', { name: 'Hide leaks' }));
    expect(screen.queryByText('Soon Star')).not.toBeInTheDocument();
    expect(screen.getByText('Leaks are hidden')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show leaks' }));
    expect(await screen.findByText('Soon Star')).toBeInTheDocument();
  });

  it('with nothing upcoming, shows generic example cards and says the list is still to be added', async () => {
    show(makeGame([chars[0] as Character], []));
    expect(await screen.findByText(/Nothing upcoming is listed for this game yet/)).toBeInTheDocument();
    expect(screen.getByText('A new 5★ agent')).toBeInTheDocument();
    expect(screen.getAllByText('EXAMPLE').length).toBeGreaterThan(1);
    // The topic tabs narrow the list: area maps to events-modes.
    fireEvent.click(within(screen.getByRole('tablist', { name: 'Topic' })).getByRole('tab', { name: /Events & modes/ }));
    expect(screen.getAllByRole('article').map((c) => c.getAttribute('aria-label'))).toEqual(['A new limited event', 'A new map area']);
  });

  it('says plainly where Hide leaks applies and that leak alerts are not built yet', async () => {
    show(makeGame(chars, banners));
    await screen.findByText('Soon Star');
    expect(screen.getByText(/also hides leaks in Today, Events, Calendar, Banners and the Pulls planner/)).toBeInTheDocument();
    expect(screen.getByText(/Leak alerts .* aren’t built yet/)).toBeInTheDocument();
    expect(screen.queryByText(/evening message/)).toBeNull();
  });
});
