import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameContract } from '../contract';
import { getPrefs, reloadPrefs } from '../data/prefs';
import { registerIdentity, resetIdentity } from '../registry/identity';
import { setTheme } from '../theme/theme';
import { resetStartScreen, Shell } from './Shell';
import { updatePrefs } from '../data/prefs';

const base = (over: Partial<GameContract>): GameContract => ({
  id: 'aa',
  short: 'AA',
  name: 'Game A',
  vent: '#A99BFF',
  terms: { rarity: { top: '5★', mid: '4★' }, gear: 'G', weapon: 'W', skill: 'S', character: 'C', endgame: [] },
  elements: [],
  roles: [],
  currencies: [{ id: 'p', name: 'P', perPull: 160 }],
  teamSize: 4,
  stamina: [],
  servers: [
    { id: 'eu', label: 'Europe', utcOffset: 1 },
    { id: 'us', label: 'America', utcOffset: -5 },
  ],
  reset: { hour: 4, weekday: 1 },
  modules: ['today', 'events', 'calendar', 'backlog', 'pulls', 'banners', 'roster', 'farm', 'intel'],
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
const B = base({ id: 'bb', short: 'BB', name: 'Game B', vent: '#D4F23A', modules: ['today', 'pulls', 'roster'] });

const sideNav = () => within(screen.getByRole('navigation', { name: 'Modules' }));
const navLabels = () => sideNav().getAllByRole('link').map((a) => a.lastChild?.textContent);

/** The phone layout (top bar, bottom bar) is drawn below 820 px; tests ask for it explicitly. */
function phoneMode() {
  const before = window.matchMedia;
  window.matchMedia = ((query: string) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
  return () => {
    window.matchMedia = before;
  };
}

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

  it('switching game shows that game’s modules in the shared order and tints with its vent', () => {
    const { container } = render(<Shell games={[A, B]} />);
    fireEvent.click(screen.getByRole('button', { name: 'BB' }));
    expect(navLabels()).toEqual(['Today', 'Pulls', 'Roster']);
    expect(window.location.pathname).toBe('/bb/today');
    expect((container.firstChild as HTMLElement).style.getPropertyValue('--vent')).toBe('#D4F23A');
  });

  it('switching games keeps the page you are on; if the other game lacks it, opens the page you last used there', () => {
    render(<Shell games={[A, B]} />);
    fireEvent.click(screen.getByRole('button', { name: 'AA' }));
    fireEvent.click(sideNav().getByRole('link', { name: /Pulls/ }));
    fireEvent.click(screen.getByRole('button', { name: 'BB' }));
    expect(window.location.pathname).toBe('/bb/pulls');
    fireEvent.click(screen.getByRole('button', { name: 'AA' }));
    fireEvent.click(sideNav().getByRole('link', { name: /Farm/ }));
    fireEvent.click(screen.getByRole('button', { name: 'BB' }));
    expect(window.location.pathname).toBe('/bb/pulls'); // BB has no Farm: back to where you were in BB
  });

  it('Pulls shows its four tabs', () => {
    window.history.replaceState(null, '', '/aa/pulls');
    render(<Shell games={[A, B]} />);
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent);
    expect(tabs).toEqual(['Planner', 'Calculator', 'Bank log', 'History']);
  });

  it('phone bar holds the first four modules plus More', () => {
    const restore = phoneMode();
    window.history.replaceState(null, '', '/aa/today');
    render(<Shell games={[A, B]} />);
    const bar = within(screen.getByRole('navigation', { name: 'Modules (phone)' }));
    expect(bar.getAllByRole('button').map((b) => b.lastChild?.textContent)).toEqual(['Today', 'Pulls', 'Roster', 'Calendar', 'More']);
    fireEvent.click(bar.getByRole('button', { name: /More/ }));
    const more = within(screen.getByRole('dialog', { name: 'More' }));
    expect(more.getAllByRole('link').map((a) => a.lastChild?.textContent)).toEqual(['Events', 'Banners', 'Backlog', 'Farm', 'Intel']);
    restore();
  });

  it('phone top bar: game switcher, sync dot, Account; the ASK button opens the Assistant', () => {
    const restore = phoneMode();
    render(<Shell games={[A, B]} />);
    expect(screen.queryByRole('complementary', { name: 'Main' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'BB' }));
    expect(window.location.pathname).toBe('/bb/today');
    fireEvent.click(screen.getByRole('button', { name: 'Assistant' }));
    expect(screen.getByRole('dialog', { name: 'Assistant' })).toBeInTheDocument();
    restore();
  });

  it('a 500 ms press on a phone tab opens Edit layout', () => {
    const restore = phoneMode();
    vi.useFakeTimers();
    render(<Shell games={[A, B]} />);
    const bar = within(screen.getByRole('navigation', { name: 'Modules (phone)' }));
    fireEvent.pointerDown(bar.getAllByRole('button')[1] as HTMLElement);
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByRole('dialog', { name: /Edit layout/ })).toBeInTheDocument();
    vi.useRealTimers();
    restore();
  });

  it('PC sidebar: MODULES with Edit layout beside it, sync line, Assistant and Account', () => {
    render(<Shell games={[A, B]} />);
    const side = within(screen.getByRole('complementary', { name: 'Main' }));
    expect(side.getByText('MODULES')).toBeInTheDocument();
    expect(side.getByRole('button', { name: 'Edit layout' })).toBeInTheDocument();
    expect(side.getByRole('status')).toHaveTextContent('Saved on this device only');
    fireEvent.click(side.getByRole('button', { name: /Account/ }));
    expect(window.location.pathname).toBe('/account');
    expect(screen.getByRole('heading', { level: 1, name: 'Account' })).toBeInTheDocument();
    expect(side.getByRole('button', { name: /Account/ })).toHaveAttribute('aria-current', 'page');
  });

  it('profile card without a profile: a plain figure, “Your profile”, and the theme’s own glow as banner', () => {
    render(<Shell games={[A, B]} />);
    const card = within(screen.getByRole('complementary', { name: 'Main' })).getByRole('button', { name: /Account/ });
    expect(card).toHaveTextContent('Your profile');
    expect(card).toHaveAttribute('data-banner', 'theme');
    expect(card.querySelector('img')).toBeNull();
    expect(card.querySelector('svg')).not.toBeNull();
  });

  it('profile card signed in without a picture: initials from the email name', () => {
    render(<Shell games={[A, B]} account={{ email: 'mira.vale@example.com', onSignOut: () => {} }} />);
    const card = within(screen.getByRole('complementary', { name: 'Main' })).getByRole('button', { name: /Account/ });
    expect(card).toHaveTextContent('mira.vale');
    expect(card).toHaveTextContent(/^M/);
  });

  it('profile card with a picture and banner from the profile; a broken picture falls back to initials', () => {
    registerIdentity(() => ({ name: 'Rook Ash', avatarUrl: 'https://x.test/a.png', bannerUrl: 'https://x.test/b.jpg' }));
    try {
      render(<Shell games={[A, B]} />);
      const card = within(screen.getByRole('complementary', { name: 'Main' })).getByRole('button', { name: /Rook Ash.*Account/ });
      expect(card).toHaveAttribute('data-banner', 'picture');
      const imgs = [...card.querySelectorAll('img')].map((i) => i.getAttribute('src'));
      expect(imgs).toEqual(['https://x.test/b.jpg', 'https://x.test/a.png']);
      fireEvent.error(card.querySelectorAll('img')[1] as HTMLImageElement);
      expect(card).toHaveTextContent('RA');
      fireEvent.error(card.querySelector('img') as HTMLImageElement);
      expect(card).toHaveAttribute('data-banner', 'theme');
    } finally {
      resetIdentity();
    }
  });

  it('draws the theme’s background art behind the page, hidden from screen readers', () => {
    const { container } = render(<Shell games={[A, B]} />);
    const art = container.querySelector('[data-art]');
    expect(art).toHaveAttribute('data-art', 'dark');
    expect(art).toHaveAttribute('aria-hidden', 'true');
    act(() => setTheme('crimson'));
    expect(container.querySelector('[data-art]')).toHaveAttribute('data-art', 'crimson');
    expect(document.documentElement.dataset.theme).toBe('crimson');
    act(() => setTheme('dark'));
  });
});

describe('Edit layout', () => {
  const openEdit = () => fireEvent.click(screen.getByRole('button', { name: 'Edit layout' }));

  it('hide removes a module from the sidebar, Restore brings it back, and it is saved', () => {
    window.history.replaceState(null, '', '/aa/today');
    render(<Shell games={[A, B]} />);
    openEdit();
    const dialog = within(screen.getByRole('dialog'));
    fireEvent.click(dialog.getByRole('button', { name: 'Hide Intel' }));
    expect(navLabels()).not.toContain('Intel');
    expect(dialog.getByText('HIDDEN · STILL IN THIS GAME')).toBeInTheDocument();
    expect(getPrefs().layouts.shared?.hidden).toEqual(['intel']); // one layout for every game
    fireEvent.click(dialog.getByRole('button', { name: 'Restore Intel' }));
    expect(navLabels()).toContain('Intel');
  });

  it('arrow keys on the handle reorder, Reset to default undoes it, and Undo reset brings it back', () => {
    window.history.replaceState(null, '', '/aa/today');
    render(<Shell games={[A, B]} />);
    openEdit();
    const dialog = within(screen.getByRole('dialog'));
    fireEvent.keyDown(dialog.getByRole('button', { name: 'Move Pulls' }), { key: 'ArrowUp' });
    expect(navLabels().slice(0, 2)).toEqual(['Pulls', 'Today']);
    fireEvent.click(dialog.getByRole('button', { name: 'Reset to default' }));
    expect(navLabels().slice(0, 2)).toEqual(['Today', 'Pulls']);
    fireEvent.click(dialog.getByRole('button', { name: 'Undo reset' }));
    expect(navLabels().slice(0, 2)).toEqual(['Pulls', 'Today']);
  });

  it('says there is one order for every game, and All games names its hidden list honestly', () => {
    window.history.replaceState(null, '', '/all/today');
    render(<Shell games={[A, B]} />);
    openEdit();
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByText(/One order for every game\./)).toBeInTheDocument();
    expect(dialog.queryByText(/this view only/)).toBeNull();
    fireEvent.click(dialog.getByRole('button', { name: 'Hide Intel' }));
    expect(dialog.getByText('HIDDEN · STILL IN YOUR GAMES')).toBeInTheDocument();
  });

  it('never lets the last visible module be hidden', () => {
    window.history.replaceState(null, '', '/bb/roster');
    render(<Shell games={[A, B]} />);
    openEdit();
    const dialog = within(screen.getByRole('dialog'));
    fireEvent.click(dialog.getAllByRole('button', { name: /^Hide / })[0] as HTMLElement);
    fireEvent.click(dialog.getAllByRole('button', { name: /^Hide / })[0] as HTMLElement);
    expect(dialog.queryAllByRole('button', { name: /^Hide / })).toHaveLength(0);
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

const openEditFor = () => fireEvent.click(screen.getByRole('button', { name: 'Edit layout' }));

describe('Hidden modules', () => {
  it('a hidden module still opens from a link, with a note and Restore', () => {
    window.history.replaceState(null, '', '/aa/today');
    render(<Shell games={[A, B]} />);
    openEditFor();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Hide Farm' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Done' }));
    act(() => {
      window.history.pushState(null, '', '/aa/farm');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Farm');
    expect(screen.getByText(/Farm is hidden in your layout/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Restore Farm' }));
    expect(navLabels()).toContain('Farm');
    expect(screen.queryByText(/Farm is hidden in your layout/)).toBeNull();
  });
});

describe('Server picker', () => {
  it('each option shows its daily reset in your time; picking one saves it', () => {
    window.history.replaceState(null, '', '/aa/today');
    render(<Shell games={[A, B]} />);
    fireEvent.click(screen.getByRole('button', { name: /Account/ }));
    const group = within(screen.getByRole('radiogroup', { name: 'AA server' }));
    const europe = group.getByRole('radio', { name: /Europe, UTC\+1 · daily reset at .+ your time/ });
    expect(europe).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(europe);
    expect(getPrefs().servers.aa).toBe('eu');
    expect(europe).toHaveAttribute('aria-checked', 'true');
  });
});

describe('Your games', () => {
  it('turning a game off removes it from the switcher but never the last one', () => {
    render(<Shell games={[A, B]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Choose which games show' }));
    expect(screen.getByRole('dialog', { name: 'Choose which games show' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: 'Game B' }));
    expect(screen.queryByRole('button', { name: 'BB' })).toBeNull();
    expect(screen.getByRole('switch', { name: 'Game A' })).toBeDisabled();
  });
});

describe('Shell: Customise → Layout and Game colours (T52b)', () => {
  it('opens on your default game, your start screen and the tab you chose', () => {
    resetStartScreen();
    updatePrefs((p) => ({ ...p, defaultScope: 'bb', startModule: 'pulls', startTabs: { pulls: 'history' } }));
    render(<Shell games={[A, B]} />);
    expect(window.location.pathname).toBe('/bb/pulls/history');
  });

  it('a link that names a screen still wins over the start screen', () => {
    resetStartScreen();
    updatePrefs((p) => ({ ...p, startModule: 'pulls' }));
    window.history.replaceState(null, '', '/aa/roster');
    render(<Shell games={[A, B]} />);
    expect(window.location.pathname).toMatch(/^\/aa\/roster/);
  });

  it('a game in your own colour tints with that colour; an untested colour is ignored', () => {
    updatePrefs((p) => ({ ...p, gameVents: { aa: '#8FD3F0', bb: '#ff0000' } }));
    window.history.replaceState(null, '', '/aa/today');
    const { container } = render(<Shell games={[A, B]} />);
    expect(container.innerHTML).toContain('#8FD3F0');
    expect(container.innerHTML).not.toContain('#ff0000');
  });
});

describe('Shell: your background picture (T52d)', () => {
  it('shows this page’s picture over the theme’s art, else every page’s', async () => {
    localStorage.setItem('hlith.background.all', 'data:image/jpeg;base64,QUxM');
    localStorage.setItem('hlith.background.page:pulls', 'data:image/jpeg;base64,UFVMTFM=');
    updatePrefs((p) => ({ ...p, backgrounds: { all: { file: 'device', strength: 0.2, version: 1 }, 'page:pulls': { file: 'device', strength: 0.1, version: 1 } } }));
    window.history.replaceState(null, '', '/aa/today');
    const { container, unmount } = render(<Shell games={[A, B]} />);
    const pic = () => container.querySelector('[data-art="yours"] img');
    await waitFor(() => expect(pic()?.getAttribute('src')).toBe('data:image/jpeg;base64,QUxM'));
    unmount();
    window.history.replaceState(null, '', '/aa/pulls');
    const again = render(<Shell games={[A, B]} />);
    await waitFor(() => expect(again.container.querySelector('[data-art="yours"] img')?.getAttribute('src')).toBe('data:image/jpeg;base64,UFVMTFM='));
  });
});
