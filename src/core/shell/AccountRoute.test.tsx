import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { GameContract } from '../contract';
import { reloadPrefs } from '../data/prefs';
import { registerPanel, type PanelProps } from '../registry/panels';
import { accountPath, parseAccountRoute } from './route';
import { Shell } from './Shell';

// A stand-in Account page: the shell opens whatever is registered as 'account' (core never imports tools/).
function FakeAccount(p: PanelProps) {
  return (
    <div>
      <p>section:{p.section ?? 'profile'}</p>
      <p>detail:{p.detail ?? '-'}</p>
      <button type="button" onClick={() => p.goSection?.('theme')}>
        go theme
      </button>
      <button type="button" onClick={() => p.open('pulls', 'history')}>
        go pulls
      </button>
    </div>
  );
}
registerPanel('account', async () => ({ default: FakeAccount }));

const game = {
  id: 'aa',
  short: 'AA',
  name: 'Game A',
  vent: '#A99BFF',
  terms: { rarity: { top: '5★', mid: '4★' }, gear: 'G', weapon: 'W', skill: 'S', character: 'C', endgame: [] },
  elements: [],
  roles: [],
  currencies: [],
  teamSize: 4,
  stamina: [],
  servers: [{ id: 'eu', label: 'Europe', utcOffset: 1 }],
  reset: { hour: 4, weekday: 1 },
  modules: ['today', 'pulls'],
  bannerTypes: [],
  income: [],
  historyImporters: [],
  data: { characters: async () => [], banners: async () => [], events: async () => [], backlog: async () => [], materials: async () => [], teams: async () => [], versions: async () => [] },
  rules: {},
  sources: [],
} as unknown as GameContract;

/** The browser's back button (jsdom fires popstate a moment later). */
const back = async () => {
  await act(async () => {
    window.history.back();
    await new Promise((r) => setTimeout(r, 30));
  });
};

beforeEach(() => {
  localStorage.clear();
  reloadPrefs();
  window.history.replaceState(null, '', '/');
});

describe('Account routes', () => {
  it('parses /account, /account/<section> and /account/<section>/<detail>', () => {
    expect(parseAccountRoute('/account')).toEqual({ section: null, detail: null });
    expect(parseAccountRoute('/account/sync')).toEqual({ section: 'sync', detail: null });
    expect(parseAccountRoute('/account/game-settings/hsr')).toEqual({ section: 'game-settings', detail: 'hsr' });
    expect(parseAccountRoute('/hsr/today')).toBeNull();
    expect(accountPath()).toBe('/account');
    expect(accountPath('game-settings', 'zzz')).toBe('/account/game-settings/zzz');
  });

  it('a direct address opens that section, with the sidebar still there', async () => {
    window.history.replaceState(null, '', '/account/game-settings/aa');
    render(<Shell games={[game]} />);
    expect(await screen.findByText('section:game-settings')).toBeInTheDocument();
    expect(screen.getByText('detail:aa')).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Account' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/account/game-settings/aa'); // not bounced back to a module
  });

  it('sidebar Account → a section → back → back returns to the module you were on', async () => {
    window.history.replaceState(null, '', '/aa/pulls');
    render(<Shell games={[game]} />);
    fireEvent.click(within(screen.getByRole('complementary', { name: 'Main' })).getByRole('button', { name: /Account/ }));
    expect(await screen.findByText('section:profile')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'go theme' }));
    expect(window.location.pathname).toBe('/account/theme');
    expect(screen.getByText('section:theme')).toBeInTheDocument();
    await back();
    expect(window.location.pathname).toBe('/account');
    expect(screen.getByText('section:profile')).toBeInTheDocument();
    await back();
    expect(window.location.pathname).toBe('/aa/pulls');
    expect(screen.getByRole('heading', { level: 1, name: 'Pulls' })).toBeInTheDocument();
  });

  it('opening a module from the page leaves it', async () => {
    window.history.replaceState(null, '', '/account');
    render(<Shell games={[game]} />);
    fireEvent.click(await screen.findByRole('button', { name: 'go pulls' }));
    // The tab it asked for is part of the address.
    expect(window.location.pathname).toBe('/aa/pulls/history');
  });

  it('a tab in the address opens that tab, and picking another tab updates the address', async () => {
    window.history.replaceState(null, '', '/aa/pulls/log');
    render(<Shell games={[game]} />);
    expect(await screen.findByRole('tab', { name: 'Bank log' })).toHaveAttribute('aria-selected', 'true');
    expect(window.location.pathname).toBe('/aa/pulls/log');
    fireEvent.click(screen.getByRole('tab', { name: 'Planner' }));
    expect(window.location.pathname).toBe('/aa/pulls');
    fireEvent.click(screen.getByRole('tab', { name: 'History' }));
    expect(window.location.pathname).toBe('/aa/pulls/history');
    // The browser's back button returns to the tab before.
    await back();
    expect(screen.getByRole('tab', { name: 'Planner' })).toHaveAttribute('aria-selected', 'true');
  });

  it('an unknown tab in the address falls back to the first tab', async () => {
    window.history.replaceState(null, '', '/aa/pulls/nope');
    render(<Shell games={[game]} />);
    expect(await screen.findByRole('tab', { name: 'Planner' })).toHaveAttribute('aria-selected', 'true');
    expect(window.location.pathname).toBe('/aa/pulls');
  });
});
