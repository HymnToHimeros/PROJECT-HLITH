import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { GameContract } from '../../core/contract';
import OwnerConsole from './OwnerConsole';

const game = {
  id: 'aa',
  short: 'AA',
  name: 'Game A',
  vent: '#A99BFF',
  currencies: [],
  servers: [],
  reset: { hour: 4, weekday: 1 },
  modules: [],
  data: { characters: async () => [], banners: async () => [], events: async () => [], materials: async () => [], backlog: async () => [] },
} as unknown as GameContract;

const renderConsole = () => render(<OwnerConsole games={[game]} scope="all" servers={{}} openTab={() => {}} open={() => {}} openAccount={() => {}} />);

describe('Owner console · Scheduler (this device only)', () => {
  it('shows every job from the code, who runs it, LIVE / FRAME, and an EXAMPLE run log', () => {
    renderConsole();
    fireEvent.click(screen.getByRole('tab', { name: 'Scheduler' }));
    expect(screen.getByText(/run log below is an example/)).toBeInTheDocument();
    const supa = screen.getByRole('region', { name: 'Run by Supabase' });
    const backup = within(supa).getByRole('article', { name: 'Nightly backup' });
    expect(within(backup).getByText('LIVE')).toBeInTheDocument();
    expect(within(backup).getByText('Daily at 02:40 UTC')).toBeInTheDocument();
    // Without a server nothing can be started or switched.
    expect(within(backup).getByRole('button', { name: 'Run now' })).toBeDisabled();
    expect(within(backup).getByRole('switch', { name: 'Nightly backup on' })).toBeDisabled();
    // Code refresh is its own function now (4h cadence), so it has a Run now button.
    const codes = within(supa).getByRole('article', { name: 'Code list refresh' });
    expect(within(codes).getByRole('button', { name: 'Run now' })).toBeDisabled();
    const routine = screen.getByRole('region', { name: 'Run by the external routine' });
    const leaks = within(routine).getByRole('article', { name: 'Leak scan' });
    // The routine is delivering: live, and it says itself when it runs each job next.
    expect(within(leaks).getByText('LIVE')).toBeInTheDocument();
    expect(within(leaks).getByText('External routine')).toBeInTheDocument();
    expect(within(leaks).getByText('Self-adjusting: the routine says when it runs next')).toBeInTheDocument();
    expect(within(leaks).queryByRole('button', { name: 'Run now' })).toBeNull();
    // The research routine is listed too, live (its routine delivers).
    const research = within(routine).getByRole('article', { name: 'Research routine' });
    expect(within(research).getByText('LIVE')).toBeInTheDocument();
    expect(within(research).getByText('Self-adjusting: the routine says when it runs next')).toBeInTheDocument();
    const log = screen.getByRole('region', { name: 'Run log' });
    expect(within(log).getByText('EXAMPLE')).toBeInTheDocument();
    expect(within(log).getAllByText(/^Example:/).length).toBeGreaterThan(0);
  });
});

describe('Owner console · Findings (this device only)', () => {
  it('shows example findings as a read-only log with filters', () => {
    renderConsole();
    fireEvent.click(screen.getByRole('tab', { name: /Findings/ }));
    expect(screen.getByText(/these findings are examples/)).toBeInTheDocument();
    const log = screen.getByRole('region', { name: /Log/ });
    expect(within(log).getByText(/Delivered by Leak scan · routine/)).toBeInTheDocument();
    expect(within(log).getByText(/Auto-approved/)).toBeInTheDocument();

    fireEvent.change(within(log).getByLabelText('Kind'), { target: { value: 'event' } });
    expect(within(log).queryByText(/new character in the next version/)).toBeNull();
    fireEvent.change(within(log).getByLabelText('Kind'), { target: { value: 'all' } });
    expect(within(log).getByText(/new character in the next version/)).toBeInTheDocument();
  });
});
