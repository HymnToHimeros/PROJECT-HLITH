import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GameContract } from '../../core/contract';
import OwnerConsole from './OwnerConsole';

const game = {
  id: 'aa',
  short: 'AA',
  name: 'Game A',
  vent: '#A99BFF',
  currencies: [{ id: 'gem', name: 'Gems' }],
  servers: [{ id: 'eu', label: 'Europe', utcOffset: 1 }],
  reset: { hour: 4, weekday: 1 },
  modules: ['today', 'roster'],
  data: {
    characters: async () => [{ id: 'c1' }, { id: 'c2' }],
    banners: async () => [],
    events: async () => [{ id: 'e1' }],
    materials: async () => [],
    backlog: async () => [],
  },
} as unknown as GameContract;

describe('Owner console', () => {
  it('shows game records and real list counts, and names unbuilt parts once instead of dead controls', async () => {
    render(<OwnerConsole games={[game]} scope="all" servers={{}} openTab={() => {}} open={() => {}} openAccount={() => {}} />);
    expect(screen.getByText('Game A')).toBeInTheDocument();
    expect(screen.getByText(/1 servers · reset 04:00 · Mon · 2 modules/)).toBeInTheDocument();
    expect(screen.getByText('Gems')).toBeInTheDocument();
    // List sizes are counted from the built-in lists themselves.
    const lists = screen.getByRole('region', { name: 'Built-in lists' });
    expect(await within(lists).findByText('2')).toBeInTheDocument();
    expect(screen.getByText(/Planned, not built yet/)).toBeInTheDocument();
    // No fake Publish, no switches that do nothing, no buttons that can never be pressed.
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryAllByRole('button').filter((b) => (b as HTMLButtonElement).disabled)).toHaveLength(0);
    expect(screen.queryByText(/needs the backend|comes with the backend/i)).toBeNull();
  });

  it('the open tab can follow the address', () => {
    const openTab = vi.fn();
    render(<OwnerConsole games={[game]} scope="all" servers={{}} tab="findings" openTab={openTab} open={() => {}} openAccount={() => {}} />);
    expect(screen.getByRole('tab', { name: /Findings/ })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Scheduler' }));
    expect(openTab).toHaveBeenCalledWith('scheduler');
  });
});
