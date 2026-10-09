import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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

describe('Owner console (frame)', () => {
  it('shows game records, real list counts, example leak sources and honest user stats', async () => {
    render(<OwnerConsole games={[game]} scope="all" servers={{}} openTab={() => {}} open={() => {}} openAccount={() => {}} />);
    expect(screen.getByText('Game A')).toBeInTheDocument();
    expect(screen.getByText(/1 servers · reset 04:00 · Mon · 2 modules/)).toBeInTheDocument();
    expect(screen.getByText('Gems')).toBeInTheDocument();
    // User stats need the backend: no numbers.
    expect(screen.getAllByText('No data yet · needs the backend')).toHaveLength(3);
    // List sizes are counted from the built-in lists themselves.
    const lists = screen.getByRole('region', { name: 'Built-in lists' });
    expect(await within(lists).findByText('2')).toBeInTheDocument();
    // Leak sources are examples until the backend holds the list.
    const sources = screen.getByRole('region', { name: 'Leak sources' });
    expect(within(sources).getAllByText('EXAMPLE').length).toBeGreaterThan(0);
    const sw = within(sources).getByRole('switch', { name: 'Use Datamine file names' });
    fireEvent.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'false');
  });

  it('an announcement stays on screen, clearly not sent', () => {
    render(<OwnerConsole games={[game]} scope="all" servers={{}} openTab={() => {}} open={() => {}} openAccount={() => {}} />);
    fireEvent.change(screen.getByLabelText('Announcement'), { target: { value: 'Maintenance on Wednesday' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(screen.getByText('Maintenance on Wednesday')).toBeInTheDocument();
    expect(screen.getByText(/Not sent yet/)).toBeInTheDocument();
  });
});
