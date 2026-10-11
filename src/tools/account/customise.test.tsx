import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameContract } from '../../core/contract';
import { getPrefs, reloadPrefs, updatePrefs } from '../../core/data/prefs';
import type { PanelProps } from '../../core/registry/panels';
import { setDisplayFormat } from '../../core/time/displayFormat';
import AccountPage from './AccountPage';

const game = (id: string, name: string, vent: string) =>
  ({
    id,
    short: id.toUpperCase(),
    name,
    vent,
    servers: [{ id: 'eu', label: 'Europe', utcOffset: 1 }],
    data: { characters: async () => [], backlog: async () => [] },
  }) as unknown as GameContract;
const games = [game('aa', 'Game A', '#A99BFF'), game('bb', 'Game B', '#D4F23A')];

const props = (over: Partial<PanelProps> = {}): PanelProps => ({
  games,
  allGames: games,
  scope: 'all',
  servers: {},
  account: null,
  close: vi.fn(),
  open: vi.fn(),
  editLayout: vi.fn(),
  goSection: vi.fn(),
  section: 'customise',
  ...over,
});
const card = (name: string) => within(screen.getByRole('heading', { name }).closest('section') as HTMLElement);

beforeEach(() => {
  localStorage.clear();
  reloadPrefs();
  setDisplayFormat({});
});

describe('Account → Customise (T52b)', () => {
  it('is its own section, right after Profile', () => {
    render(<AccountPage {...props()} />);
    const labels = within(screen.getByRole('navigation', { name: 'Account sections' }))
      .getAllByRole('link')
      .map((l) => l.firstChild?.textContent);
    expect(labels.slice(0, 2)).toEqual(['Profile', 'Customise']);
    expect(screen.getByRole('region', { name: 'Preview' })).toBeInTheDocument();
  });

  it('time and format: a choice is saved, and "Reset this section" removes only that section', () => {
    updatePrefs((p) => ({ ...p, look: { accent: 'rose' } }));
    render(<AccountPage {...props()} />);
    fireEvent.click(within(screen.getByRole('tablist', { name: 'Clock' })).getByRole('tab', { name: '24-hour' }));
    fireEvent.click(within(screen.getByRole('tablist', { name: 'Dates' })).getByRole('tab', { name: 'Oct 11' }));
    expect(getPrefs().format).toEqual({ clock: '24h', date: 'mdy' });
    fireEvent.click(card('Time and format').getByRole('button', { name: 'Reset this section' }));
    expect(getPrefs().format).toBeUndefined();
    expect(getPrefs().look).toEqual({ accent: 'rose' }); // other sections untouched
  });

  it('game colours: only the tested choices, per game', () => {
    render(<AccountPage {...props()} />);
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'AA colour' })).getByRole('radio', { name: 'Sky' }));
    expect(getPrefs().gameVents).toEqual({ aa: '#8FD3F0' });
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'AA colour' })).getByRole('radio', { name: 'The game’s own' }));
    expect(getPrefs().gameVents).toEqual({});
  });

  it('theme schedule: day and night, then per game', () => {
    render(<AccountPage {...props()} />);
    fireEvent.click(within(screen.getByRole('tablist', { name: 'Theme schedule' })).getByRole('tab', { name: 'Day and night' }));
    expect(getPrefs().themeSchedule).toMatchObject({ mode: 'day-night', night: 'dark', dayFrom: '07:00', nightFrom: '19:00' });
    fireEvent.change(screen.getByLabelText(/By day/), { target: { value: 'candlelight' } });
    expect(getPrefs().themeSchedule).toMatchObject({ day: 'candlelight' });
    fireEvent.click(within(screen.getByRole('tablist', { name: 'Theme schedule' })).getByRole('tab', { name: 'One per game' }));
    expect(getPrefs().themeSchedule).toMatchObject({ mode: 'per-game', themes: { all: 'dark', aa: 'dark', bb: 'dark' } });
  });

  it('layout: start screen, default game and the tab a module opens on', () => {
    render(<AccountPage {...props()} />);
    fireEvent.change(screen.getByLabelText('Start screen'), { target: { value: 'pulls' } });
    fireEvent.change(screen.getByLabelText('Default game'), { target: { value: 'bb' } });
    fireEvent.change(screen.getByLabelText('Pulls opens on'), { target: { value: 'history' } });
    expect(getPrefs()).toMatchObject({ startModule: 'pulls', defaultScope: 'bb', startTabs: { pulls: 'history' } });
    fireEvent.click(card('Layout').getByRole('button', { name: 'Reset this section' }));
    expect(getPrefs().startModule).toBeUndefined();
    expect(getPrefs().defaultScope).toBeUndefined();
  });
});
