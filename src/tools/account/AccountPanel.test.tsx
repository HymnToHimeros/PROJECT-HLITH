import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameContract } from '../../core/contract';
import { getPrefs, reloadPrefs, updatePrefs } from '../../core/data/prefs';
import { addLedgerEntry, resetUserData } from '../../core/data/userData';
import type { PanelProps } from '../../core/registry/panels';
import { ExampleNotice, useSampleShown } from '../../core/ui';
import AccountPanel from './AccountPanel';

const game = {
  id: 'aa',
  short: 'AA',
  name: 'Game A',
  vent: '#A99BFF',
  currencies: [{ id: 'gem', name: 'Gem', perPull: 160 }],
  stamina: [{ id: 'power', name: 'Power', max: 240, minutesPerPoint: 6 }],
  servers: [{ id: 'eu', label: 'Europe', utcOffset: 1 }],
  reset: { hour: 4, weekday: 1 },
  bannerTypes: [],
  income: [{ id: 'aa.daily', source: 'daily', label: 'Daily task', currency: 'gem', amount: 60, schedule: { kind: 'per-reset' } }],
  data: { characters: async () => [], banners: async () => [], events: async () => [], versions: async () => [], backlog: async () => [] },
} as unknown as GameContract;

const props = (over: Partial<PanelProps> = {}): PanelProps => ({
  games: [game],
  allGames: [game],
  scope: 'aa',
  servers: {},
  account: null,
  close: vi.fn(),
  open: vi.fn(),
  editLayout: vi.fn(),
  ...over,
});

beforeEach(() => {
  localStorage.clear();
  reloadPrefs();
  resetUserData();
  document.documentElement.removeAttribute('data-theme');
});

describe('Account sheet', () => {
  it('has the design’s rows, in order; Owner console only for owners', () => {
    const { rerender } = render(<AccountPanel {...props()} />);
    const rows = screen.getAllByRole('button').map((b) => b.querySelector('span > span')?.textContent).filter(Boolean);
    expect(rows).toEqual(['Sync', 'Backup', 'Notifications', 'Game settings', 'Guide', 'Layout settings', 'Theme', 'Sign in']);
    expect(screen.getByText('This device only · 1 game')).toBeInTheDocument();
    rerender(<AccountPanel {...props({ isOwner: true, openOwnerConsole: () => {}, account: { email: 'a@b.c', provider: 'discord', onSignOut: () => {} } })} />);
    expect(screen.getByText('Owner console')).toBeInTheDocument();
    expect(screen.getByText('Sign out')).toBeInTheDocument();
    expect(screen.getByText('Signed in with Discord · 1 game')).toBeInTheDocument();
  });

  it('Layout settings opens Edit layout; a sub-page has a back arrow', () => {
    const p = props();
    render(<AccountPanel {...p} />);
    fireEvent.click(screen.getByText('Layout settings'));
    expect(p.editLayout).toHaveBeenCalled();
    fireEvent.click(screen.getByText('Sync'));
    expect(screen.getByRole('heading', { name: 'Sync' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sync now' })).toBeDisabled(); // nothing to sync with in this mode
    fireEvent.click(screen.getByRole('button', { name: 'Back to Account' }));
    expect(screen.getByRole('heading', { name: 'Account' })).toBeInTheDocument();
  });

  it('Theme switches dark and light, saved in settings and applied to the page', () => {
    render(<AccountPanel {...props({ startPage: 'theme' })} />);
    fireEvent.click(screen.getByRole('radio', { name: /Light/ }));
    expect(getPrefs().theme).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    fireEvent.click(screen.getByRole('radio', { name: /Dark/ }));
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('Game settings: choose a server, switch a task off Today', () => {
    render(<AccountPanel {...props({ startPage: 'game-settings' })} />);
    fireEvent.click(screen.getByRole('radio', { name: /Europe/ }));
    expect(getPrefs().servers.aa).toBe('eu');
    fireEvent.click(screen.getByRole('switch', { name: 'Daily task · daily' }));
    expect(getPrefs().hiddenTasks?.aa).toEqual(['income:aa.daily']);
  });

  it('Guide: the setup checklist ticks itself from real data and links to the place to do each step', () => {
    act(() => addLedgerEntry('aa', { at: '2026-10-01T10:00:00Z', currency: 'gem', kind: 'have', amount: 1600 }));
    const p = props({ startPage: 'guide' });
    render(<AccountPanel {...p} />);
    const list = within(screen.getByLabelText('Setup checklist'));
    expect(list.getByText(/Enter your currency in the Bank log/)).toHaveTextContent('(done)');
    expect(list.getByText(/Choose your server/)).toHaveTextContent('(to do)');
    expect(list.getByText(/Connect HoYoLAB/)).toHaveTextContent('(not available yet)');
    fireEvent.click(list.getByRole('button', { name: 'Open History' }));
    expect(p.open).toHaveBeenCalledWith('pulls', 'history');
    act(() => updatePrefs((x) => ({ ...x, servers: { aa: 'eu' } })));
    expect(list.getByText(/Choose your server/)).toHaveTextContent('(done)');
    // The guide opens each module.
    fireEvent.click(screen.getByRole('button', { name: 'Open Calendar' }));
    expect(p.open).toHaveBeenCalledWith('calendar', undefined);
  });

  it('Backup: restore checks the file first, then only adds', async () => {
    render(<AccountPanel {...props({ startPage: 'backup' })} />);
    expect(screen.getByRole('button', { name: 'Export my data' })).toBeInTheDocument();
    const input = screen.getByLabelText('Choose a backup file');
    const bad = new File(['{"hello":1}'], 'x.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [bad] } });
    expect(await screen.findByText(/isn’t an HLITH backup/)).toBeInTheDocument();
    const good = { app: 'PROJECT-HLITH', kind: 'backup', version: 1, exportedAt: '2026-10-01T00:00:00Z', prefs: {}, userData: { version: 1, games: { aa: { ledger: [{ id: 'x', at: '2026-10-01T00:00:00Z', currency: 'gem', kind: 'have', amount: 5 }] } } }, extra: {} };
    fireEvent.change(input, { target: { files: [new File([JSON.stringify(good)], 'b.json')] } });
    expect(await screen.findByText(/AA: 1 bank entries/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add to my data' }));
    await waitFor(() => expect(screen.getByText(/Nothing was removed/)).toBeInTheDocument());
    // Delete my account explains itself in "this device only" mode.
    expect(screen.getByText(/There is no account to delete/)).toBeInTheDocument();
  });

  it('Notifications: evening message choices are saved; the calendar feed is honest without a server', () => {
    render(<AccountPanel {...props({ startPage: 'notifications' })} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Banners ending' }));
    expect(getPrefs().notify?.items.banners).toBe(false);
    expect(screen.getByText(/needs sign-in/)).toBeInTheDocument();
    expect(screen.getByText(/push keys/)).toBeInTheDocument();
  });
});

describe('SAMPLE DATA marker', () => {
  function Probe() {
    return <span>{useSampleShown() ? 'sample on' : 'sample off'}</span>;
  }
  it('is on while an example notice is on screen', () => {
    const { rerender } = render(
      <>
        <Probe />
        <ExampleNotice>Stand-ins.</ExampleNotice>
      </>,
    );
    expect(screen.getByText('sample on')).toBeInTheDocument();
    rerender(<Probe />);
    expect(screen.getByText('sample off')).toBeInTheDocument();
  });
});
