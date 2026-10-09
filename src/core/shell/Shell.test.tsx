import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameContract } from '../contract';
import { getPrefs, reloadPrefs } from '../data/prefs';
import { Shell } from './Shell';

const base = (over: Partial<GameContract>): GameContract => ({
  id: 'aa',
  short: 'AA',
  name: 'Game A',
  vent: '#A99BFF',
  terms: { rarity: { top: '5★', mid: '4★' }, gear: 'G', weapon: 'W', skill: 'S', character: 'C', endgame: [] },
  elements: [],
  roles: [],
  currencies: [{ id: 'p', name: 'P', perPull: 160 }],
  stamina: [],
  servers: [
    { id: 'eu', label: 'Europe', utcOffset: 1 },
    { id: 'us', label: 'America', utcOffset: -5 },
  ],
  reset: { hour: 4, weekday: 1 },
  modules: ['today', 'events', 'calendar', 'backlog', 'pulls', 'banners', 'roster', 'farm', 'intel'],
  defaultOrder: ['today', 'pulls', 'roster', 'calendar', 'events', 'banners', 'backlog', 'farm', 'intel'],
  bannerTypes: [],
  income: [],
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
  ...over,
});
const A = base({});
const B = base({ id: 'bb', short: 'BB', name: 'Game B', vent: '#D4F23A', modules: ['today', 'pulls', 'roster'], defaultOrder: ['roster', 'today', 'pulls'] });

const sideNav = () => within(screen.getByRole('navigation', { name: 'Modules' }));
const navLabels = () => sideNav().getAllByRole('link').map((a) => a.lastChild?.textContent);

beforeEach(() => {
  localStorage.clear();
  reloadPrefs();
  window.history.replaceState(null, '', '/');
});

describe('Shell', () => {
  it('opens on All games with every module and puts it in the address', () => {
    render(<Shell games={[A, B]} />);
    expect(screen.getByRole('button', { name: 'ALL' })).toHaveAttribute('aria-pressed', 'true');
    expect(navLabels()).toHaveLength(9);
    expect(window.location.pathname).toBe('/all/today');
  });

  it('switching game shows that game’s modules in its order and tints with its vent', () => {
    const { container } = render(<Shell games={[A, B]} />);
    fireEvent.click(screen.getByRole('button', { name: 'BB' }));
    expect(navLabels()).toEqual(['Roster', 'Today', 'Pulls']);
    expect(window.location.pathname).toBe('/bb/roster');
    expect((container.firstChild as HTMLElement).style.getPropertyValue('--vent')).toBe('#D4F23A');
  });

  it('opens a module from the sidebar and remembers it per game', () => {
    render(<Shell games={[A, B]} />);
    fireEvent.click(screen.getByRole('button', { name: 'AA' }));
    fireEvent.click(sideNav().getByRole('link', { name: /Farm/ }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Farm');
    fireEvent.click(screen.getByRole('button', { name: 'BB' }));
    fireEvent.click(screen.getByRole('button', { name: 'AA' }));
    expect(window.location.pathname).toBe('/aa/farm');
  });

  it('Pulls shows its four tabs', () => {
    window.history.replaceState(null, '', '/aa/pulls');
    render(<Shell games={[A, B]} />);
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent);
    expect(tabs).toEqual(['Planner', 'Calculator', 'Bank log', 'History']);
  });

  it('phone bar holds the first four modules plus More', () => {
    window.history.replaceState(null, '', '/aa/today');
    render(<Shell games={[A, B]} />);
    const bar = within(screen.getByRole('navigation', { name: 'Modules (phone)' }));
    expect(bar.getAllByRole('button').map((b) => b.lastChild?.textContent)).toEqual(['Today', 'Pulls', 'Roster', 'Calendar', 'More']);
    fireEvent.click(bar.getByRole('button', { name: /More/ }));
    const more = within(screen.getByRole('dialog', { name: 'More' }));
    expect(more.getAllByRole('link').map((a) => a.textContent)).toEqual(['Events', 'Banners', 'Backlog', 'Farm', 'Intel']);
  });

  it('a 500 ms press on a phone tab opens Edit layout', () => {
    vi.useFakeTimers();
    render(<Shell games={[A, B]} />);
    const bar = within(screen.getByRole('navigation', { name: 'Modules (phone)' }));
    fireEvent.pointerDown(bar.getAllByRole('button')[1] as HTMLElement);
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByRole('dialog', { name: /Edit layout/ })).toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe('Edit layout', () => {
  const openEdit = () => fireEvent.click(screen.getByRole('button', { name: 'Edit layout' }));

  it('hide removes a module from the sidebar, Restore brings it back, and it is saved', () => {
    window.history.replaceState(null, '', '/aa/today');
    render(<Shell games={[A, B]} />);
    openEdit();
    const dialog = within(screen.getByRole('dialog'));
    fireEvent.click(dialog.getAllByRole('button', { name: 'Hide' })[8] as HTMLElement); // Intel
    expect(navLabels()).not.toContain('Intel');
    expect(dialog.getByText('HIDDEN · STILL IN THIS GAME')).toBeInTheDocument();
    expect(getPrefs().layouts.aa?.hidden).toEqual(['intel']);
    fireEvent.click(dialog.getByRole('button', { name: 'Restore' }));
    expect(navLabels()).toContain('Intel');
  });

  it('arrow keys on the handle reorder, and Reset to default undoes it', () => {
    window.history.replaceState(null, '', '/aa/today');
    render(<Shell games={[A, B]} />);
    openEdit();
    const dialog = within(screen.getByRole('dialog'));
    fireEvent.keyDown(dialog.getByRole('button', { name: 'Move Pulls' }), { key: 'ArrowUp' });
    expect(navLabels().slice(0, 2)).toEqual(['Pulls', 'Today']);
    fireEvent.click(dialog.getByRole('button', { name: 'Reset to default' }));
    expect(navLabels().slice(0, 2)).toEqual(['Today', 'Pulls']);
  });

  it('never lets the last visible module be hidden', () => {
    window.history.replaceState(null, '', '/bb/roster');
    render(<Shell games={[A, B]} />);
    openEdit();
    const dialog = within(screen.getByRole('dialog'));
    fireEvent.click(dialog.getAllByRole('button', { name: 'Hide' })[0] as HTMLElement);
    fireEvent.click(dialog.getAllByRole('button', { name: 'Hide' })[0] as HTMLElement);
    expect(dialog.queryAllByRole('button', { name: 'Hide' })).toHaveLength(0);
    expect(navLabels()).toHaveLength(1);
  });

  it('shows modules the game lacks as not available', () => {
    window.history.replaceState(null, '', '/bb/roster');
    render(<Shell games={[A, B]} />);
    openEdit();
    expect(screen.getByText('NOT IN THIS GAME')).toBeInTheDocument();
    expect(screen.getAllByText('Not available for this game yet')).toHaveLength(6);
  });
});

describe('Server picker', () => {
  it('asks for a server until one is chosen, then shows the reset in local time', () => {
    window.history.replaceState(null, '', '/aa/today');
    render(<Shell games={[A, B]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Choose your AA server' }));
    fireEvent.click(screen.getAllByRole('radio', { name: /Europe/ })[0] as HTMLElement);
    expect(getPrefs().servers.aa).toBe('eu');
    expect(screen.getByRole('button', { name: /Europe · reset .+ your time/ })).toBeInTheDocument();
  });
});

describe('Your games', () => {
  it('turning a game off removes it from the switcher but never the last one', () => {
    render(<Shell games={[A, B]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add or remove games' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Game B' }));
    expect(screen.queryByRole('button', { name: 'BB' })).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Game A' })).toBeDisabled();
  });
});
