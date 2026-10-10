import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character, GameContract, Kit, TeamPreset } from '../../core/contract';
import { gameData, resetUserData, saveTeam, setRosterEntry } from '../../core/data/userData';
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
    fireEvent.click(within(sheet).getByRole('button', { name: 'Newest Star, owned' }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Helper, owned' }));
    await act(async () => {
      fireEvent.click(within(sheet).getByRole('button', { name: 'Save preset' }));
    });
    expect(gameData('aa').teams).toHaveLength(1);
    expect(gameData('aa').teams[0]?.members).toEqual(['c1', 'c3']);
  });

  it('the preset editor lists owned first, then wanted, then everyone else behind "Show all"; a preset may include anyone', async () => {
    setRosterEntry('aa', 'c3', { owned: true, wanted: false, dupes: 0 });
    setRosterEntry('aa', 'c2', { owned: false, wanted: true, dupes: 0 });
    await show('teams');
    fireEvent.click(screen.getByRole('button', { name: 'New preset' }));
    const sheet = await screen.findByRole('dialog', { name: 'New preset' });
    const list = () =>
      within(within(sheet).getByRole('list', { name: 'Characters to pick' }))
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label'));
    expect(list()).toEqual(['Helper, owned', 'Older Star, wanted · not owned']);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Show all (2 more, not owned)' }));
    expect(list()).toEqual(['Helper, owned', 'Older Star, wanted · not owned', 'Newest Star, not owned', 'Shield Friend, not owned']);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Newest Star, not owned' }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save preset' }));
    expect(gameData('aa').teams[0]?.members).toEqual(['c1']);
  });

  it('owning nobody is no dead end: the editor still lists everyone to pick from', async () => {
    await show('teams');
    fireEvent.click(screen.getByRole('button', { name: 'New preset' }));
    const sheet = await screen.findByRole('dialog', { name: 'New preset' });
    expect(within(sheet).getByText(/You haven’t marked anyone as owned yet/)).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Show all (4 more, not owned)' }));
    expect(within(sheet).getByRole('button', { name: 'Helper, not owned' })).toBeInTheDocument();
  });

  it('a saved preset can be deleted, and Undo puts it back', async () => {
    saveTeam('aa', { id: 't1', name: 'My team', members: ['c1', 'c3'] });
    await show('teams');
    const card = screen.getByRole('article', { name: 'My team' });
    fireEvent.click(within(card).getByRole('button', { name: 'Edit' }));
    const sheet = await screen.findByRole('dialog', { name: 'Edit preset' });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete preset' }));
    expect(gameData('aa').teams).toEqual([]);
    expect(screen.getByRole('status')).toHaveTextContent('Deleted “My team”.');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(gameData('aa').teams).toEqual([{ id: 't1', name: 'My team', members: ['c1', 'c3'] }]);
    expect(await screen.findByRole('article', { name: 'My team' })).toBeInTheDocument();
  });

  it('"Save as my preset" on a recommended team opens the editor pre-filled; members can be changed', async () => {
    await show('teams');
    const card = screen.getByRole('article', { name: 'Fire team' });
    fireEvent.click(within(card).getByRole('button', { name: 'Save as my preset' }));
    const sheet = await screen.findByRole('dialog', { name: 'New preset' });
    expect(within(sheet).getByLabelText('Preset name')).toHaveValue('Fire team');
    expect(within(sheet).getByRole('button', { name: 'Newest Star, not owned' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Older Star, not owned' }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save preset' }));
    expect(gameData('aa').teams[0]).toMatchObject({ name: 'Fire team', members: ['c1', 'c3'] });
  });

  it('example Ideas never contradict your roster, and tapping one makes it a preset', async () => {
    await show('teams', makeGame(false, []));
    // Nobody owned: no example team is "Ready to play", none claims an endgame record, and nobody "makes their own team better".
    expect(screen.queryByText('Ready to play')).not.toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Endgame record' })).getByText('No data yet')).toBeInTheDocument();
    const pull = screen.getByRole('region', { name: 'If you pull' });
    expect(pull).not.toHaveTextContent(/makes/);
    expect(within(pull).getByText(/^fits /)).toBeInTheDocument();
    const ideas = screen.getByRole('region', { name: 'Teams you can build' });
    fireEvent.click(within(ideas).getByRole('button', { name: /Newest Star team: \d characters away/ }));
    const sheet = await screen.findByRole('dialog', { name: 'New preset' });
    expect(within(sheet).getByLabelText('Preset name')).toHaveValue('Newest Star team');
  });

  it('example Ideas say "Ready to play" only for a team you fully own', async () => {
    for (const id of ['c1', 'c2', 'c3', 'c4']) setRosterEntry('aa', id, { owned: true, wanted: false, dupes: 0 });
    await show('teams', makeGame(false, []));
    const ideas = screen.getByRole('region', { name: 'Teams you can build' });
    expect(within(ideas).getByRole('button', { name: /Newest Star team: Ready to play/ })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Endgame record' })).getByText('Newest Star team')).toBeInTheDocument();
    // Everyone owned: nobody left to pull for.
    expect(within(screen.getByRole('region', { name: 'If you pull' })).getByText('No data yet')).toBeInTheDocument();
  });

  it('"Link HoYoLAB in Account" is a button that opens Account', async () => {
    const openAccount = vi.fn();
    render(<RosterScreen games={[makeGame(false)]} scope="aa" tab="teams" servers={{}} openTab={() => {}} open={() => {}} openAccount={openAccount} />);
    fireEvent.click(await screen.findByRole('button', { name: /Link HoYoLAB in Account/ }));
    expect(openAccount).toHaveBeenCalled();
  });

  it('marking Owned clears Wanted, on the page and in Select several; "Not wanted" clears in bulk', async () => {
    setRosterEntry('aa', 'c1', { owned: false, wanted: true, dupes: 0 });
    setRosterEntry('aa', 'c2', { owned: false, wanted: true, dupes: 0 });
    setRosterEntry('aa', 'c3', { owned: false, wanted: true, dupes: 0 });
    await show('characters');
    fireEvent.click(screen.getByRole('button', { name: 'Newest Star, wanted' }));
    const page = await screen.findByRole('article', { name: 'Newest Star' });
    fireEvent.click(within(page).getByRole('button', { name: 'Owned' }));
    expect(gameData('aa').roster.c1).toEqual({ owned: true, wanted: false, dupes: 0 });
    fireEvent.click(within(page).getByRole('button', { name: '← Roster' }));
    await screen.findByRole('list', { name: /Characters/ });
    openFilters();
    fireEvent.click(within(screen.getByRole('group', { name: 'Tap a character to' })).getByRole('button', { name: 'Select several' }));
    fireEvent.click(screen.getByRole('button', { name: 'Older Star, wanted' }));
    const bar = screen.getByRole('region', { name: 'Selected characters' });
    fireEvent.click(within(bar).getByRole('button', { name: 'Owned' }));
    expect(gameData('aa').roster.c2).toEqual({ owned: true, wanted: false, dupes: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Helper, wanted' }));
    fireEvent.click(within(bar).getByRole('button', { name: 'Not wanted' }));
    expect(gameData('aa').roster.c3).toEqual({ owned: false, wanted: false, dupes: 0 });
  });

  it('the character page shows Build score once, no dead "Import build" button, and says levels aren’t saved', async () => {
    setRosterEntry('aa', 'c1', { owned: true, wanted: false, dupes: 0 });
    await show('characters');
    fireEvent.click(screen.getByRole('button', { name: 'Newest Star, owned' }));
    const page = await screen.findByRole('article', { name: 'Newest Star' });
    expect(within(page).getAllByText('Build score')).toHaveLength(1);
    expect(within(page).queryByRole('button', { name: 'Import build' })).not.toBeInTheDocument();
    expect(within(page).getByText(/HLITH can’t save builds/)).toBeInTheDocument();
    expect(within(page).getByText(/levels aren’t saved yet/)).toBeInTheDocument();
  });

  it('"Plan it in Farm" adds the character to Farm before opening it', async () => {
    const open = vi.fn();
    const game = { ...makeGame(false), modules: ['roster', 'farm'] } as GameContract;
    render(<RosterScreen games={[game]} scope="aa" tab="characters" servers={{}} openTab={() => {}} open={open} openAccount={() => {}} />);
    await screen.findByRole('list', { name: /Characters/ });
    const page = await openPage('Helper');
    fireEvent.click(within(page).getByRole('button', { name: 'Plan it in Farm →' }));
    expect(gameData('aa').farm).toEqual(['c3']);
    expect(open).toHaveBeenCalledWith('farm');
  });

  it('Team fit with no preset offers "Make a preset with them", which opens Teams with them picked', async () => {
    const only: TeamPreset = { id: 'p2', name: 'Small team', slots: [{ characters: ['c1'] }, { characters: ['c3'] }], source: 'test list' };
    function WithTabs() {
      const [tab, setTab] = useState('characters');
      return <RosterScreen games={[makeGame(false, [only])]} scope="aa" tab={tab} servers={{}} openTab={setTab} open={() => {}} openAccount={() => {}} />;
    }
    render(<WithTabs />);
    await screen.findByRole('list', { name: /Characters/ });
    const page = await openPage('Shield Friend');
    fireEvent.click(within(page).getByRole('button', { name: 'Make a preset with them →' }));
    const sheet = await screen.findByRole('dialog', { name: 'New preset' });
    expect(within(sheet).getByRole('button', { name: 'Shield Friend, not owned' })).toHaveAttribute('aria-pressed', 'true');
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
