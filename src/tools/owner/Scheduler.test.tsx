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
    // Code refresh lives inside the HoYoLAB job: no button of its own.
    const codes = within(supa).getByRole('article', { name: 'Code list refresh' });
    expect(within(codes).queryByRole('button', { name: 'Run now' })).toBeNull();
    const routine = screen.getByRole('region', { name: 'Run by the external routine' });
    const leaks = within(routine).getByRole('article', { name: 'Leak scan' });
    // The routine is delivering: live, and it says itself when it runs each job next.
    expect(within(leaks).getByText('LIVE')).toBeInTheDocument();
    expect(within(leaks).getByText('External routine')).toBeInTheDocument();
    expect(within(leaks).getByText('Self-adjusting: the routine says when it runs next')).toBeInTheDocument();
    expect(within(leaks).queryByRole('button', { name: 'Run now' })).toBeNull();
    // The research routine is listed too, as a frame until its routine delivers.
    const research = within(routine).getByRole('article', { name: 'Research routine' });
    expect(within(research).getByText('FRAME')).toBeInTheDocument();
    expect(within(research).getByText('Self-adjusting: the routine says when it runs next')).toBeInTheDocument();
    const log = screen.getByRole('region', { name: 'Run log' });
    expect(within(log).getByText('EXAMPLE')).toBeInTheDocument();
    expect(within(log).getAllByText(/^Example:/).length).toBeGreaterThan(0);
  });
});

describe('Owner console · Findings (this device only)', () => {
  it('lists example findings with who delivered them, filters, and approves / dismisses', async () => {
    renderConsole();
    fireEvent.click(screen.getByRole('tab', { name: /Findings/ }));
    expect(screen.getByText(/these findings are examples/)).toBeInTheDocument();
    const inbox = screen.getByRole('region', { name: /Inbox/ });
    expect(within(inbox).getByText('2 new')).toBeInTheDocument();
    expect(within(inbox).getByText(/Delivered by Leak scan · routine/)).toBeInTheDocument();
    // A leak always shows as unverified with its source.
    expect(within(inbox).getByText('? UNVERIFIED')).toBeInTheDocument();

    fireEvent.change(within(inbox).getByLabelText('Kind'), { target: { value: 'event' } });
    expect(within(inbox).queryByText(/new character in the next version/)).toBeNull();
    fireEvent.change(within(inbox).getByLabelText('Kind'), { target: { value: 'all' } });

    fireEvent.click(within(inbox).getByRole('button', { name: /Approve: Example: a new character/ }));
    expect(await within(inbox).findByText('1 new')).toBeInTheDocument();
    fireEvent.click(within(inbox).getByRole('button', { name: /Dismiss: Example: a login event/ }));
    expect(await within(inbox).findByText('0 new')).toBeInTheDocument();
    expect(within(inbox).getByText('Nothing matches these filters.')).toBeInTheDocument();
    // Nothing is removed: dismissed findings stay under Dismissed.
    fireEvent.change(within(inbox).getByLabelText('Status'), { target: { value: 'dismissed' } });
    expect(within(inbox).getByText(/a login event starting next week/)).toBeInTheDocument();
    // …and can be moved back to the inbox.
    fireEvent.click(within(inbox).getByRole('button', { name: /Move back to new: Example: a login event/ }));
    expect(await within(inbox).findByText('1 new')).toBeInTheDocument();
  });
});
