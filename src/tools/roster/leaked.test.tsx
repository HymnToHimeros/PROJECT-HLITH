import { fireEvent, render, screen, within } from '@testing-library/react';
import { reloadPrefs } from '../../core/data/prefs';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Character, GameContract } from '../../core/contract';
import { gameData, resetUserData } from '../../core/data/userData';
import { resetHideLeaks, setHideLeaks } from '../banners/leakPref';
import { resetShowLeaked } from './leakedPref';
import RosterScreen from './RosterScreen';

const released: Character[] = [
  { id: 'c1', name: 'Older Star', rarity: 'top', element: 'fire', role: 'attack', releasedAt: '2025-01-01' },
  { id: 'c2', name: 'Newest Star', rarity: 'top', element: 'fire', role: 'attack', releasedAt: '2026-09-01' },
  { id: 'c3', name: 'Zed Undated', rarity: 'mid', element: 'fire', role: 'attack' },
  { id: 'c4', name: 'Abe Undated', rarity: 'mid', element: 'fire', role: 'attack' },
];
// A made-up leak: no leaked character exists in the real lists yet.
const leak: Character = { id: 'x1', name: 'Rumoured Hero', rarity: 'top', element: 'fire', role: 'attack', leak: { source: 'test leak site' } };

const game = (characters: Character[]): GameContract =>
  ({
    id: 'aa',
    short: 'AA',
    name: 'Game A',
    vent: '#A99BFF',
    terms: { rarity: { top: '5★', mid: '4★' }, gear: 'Relics', weapon: 'Cone', skill: 'Skills', character: 'Character', endgame: [] },
    elements: [{ id: 'fire', label: 'Fire', color: '#E8664A' }],
    roles: [{ id: 'attack', label: 'Attack' }],
    dupes: { prefix: 'E', name: 'Eidolon', max: 6 },
    currencies: [],
    teamSize: 4,
    stamina: [],
    servers: [],
    reset: { hour: 4, weekday: 1 },
    modules: ['roster'],
    bannerTypes: [],
    income: [],
    historyImporters: [],
    data: { characters: async () => characters, banners: async () => [], events: async () => [], backlog: async () => [], materials: async () => [], teams: async () => [], versions: async () => [] },
    rules: {},
    sources: [],
  }) as unknown as GameContract;

const show = async (characters: Character[]) => {
  render(<RosterScreen games={[game(characters)]} scope="aa" tab="characters" servers={{}} openTab={() => {}} open={() => {}} openAccount={() => {}} />);
  return screen.findByRole('list', { name: /Characters/ });
};
const names = (list: HTMLElement) =>
  within(list)
    .getAllByRole('button')
    .map((b) => b.getAttribute('aria-label'));

describe('Roster characters: order and leaks', () => {
  beforeEach(() => {
    localStorage.clear();
    reloadPrefs();
    resetUserData();
    resetHideLeaks();
    resetShowLeaked();
  });

  it('newest first by default: dated by release date, then undated by name; the sort can be changed', async () => {
    const list = await show(released);
    expect(names(list)).toEqual(['Newest Star', 'Older Star', 'Abe Undated', 'Zed Undated']);
    fireEvent.click(screen.getByRole('button', { name: /^Filters/ }));
    fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'name' } });
    expect(names(screen.getByRole('list', { name: /Characters/ }))).toEqual(['Abe Undated', 'Newest Star', 'Older Star', 'Zed Undated']);
  });

  it('leaked characters are hidden until “Show leaked”, then marked LEAK on a tile the same as any other', async () => {
    const list = await show([...released, leak]);
    expect(names(list)).not.toContain('Rumoured Hero, leaked, unverified');
    const toggle = screen.getByRole('button', { name: 'Show leaked' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(toggle);
    // The grid redraws after the click: wait for the leaked tile rather than reading too early.
    const tile = await screen.findByRole('button', { name: 'Rumoured Hero, leaked, unverified' });
    const shown = screen.getByRole('list', { name: /Characters/ });
    expect(names(shown)).toContain('Rumoured Hero, leaked, unverified');
    // A LEAK chip in the picture where NOT OWNED would be; no tag or source text under the tile
    // (it would make the tile taller than the rest). The source is on the character page.
    expect(within(tile).getByText('LEAK')).toBeInTheDocument();
    expect(within(tile).queryByText('NOT OWNED')).toBeNull();
    expect(within(tile).queryByText('? UNVERIFIED')).toBeNull();
    expect(within(tile).queryByText('test leak site')).toBeNull();
    // A leak isn't counted as something you could own.
    expect(screen.getByText(/of 4 owned/)).toBeInTheDocument();
    // Remembered in this browser.
    expect(localStorage.getItem('hlith.roster.showLeaked')).toBe('1');
  });

  it('a leaked character can be wanted but not owned', async () => {
    localStorage.setItem('hlith.roster.showLeaked', '1');
    await show([...released, leak]);
    fireEvent.click(screen.getByRole('button', { name: /^Filters/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark owned' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rumoured Hero, leaked, unverified' }));
    expect(gameData('aa').roster.x1?.owned ?? false).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Mark wanted' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rumoured Hero, leaked, unverified' }));
    expect(gameData('aa').roster.x1).toMatchObject({ owned: false, wanted: true });
    // On its page too: Owned is switched off, Wanted works.
    fireEvent.click(screen.getByRole('button', { name: 'Open page' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rumoured Hero, leaked, unverified, wanted' }));
    const page = await screen.findByRole('article', { name: 'Rumoured Hero' });
    expect(within(page).getByRole('button', { name: 'Owned' })).toBeDisabled();
    // The page keeps the unverified mark and where the leak came from.
    expect(within(page).getAllByText('test leak site').length).toBeGreaterThan(0);
    // Marked unverified with its source at the top and on If you pull (T39).
    expect(within(page).getAllByText('test leak site')).toHaveLength(2);
  });

  it('says so honestly when leaks are shown but none are listed', async () => {
    await show(released);
    fireEvent.click(await screen.findByRole('button', { name: 'Show leaked' }));
    expect(await screen.findByText('No leaked characters listed yet.')).toBeInTheDocument();
  });

  it('“Hide leaks” (Banners) keeps leaked characters hidden here too', async () => {
    localStorage.setItem('hlith.roster.showLeaked', '1');
    setHideLeaks(true);
    const list = await show([...released, leak]);
    expect(names(list)).not.toContain('Rumoured Hero, leaked, unverified');
    expect(screen.getByRole('button', { name: 'Show leaked' })).toBeDisabled();
    expect(screen.getByText(/stay hidden while “Hide leaks” is on/)).toBeInTheDocument();
  });
  it('shown leaks always come first, newest first among them, whatever the sort (owner)', async () => {
    const older: Character = { ...leak, id: '1405', name: 'Older Leak', rarity: 'mid' };
    const newer: Character = { ...leak, id: '1511', name: 'Newer Leak', rarity: 'mid' };
    await show([...released, older, newer]);
    fireEvent.click(screen.getByRole('button', { name: 'Show leaked' }));
    await screen.findByRole('button', { name: 'Newer Leak, leaked, unverified' });
    const top = () => names(screen.getByRole('list', { name: /Characters/ })).slice(0, 3);
    // Newest first (default): both leaks above every released character, the newer one first.
    expect(top()).toEqual(['Newer Leak, leaked, unverified', 'Older Leak, leaked, unverified', 'Newest Star']);
    fireEvent.click(screen.getByRole('button', { name: /^Filters/ }));
    // Name and Rarity order only the released ones: "Abe" and the 5★ stay below the leaks.
    fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'name' } });
    expect(top()).toEqual(['Newer Leak, leaked, unverified', 'Older Leak, leaked, unverified', 'Abe Undated']);
    fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'rarity' } });
    expect(top()).toEqual(['Newer Leak, leaked, unverified', 'Older Leak, leaked, unverified', 'Newest Star']);
  });
});
