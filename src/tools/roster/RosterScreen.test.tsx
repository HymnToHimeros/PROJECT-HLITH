import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Character, GameContract, Kit, TeamPreset } from '../../core/contract';
import { gameData, resetUserData, setRosterEntry } from '../../core/data/userData';
import RosterScreen from './RosterScreen';

const chars: Character[] = [
  { id: 'c1', name: 'Newest Star', rarity: 'top', element: 'fire', role: 'attack', releasedAt: '2026-09-01' },
  { id: 'c2', name: 'Older Star', rarity: 'top', element: 'ice', role: 'attack', releasedAt: '2025-01-01' },
  { id: 'c3', name: 'Helper', rarity: 'mid', element: 'fire', role: 'support', releasedAt: '2024-05-01' },
  { id: 'c4', name: 'Shield Friend', rarity: 'mid', element: 'ice', role: 'support', releasedAt: '2024-01-01' },
];

const preset: TeamPreset = {
  id: 'p1',
  name: 'Fire team',
  slots: [{ characters: ['c1'] }, { characters: ['c3', 'c4'] }, { characters: ['c2'] }],
  source: 'test list',
};

const kits: Kit[] = [
  {
    characterId: 'c1',
    skills: [{ id: 'c1-basic-0', label: 'Basic Attack: Ember', does: ['fire damage'], gameText: 'Swings twice, dealing Fire DMG.' }],
  },
];

function makeGame(withKits: boolean, presets: TeamPreset[] = [preset]): GameContract {
  return {
    id: 'aa',
    short: 'AA',
    name: 'Game A',
    vent: '#A99BFF',
    terms: { rarity: { top: '5★', mid: '4★' }, gear: 'Relics', weapon: 'Cone', skill: 'Skills', character: 'Character', endgame: [] },
    elements: [
      { id: 'fire', label: 'Fire', color: '#E8664A' },
      { id: 'ice', label: 'Ice', color: '#8FD3F0' },
    ],
    roles: [
      { id: 'attack', label: 'Attack' },
      { id: 'support', label: 'Support' },
    ],
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
    data: {
      characters: async () => chars,
      banners: async () => [],
      events: async () => [],
      backlog: async () => [],
      materials: async () => [],
      teams: async () => presets,
      versions: async () => [],
      ...(withKits ? { kits: async () => kits } : {}),
    },
    rules: {},
    sources: [],
  };
}

const show = async (tab: 'characters' | 'teams', game = makeGame(false), games: GameContract[] = [game], scope = 'aa') => {
  render(<RosterScreen games={games} scope={scope} tab={tab} servers={{}} openTab={() => {}} open={() => {}} openAccount={() => {}} />);
  if (tab === 'characters') await screen.findByRole('list', { name: /Characters/ });
  else await screen.findByRole('region', { name: 'Recommended teams' });
};

const tileNames = () =>
  within(screen.getByRole('list', { name: /Characters/ }))
    .getAllByRole('button')
    .map((b) => b.getAttribute('aria-label'));

const openFilters = () => fireEvent.click(screen.getByRole('button', { name: /^Filters/ }));

const openPage = async (name: string) => {
  fireEvent.click(screen.getByRole('button', { name }));
  return screen.findByRole('article', { name });
};

describe('Roster screen', () => {
  beforeEach(() => {
    localStorage.clear();
    resetUserData();
  });

  it('Characters shows every character, newest first, with "N of M owned"', async () => {
    setRosterEntry('aa', 'c3', { owned: true, wanted: false, dupes: 2 });
    await show('characters');
    expect(tileNames()).toEqual(['Newest Star', 'Older Star', 'Helper, owned', 'Shield Friend']);
    expect(screen.getAllByText('5★').length).toBeGreaterThan(0);
    expect(screen.getByText(/of 4 owned/)).toHaveTextContent('1 of 4 owned');
    expect(screen.getByText('E2')).toBeInTheDocument();
    expect(screen.getAllByText('NOT OWNED')).toHaveLength(3);
  });

  it('filters by element, owned / not owned / wanted and name', async () => {
    setRosterEntry('aa', 'c3', { owned: true, wanted: false, dupes: 0 });
    setRosterEntry('aa', 'c2', { owned: false, wanted: true, dupes: 0 });
    await show('characters');
    // Search and the finer filters sit behind one closed "Filters" button.
    expect(screen.queryByLabelText('Element')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Search')).not.toBeInTheDocument();
    openFilters();
    fireEvent.change(screen.getByLabelText('Element'), { target: { value: 'Fire' } });
    expect(tileNames()).toEqual(['Newest Star', 'Helper, owned']);
    const showGroup = screen.getByRole('group', { name: 'Show' });
    fireEvent.click(within(showGroup).getByRole('button', { name: 'Owned' }));
    expect(tileNames()).toEqual(['Helper, owned']);
    fireEvent.click(screen.getByText('Clear filters'));
    fireEvent.click(within(showGroup).getByRole('button', { name: 'Wanted' }));
    expect(tileNames()).toEqual(['Older Star, wanted']);
    fireEvent.click(within(showGroup).getByRole('button', { name: 'All' }));
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'shield' } });
    expect(tileNames()).toEqual(['Shield Friend']);
  });

  it('tap actions mark many at once: owned, copies, and select several', async () => {
    await show('characters');
    openFilters();
    const tap = screen.getByRole('group', { name: 'Tap a character to' });
    fireEvent.click(within(tap).getByRole('button', { name: 'Mark owned' }));
    fireEvent.click(screen.getByRole('button', { name: 'Helper' }));
    expect(gameData('aa').roster.c3?.owned).toBe(true);
    fireEvent.click(within(tap).getByRole('button', { name: 'Add a copy' }));
    fireEvent.click(screen.getByRole('button', { name: 'Helper, owned' }));
    expect(gameData('aa').roster.c3?.dupes).toBe(1);
    fireEvent.click(within(tap).getByRole('button', { name: 'Select several' }));
    fireEvent.click(screen.getByRole('button', { name: 'Newest Star' }));
    fireEvent.click(screen.getByRole('button', { name: 'Older Star' }));
    const bar = screen.getByRole('region', { name: 'Selected characters' });
    fireEvent.click(within(bar).getByRole('button', { name: 'Wanted' }));
    expect(gameData('aa').roster.c1?.wanted).toBe(true);
    expect(gameData('aa').roster.c2?.wanted).toBe(true);
    // Nothing else changed: your data is only ever added to.
    expect(gameData('aa').roster.c3).toEqual({ owned: true, wanted: false, dupes: 1 });
  });

  it('the character page replaces the grid, saves owned, wanted and copies, and goes back', async () => {
    await show('characters');
    const page = await openPage('Older Star');
    expect(screen.queryByRole('list', { name: /Characters/ })).not.toBeInTheDocument();
    fireEvent.click(within(page).getByRole('button', { name: 'Owned' }));
    expect(gameData('aa').roster.c2).toEqual({ owned: true, wanted: false, dupes: 0 });
    fireEvent.click(within(page).getByRole('button', { name: 'One Eidolon more' }));
    fireEvent.click(within(page).getByRole('button', { name: 'Wanted' }));
    expect(gameData('aa').roster.c2).toEqual({ owned: true, wanted: true, dupes: 1 });
    expect(within(page).getByText('E1')).toBeInTheDocument();
    // Build, level and gear have no data in this game: honest "No data yet", plus a marked example preview.
    expect(within(page).getByText('No build data yet')).toBeInTheDocument();
    expect(within(page).getAllByText(/No data yet/).length).toBeGreaterThan(2);
    expect(within(page).getAllByText('EXAMPLE').length).toBeGreaterThan(0);
    fireEvent.click(within(page).getByRole('button', { name: '← Roster' }));
    expect(await screen.findByRole('list', { name: /Characters/ })).toBeInTheDocument();
  });

  it('a character you don’t own shows "If you pull" with pity left honest', async () => {
    await show('characters');
    const page = await openPage('Newest Star');
    expect(within(page).getByRole('heading', { name: 'If you pull' })).toBeInTheDocument();
    expect(within(page).getByText(/Current pity and 50\/50: no data yet/)).toBeInTheDocument();
  });

  it('Teams shows preset portraits with who you own, and leaves the fit score as "No data yet"', async () => {
    setRosterEntry('aa', 'c1', { owned: true, wanted: false, dupes: 0 });
    setRosterEntry('aa', 'c3', { owned: false, wanted: true, dupes: 0 });
    await show('teams');
    const card = screen.getByRole('article', { name: 'Fire team' });
    expect(within(within(card).getByLabelText('Fit with your roster')).getByText('No data yet')).toBeInTheDocument();
    expect(within(card).getByText('Newest Star').nextSibling).toHaveTextContent('owned');
    expect(within(card).getByText('Helper').nextSibling).toHaveTextContent('wanted');
    expect(within(card).getByText('Older Star').nextSibling).toHaveTextContent('not owned');
    expect(within(card).getByText('or Shield Friend')).toBeInTheDocument();
    expect(within(card).queryByText('EXAMPLE')).not.toBeInTheDocument();
    // No presets of your own yet: the design's empty card.
    expect(screen.getByText('No team presets yet')).toBeInTheDocument();
  });

  it('without presets, Teams shows example presets with example scores and an honest notice', async () => {
    await show('teams', makeGame(false, []));
    expect(screen.getByText(/Real recommended teams and scoring still have to be added by us/)).toBeInTheDocument();
    expect(screen.getAllByText('EXAMPLE').length).toBeGreaterThan(1);
    const card = screen.getByRole('article', { name: 'Newest Star team' });
    expect(within(card).getByText('91')).toBeInTheDocument();
    expect(within(card).getAllByText('EXAMPLE').length).toBeGreaterThan(0);
  });

  it('you can make your own preset from the characters you own', async () => {
    setRosterEntry('aa', 'c1', { owned: true, wanted: false, dupes: 0 });
    setRosterEntry('aa', 'c3', { owned: true, wanted: false, dupes: 0 });
    await show('teams');
    fireEvent.click(screen.getByRole('button', { name: 'New preset' }));
    const sheet = await screen.findByRole('dialog', { name: 'New preset' });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Newest Star' }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Helper' }));
    await act(async () => {
      fireEvent.click(within(sheet).getByRole('button', { name: 'Save preset' }));
    });
    expect(gameData('aa').teams).toHaveLength(1);
    expect(gameData('aa').teams[0]?.members).toEqual(['c1', 'c3']);
  });

  it('Kit check says "No data yet" when the game has no kit data', async () => {
    await show('characters');
    const page = await openPage('Newest Star');
    const kit = within(page).getByRole('region', { name: 'Kit check' });
    expect(within(kit).getByText('No data yet')).toBeInTheDocument();
  });

  it('Kit check shows what each skill does with the game text as proof', async () => {
    await show('characters', makeGame(true));
    const page = await openPage('Newest Star');
    expect(await within(page).findByText('Basic Attack: Ember')).toBeInTheDocument();
    expect(within(page).getByText('Swings twice, dealing Fire DMG.')).toBeInTheDocument();
    expect(within(page).getAllByText('fire damage').length).toBeGreaterThan(0);
  });

  it('Kit check also opens from a team in Teams', async () => {
    await show('teams', makeGame(true));
    fireEvent.click(screen.getByRole('button', { name: 'Kit check' }));
    const dialog = await screen.findByRole('dialog', { name: 'Kit check · Fire team' });
    expect(await within(dialog).findByText('Swings twice, dealing Fire DMG.')).toBeInTheDocument();
    // Members without kit data say so.
    expect(within(dialog).getAllByText('No data yet').length).toBe(2);
  });

  it('All games: one game at a time, picked with a game switch that is remembered', async () => {
    const bChars: Character[] = [{ id: 'b1', name: 'Bee Only', rarity: 'top', element: 'fire', role: 'attack' }];
    const a = makeGame(false);
    const b = { ...makeGame(false), id: 'bb', short: 'BB', name: 'Game B', data: { ...a.data, characters: async () => bChars } } as GameContract;
    await show('characters', a, [a, b], 'all');
    const sw = screen.getByRole('group', { name: 'Roster game' });
    expect(within(sw).getByRole('button', { name: 'AA' })).toHaveAttribute('aria-pressed', 'true');
    // Never two games mixed: only game A's tiles, no game tags.
    expect(tileNames()).toEqual(['Newest Star', 'Older Star', 'Helper', 'Shield Friend']);
    fireEvent.click(within(sw).getByRole('button', { name: 'BB' }));
    expect(await screen.findByRole('button', { name: 'Bee Only' })).toBeInTheDocument();
    expect(tileNames()).toEqual(['Bee Only']);
    expect(localStorage.getItem('hlith.roster.game')).toBe('bb');
  });

  it('a single game shows no game switch', async () => {
    await show('characters');
    expect(screen.queryByRole('group', { name: 'Roster game' })).not.toBeInTheDocument();
  });
});
