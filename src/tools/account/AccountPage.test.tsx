import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameContract } from '../../core/contract';
import { getPrefs, reloadPrefs, updatePrefs } from '../../core/data/prefs';
import { addLedgerEntry, addPulls, resetUserData, setRosterEntry } from '../../core/data/userData';
import type { PanelProps } from '../../core/registry/panels';
import { THEMES } from '../../core/theme/theme';
import { ExampleNotice, useSampleShown } from '../../core/ui';
import AccountPage, { resolveSection, sectionsFor } from './AccountPage';
import { DEVICE_KEY, EMPTY_PROFILE, type Profile } from './profile';
import { useProfile } from './useProfile';
import { setupSteps, type SetupFacts } from './SetupChecklist';

const game = {
  id: 'aa',
  short: 'AA',
  name: 'Game A',
  vent: '#A99BFF',
  terms: { rarity: { top: '5★', mid: '4★' }, gear: 'G', weapon: 'W', skill: 'S', character: 'C', endgame: [] },
  elements: [{ id: 'fire', label: 'Fire', color: '#E8664A' }],
  roles: [{ id: 'dps', label: 'DPS' }],
  currencies: [{ id: 'gem', name: 'Gem', perPull: 160 }],
  stamina: [{ id: 'power', name: 'Power', max: 240, minutesPerPoint: 6 }],
  servers: [{ id: 'eu', label: 'Europe', utcOffset: 1 }],
  reset: { hour: 4, weekday: 1 },
  bannerTypes: [{ id: 'char', label: 'Character banner', pullItem: 'gem', target: 'character', pity: { kind: 'hard-pity', hardPity: 90, baseRate: 0.006 } }],
  income: [{ id: 'aa.daily', source: 'daily', label: 'Daily task', currency: 'gem', amount: 60, schedule: { kind: 'per-reset' } }],
  data: {
    characters: async () => [
      { id: 'c1', name: 'Ash', rarity: 'top', element: 'fire', role: 'dps' },
      { id: 'c2', name: 'Birch', rarity: 'mid', element: 'fire', role: 'dps' },
    ],
    banners: async () => [],
    events: async () => [],
    versions: async () => [],
    backlog: async () => [],
    teams: async () => [],
    materials: async () => [],
  },
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
  goSection: vi.fn(),
  ...over,
});

const bar = () => within(screen.getByRole('navigation', { name: 'Account sections' }));
const barLabels = () => bar().getAllByRole('link').map((l) => l.firstChild?.textContent);

beforeEach(() => {
  localStorage.clear();
  reloadPrefs();
  resetUserData();
  document.documentElement.removeAttribute('data-theme');
});

describe('Account page: section bar', () => {
  it('lists the sections in order; Owner console only for owners; Sign out only when signed in', async () => {
    const { rerender } = render(<AccountPage {...props()} />);
    expect(barLabels()).toEqual(['Profile', 'Sync', 'Backup', 'Notifications', 'Game settings', 'Example data', 'Connected accounts', 'Guide', 'Layout', 'Theme', 'Sign in']);
    expect(bar().queryByRole('button', { name: /Sign out/ })).toBeNull();
    const onSignOut = vi.fn();
    rerender(<AccountPage {...props({ isOwner: true, account: { email: 'a@b.c', provider: 'discord', onSignOut } })} />);
    expect(barLabels()).toContain('Owner console');
    expect(barLabels()).not.toContain('Sign in');
    fireEvent.click(bar().getByRole('button', { name: /Sign out/ }));
    expect(onSignOut).toHaveBeenCalled();
    await screen.findByRole('region', { name: 'Your profile' });
  });

  it('a non-owner asking for the Owner console gets Profile; unknown sections too', () => {
    expect(resolveSection('owner', sectionsFor({ isOwner: false, signedIn: true }))).toBe('profile');
    expect(resolveSection('owner', sectionsFor({ isOwner: true, signedIn: true }))).toBe('owner');
    expect(resolveSection('nope', sectionsFor({ isOwner: true, signedIn: true }))).toBe('profile');
    expect(resolveSection(undefined, sectionsFor({ isOwner: false, signedIn: false }))).toBe('profile');
  });

  it('fixes the address when the asked-for section falls back to Profile, but waits for the owner check', () => {
    window.history.replaceState(null, '', '/account/owner');
    const { rerender } = render(<AccountPage {...props({ section: 'owner', ownerChecked: false })} />);
    expect(window.location.pathname).toBe('/account/owner');
    rerender(<AccountPage {...props({ section: 'owner', ownerChecked: true })} />);
    expect(window.location.pathname).toBe('/account');
    window.history.replaceState(null, '', '/account/nope');
    rerender(<AccountPage {...props({ section: 'nope' })} />);
    expect(window.location.pathname).toBe('/account');
  });

  it('clicking a section asks for its address; the open one is marked', async () => {
    const p = props({ section: 'sync' });
    render(<AccountPage {...p} />);
    expect(bar().getByRole('link', { name: /^Sync/ })).toHaveAttribute('aria-current', 'page');
    expect(bar().getByRole('link', { name: /^Theme/ })).toHaveAttribute('href', '/account/theme');
    fireEvent.click(bar().getByRole('link', { name: /^Theme/ }));
    expect(p.goSection).toHaveBeenCalledWith('theme', undefined);
    expect(screen.getByRole('heading', { name: 'Sync' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sync now' })).toBeDisabled(); // nothing to sync with in this mode
  });

  it('Layout opens Edit layout', () => {
    const p = props({ section: 'layout' });
    render(<AccountPage {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit layout for AA' }));
    expect(p.editLayout).toHaveBeenCalled();
  });
});

describe('Account page: settings sections', () => {
  it('Theme switches dark and light, saved in settings and applied to the page', () => {
    render(<AccountPage {...props({ section: 'theme' })} />);
    fireEvent.click(screen.getByRole('radio', { name: /^Light/ }));
    expect(getPrefs().theme).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.dataset.tone).toBe('light');
    fireEvent.click(screen.getByRole('radio', { name: /^Glacier/ }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.dataset.tone).toBe('dark');
  });

  it('Theme: every theme has a card with a live preview; picking one applies it at once and the section hint names it', () => {
    render(<AccountPage {...props({ section: 'theme' })} />);
    const radios = within(screen.getByRole('radiogroup', { name: 'Theme' })).getAllByRole('radio');
    expect(radios.map((r) => r.querySelector('[class*="rowTitle"]')?.textContent)).toEqual(THEMES.map((t) => t.name));
    for (const t of THEMES) {
      const radio = screen.getByRole('radio', { name: new RegExp(`^${t.name}`) });
      // The preview box is drawn with that theme's own tokens.
      expect(radio.querySelector(`[data-theme-preview="${t.id}"]`)).not.toBeNull();
      fireEvent.click(radio);
      expect(radio).toHaveAttribute('aria-checked', 'true');
      expect(getPrefs().theme).toBe(t.id);
      expect(document.documentElement.dataset.theme).toBe(t.id);
      expect(document.documentElement.dataset.tone).toBe(t.tone);
      expect(bar().getByRole('link', { name: /^Theme/ })).toHaveTextContent(t.name);
    }
  });

  it('Game settings: choose a server, switch a task off Today', () => {
    render(<AccountPage {...props({ section: 'game-settings', detail: 'aa' })} />);
    fireEvent.click(screen.getByRole('radio', { name: /Europe/ }));
    expect(getPrefs().servers.aa).toBe('eu');
    fireEvent.click(screen.getByRole('switch', { name: 'Daily task · daily' }));
    expect(getPrefs().hiddenTasks?.aa).toEqual(['income:aa.daily']);
  });

  it('Guide: the setup checklist ticks itself from real data and links to the place to do each step', () => {
    act(() => addLedgerEntry('aa', { at: '2026-10-01T10:00:00Z', currency: 'gem', kind: 'have', amount: 1600 }));
    const p = props({ section: 'guide' });
    render(<AccountPage {...p} />);
    const list = within(screen.getByLabelText('Setup checklist'));
    expect(list.getByText(/Enter your currency in the Bank log/)).toHaveTextContent('(done)');
    expect(list.getByText(/Choose your server/)).toHaveTextContent('(to do)');
    // This test copy has no server, so HoYoLAB and notifications can't be done here: they can be skipped.
    expect(list.getByText(/Connect HoYoLAB/)).toHaveTextContent('(not possible here)');
    expect(list.getByText(/Set up notifications/)).toHaveTextContent('(not possible here)');
    expect(list.getByText('1/8')).toBeInTheDocument();
    fireEvent.click(list.getByRole('button', { name: 'Skip: Connect HoYoLAB' }));
    expect(getPrefs().skippedSetup).toEqual(['hoyolab']);
    expect(list.getByText('2/8 · 1 skipped')).toBeInTheDocument();
    expect(list.getByText(/Connect HoYoLAB/)).toHaveTextContent('(skipped)');
    fireEvent.click(list.getByRole('button', { name: 'Undo skip: Connect HoYoLAB' }));
    expect(getPrefs().skippedSetup).toEqual([]);
    fireEvent.click(list.getByRole('button', { name: 'Open History' }));
    expect(p.open).toHaveBeenCalledWith('pulls', 'history');
    fireEvent.click(list.getByRole('button', { name: 'Choose server' }));
    expect(p.goSection).toHaveBeenCalledWith('game-settings', undefined);
    act(() => updatePrefs((x) => ({ ...x, servers: { aa: 'eu' } })));
    expect(list.getByText(/Choose your server/)).toHaveTextContent('(done)');
    fireEvent.click(screen.getByRole('button', { name: 'Open Calendar' }));
    expect(p.open).toHaveBeenCalledWith('calendar', undefined);
  });

  it('setup steps: HoYoLAB ticks for any linked account (server or device); notifications only for the calendar feed', () => {
    const linked = { ...game, accountLinks: [{ provider: 'hoyolab', supports: [], config: { gameBiz: 'x_global' } }] } as unknown as GameContract;
    const act0 = { games: [linked], open: vi.fn(), goTo: vi.fn() };
    const facts: SetupFacts = { accounts: [], feed: false, backup: false, server: true };
    const step = (id: string, f = facts) => setupSteps([linked], {}, {}, f, act0).find((s) => s.id === id);
    expect(step('hoyolab')?.done).toBe(false);
    const serverAccount = { id: 's1', label: 'Main', where: 'server' as const, hoyolabId: '1', games: [{ gameId: 'aa' }], autoCheckin: true, autoRedeem: false, hasRedeemLogin: false };
    expect(step('hoyolab', { ...facts, accounts: [serverAccount] })?.done).toBe(true);
    expect(step('notify')?.done).toBe(false);
    expect(step('notify', { ...facts, feed: true })?.done).toBe(true);
    expect(step('notify', { ...facts, server: false })?.unavailable).toMatch(/server/);
  });

  it('Backup: restore checks the file first, then only adds', async () => {
    render(<AccountPage {...props({ section: 'backup' })} />);
    expect(screen.getByRole('button', { name: 'Export my data' })).toBeInTheDocument();
    const input = screen.getByLabelText('Choose a backup file');
    fireEvent.change(input, { target: { files: [new File(['{"hello":1}'], 'x.json', { type: 'application/json' })] } });
    expect(await screen.findByText(/isn’t an HLITH backup/)).toBeInTheDocument();
    const good = { app: 'PROJECT-HLITH', kind: 'backup', version: 1, exportedAt: '2026-10-01T00:00:00Z', prefs: {}, userData: { version: 1, games: { aa: { ledger: [{ id: 'x', at: '2026-10-01T00:00:00Z', currency: 'gem', kind: 'have', amount: 5 }] } } }, extra: {} };
    fireEvent.change(input, { target: { files: [new File([JSON.stringify(good)], 'b.json')] } });
    expect(await screen.findByText(/AA: 1 bank entries/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add to my data' }));
    await waitFor(() => expect(screen.getByText(/Nothing was removed/)).toBeInTheDocument());
    expect(screen.getByText(/There is no account to delete/)).toBeInTheDocument();
  });

  it('Notifications: evening message choices are saved; the calendar feed is honest without a server', () => {
    render(<AccountPage {...props({ section: 'notifications' })} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Banners ending' }));
    expect(getPrefs().notify?.items.banners).toBe(false);
    expect(screen.getByText(/needs sign-in/)).toBeInTheDocument();
    // Can't be sent yet: said plainly, and no button to press that isn't there.
    expect(screen.getByRole('switch', { name: /preview only/ })).toBeInTheDocument();
    expect(screen.queryByText(/kept up to date by itself/)).toBeNull();
    expect(screen.queryByText(/Create my calendar link/)).toBeNull();
  });
});

describe('Account page: Profile', () => {
  it('starts honest: initial, default banner, every data card says No data yet with a way to add it', async () => {
    const p = props();
    render(<AccountPage {...p} />);
    const hero = await screen.findByRole('region', { name: 'Your profile' });
    expect(within(hero).getByRole('heading', { name: 'Your profile' })).toBeInTheDocument();
    expect(within(hero).getByText(/This device only · Saved on this device only/)).toBeInTheDocument();
    const pulls = screen.getByRole('region', { name: 'Pulls imported' });
    expect(pulls).toHaveTextContent('No data yet');
    fireEvent.click(within(pulls).getByRole('button', { name: 'Import pull history' }));
    expect(p.open).toHaveBeenCalledWith('pulls', 'history');
    fireEvent.click(within(screen.getByRole('region', { name: 'Characters owned' })).getByRole('button', { name: 'Open Roster' }));
    expect(p.open).toHaveBeenCalledWith('roster', 'characters');
    expect(screen.getByRole('region', { name: 'Games you play' })).toHaveTextContent('No server yet');
  });

  it('edit and save on this device: name, bio, a pinned character, a card switched off; it comes back after a reload', async () => {
    act(() => {
      setRosterEntry('aa', 'c1', { owned: true, wanted: false, dupes: 0 });
      setRosterEntry('aa', 'c2', { owned: false, wanted: true, dupes: 0 });
    });
    const view = render(<AccountPage {...props()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit profile' }));
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Mira' } });
    fireEvent.change(screen.getByLabelText(/^Bio/), { target: { value: 'Pulls only for the story.' } });
    const pins = within(await screen.findByRole('group', { name: 'Pin AA characters' }));
    expect(pins.queryByRole('button', { name: /Birch/ })).toBeNull(); // not owned: can't be pinned
    fireEvent.click(pins.getByRole('button', { name: /Ash/ }));
    fireEvent.click(screen.getByRole('switch', { name: 'Member since' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    expect(await screen.findByRole('heading', { name: 'Mira' })).toBeInTheDocument();
    expect(screen.getByText('Pulls only for the story.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Member since' })).toBeNull();
    const chars = screen.getByRole('region', { name: 'Characters owned' });
    expect(chars).toHaveTextContent('1owned');
    expect(within(chars).getByText('Ash')).toBeInTheDocument();
    const saved = JSON.parse(localStorage.getItem(DEVICE_KEY) ?? '{}');
    expect(saved).toMatchObject({ displayName: 'Mira', pinned: { aa: ['c1'] }, hiddenCards: ['member-since'] });
    view.unmount();
    render(<AccountPage {...props()} />);
    expect(await screen.findByRole('heading', { name: 'Mira' })).toBeInTheDocument();
  });

  it('a pinned character you no longer own shows dimmed with ✕ and can be unpinned', async () => {
    localStorage.setItem(DEVICE_KEY, JSON.stringify({ displayName: 'Mira', pinned: { aa: ['c1'] }, hiddenCards: [], updatedAt: 1 }));
    act(() => {
      setRosterEntry('aa', 'c1', { owned: false, wanted: false, dupes: 0 });
      setRosterEntry('aa', 'c2', { owned: true, wanted: false, dupes: 0 });
    });
    render(<AccountPage {...props()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit profile' }));
    const pins = within(await screen.findByRole('group', { name: 'Pin AA characters' }));
    expect(screen.getByText('1 / 6 pinned')).toBeInTheDocument();
    fireEvent.click(pins.getByRole('button', { name: 'Unpin Ash (not owned)' }));
    expect(screen.getByText('0 / 6 pinned')).toBeInTheDocument();
    expect(pins.queryByRole('button', { name: /not owned/ })).toBeNull();
  });

  it('the profile from before sign-in can be declined, and the device copy is kept', async () => {
    localStorage.setItem(DEVICE_KEY, JSON.stringify({ displayName: 'Old me', pinned: {}, hiddenCards: [], updatedAt: 1 }));
    const store = { mode: 'account' as const, load: async () => EMPTY_PROFILE, save: async (x: Profile) => x, imageUrl: () => null };
    const { result } = renderHook(() => useProfile(store));
    await waitFor(() => expect(result.current.deviceCopy?.displayName).toBe('Old me'));
    act(() => result.current.dismissDeviceCopy());
    expect(result.current.deviceCopy).toBeNull();
    expect(localStorage.getItem(DEVICE_KEY)).toContain('Old me');
    expect(renderHook(() => useProfile(store)).result.current.deviceCopy).toBeNull();
  });

  it('refuses a file that isn’t a picture or is over 2 MB, in plain words', async () => {
    render(<AccountPage {...props()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit profile' }));
    fireEvent.change(screen.getByLabelText('Choose picture'), { target: { files: [new File(['x'], 'notes.txt', { type: 'text/plain' })] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('isn’t a picture');
    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Choose banner'), { target: { files: [big] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('The limit is 2 MB');
  });

  it('shows pulls and current pity from imported history, and sign-in methods from the session', async () => {
    act(() => {
      addPulls('aa', [
        { id: '1', bannerType: 'char', itemId: 'c1', name: 'Ash', rarity: 'top', time: '2026-09-01T10:00:00Z', featured: false },
        { id: '2', bannerType: 'char', itemId: 'x', name: 'Thing', rarity: 'low', time: '2026-09-02T10:00:00Z' },
        { id: '3', bannerType: 'char', itemId: 'x', name: 'Thing', rarity: 'low', time: '2026-09-03T10:00:00Z' },
      ]);
    });
    // Signed in today with Google; Discord is linked too (it was the first method used).
    render(<AccountPage {...props({ account: { email: 'mira@x.y', provider: 'google', identities: ['discord', 'google'], createdAt: '2026-01-15T10:00:00Z', onSignOut: () => {} } })} />);
    const hero = await screen.findByRole('region', { name: 'Your profile' });
    expect(hero).toHaveTextContent('Signed in with Google ·');
    expect(screen.getByRole('region', { name: 'Pulls imported' })).toHaveTextContent('3pulls · 1 5★');
    const pity = screen.getByRole('region', { name: 'Current pity' });
    expect(pity).toHaveTextContent('Character banner2');
    expect(pity).toHaveTextContent('guaranteed'); // lost the 50/50 last time
    expect(screen.getByRole('region', { name: 'Sign-in methods' })).toHaveTextContent('DiscordGoogle');
    expect(screen.getByRole('region', { name: 'Member since' })).not.toHaveTextContent('No data yet');
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
