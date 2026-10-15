import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { reloadPrefs, updatePrefs } from '../../core/data/prefs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character, GameContract, Kit, TeamPreset, TeamRules } from '../../core/contract';
import { gameData, resetUserData, saveTeam, setCharacterTags, setNickname, setBuild, setRosterEntry, setTeamList } from '../../core/data/userData';
import RosterScreen from './RosterScreen';
import { setShowLeaked } from './leakedPref';

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

const saveTeamListForTest = () => setTeamList('aa', 'p1', [['c1'], ['c4', 'c3'], ['c2']]);

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

describe('Roster: your labels and remembered view (T52c)', () => {
  beforeEach(() => {
    localStorage.clear();
    reloadPrefs();
    resetUserData();
  });

  it('nicknames show on tiles and are searchable; tags filter the grid', async () => {
    setNickname('aa', 'c1', '  Sparky  ');
    setCharacterTags('aa', 'c1', ['main team', 'main team', ' to build ']);
    setCharacterTags('aa', 'c3', ['main team']);
    expect(gameData('aa').tags?.c1).toEqual(['main team', 'to build']);
    await show('characters');
    expect(tileNames()[0]).toBe('Newest Star (“Sparky”)');
    openFilters();
    fireEvent.change(screen.getByLabelText('Your tag'), { target: { value: 'main team' } });
    expect(tileNames()).toEqual(['Newest Star (“Sparky”)', 'Helper']);
    fireEvent.change(screen.getByLabelText('Your tag'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'sparky' } });
    expect(tileNames()).toEqual(['Newest Star (“Sparky”)']);
    setNickname('aa', 'c1', '');
    expect(gameData('aa').nicknames).toEqual({});
  });

  it('remembers sort and filters for next time; Customise can switch tile parts off', async () => {
    await show('characters');
    openFilters();
    fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'name' } });
    fireEvent.click(within(screen.getByRole('group', { name: 'Show' })).getByRole('button', { name: 'Not owned' }));
    cleanup();
    updatePrefs((p) => ({ ...p, roster: { ...p.roster, hideOnTile: ['rarity'], tileSize: 'small' } }));
    await show('characters');
    expect(tileNames()).toEqual(['Helper', 'Newest Star', 'Older Star', 'Shield Friend']);
    expect(within(screen.getByRole('group', { name: 'Show' })).getByRole('button', { name: 'Not owned' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('5★')).toBeNull();
    expect(screen.getByRole('list', { name: /Characters/ })).toHaveAttribute('data-size', 'small');
  });
});

describe('Roster screen', () => {
  beforeEach(() => {
    localStorage.clear();
    reloadPrefs();
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
    expect(within(page).getByText('No build saved yet')).toBeInTheDocument();
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
    expect(screen.getByText('No teams of your own yet')).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: 'Make a team' }));
    const sheet = await screen.findByRole('dialog', { name: 'New team' });
    // Typing in the search keeps the cursor there.
    const search = within(sheet).getAllByRole('searchbox')[0] as HTMLInputElement;
    search.focus();
    for (const v of ['N', 'Ne', '']) fireEvent.change(search, { target: { value: v } });
    expect(document.activeElement).toBe(search);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Newest Star, owned' }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Helper, owned' }));
    await act(async () => {
      fireEvent.click(within(sheet).getByRole('button', { name: 'Save team' }));
    });
    expect(gameData('aa').teams).toHaveLength(1);
    expect(gameData('aa').teams[0]?.members).toEqual(['c1', 'c3']);
  });

  it('the preset editor lists owned first, then wanted, then everyone else behind "Show all"; a preset may include anyone', async () => {
    setRosterEntry('aa', 'c3', { owned: true, wanted: false, dupes: 0 });
    setRosterEntry('aa', 'c2', { owned: false, wanted: true, dupes: 0 });
    await show('teams');
    fireEvent.click(screen.getByRole('button', { name: 'Make a team' }));
    const sheet = await screen.findByRole('dialog', { name: 'New team' });
    const list = () =>
      within(within(sheet).getByRole('list', { name: 'Characters to pick' }))
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label'));
    expect(list()).toEqual(['Helper, owned', 'Older Star, wanted · not owned']);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Show all (2 more, not owned)' }));
    expect(list()).toEqual(['Helper, owned', 'Older Star, wanted · not owned', 'Newest Star, not owned', 'Shield Friend, not owned']);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Newest Star, not owned' }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save team' }));
    expect(gameData('aa').teams[0]?.members).toEqual(['c1']);
  });

  it('owning nobody is no dead end: the editor still lists everyone to pick from', async () => {
    await show('teams');
    fireEvent.click(screen.getByRole('button', { name: 'Make a team' }));
    const sheet = await screen.findByRole('dialog', { name: 'New team' });
    expect(within(sheet).getByText(/You haven’t marked anyone as owned yet/)).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Show all (4 more, not owned)' }));
    expect(within(sheet).getByRole('button', { name: 'Helper, not owned' })).toBeInTheDocument();
  });

  it('a saved preset can be deleted, and Undo puts it back', async () => {
    saveTeam('aa', { id: 't1', name: 'My team', members: ['c1', 'c3'] });
    await show('teams');
    const card = screen.getByRole('article', { name: 'My team' });
    fireEvent.click(within(card).getByRole('button', { name: 'Edit' }));
    const sheet = await screen.findByRole('dialog', { name: 'Edit team' });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete team' }));
    expect(gameData('aa').teams).toEqual([]);
    expect(screen.getByRole('status')).toHaveTextContent('Deleted “My team”.');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(gameData('aa').teams).toEqual([{ id: 't1', name: 'My team', members: ['c1', 'c3'] }]);
    expect(await screen.findByRole('article', { name: 'My team' })).toBeInTheDocument();
  });

  it('"Save as my preset" on a recommended team opens the editor pre-filled; members can be changed', async () => {
    await show('teams');
    const card = screen.getByRole('article', { name: 'Fire team' });
    fireEvent.click(within(card).getByRole('button', { name: 'Save as my team' }));
    const sheet = await screen.findByRole('dialog', { name: 'New team' });
    expect(within(sheet).getByLabelText('Team name')).toHaveValue('Fire team');
    expect(within(sheet).getByRole('button', { name: 'Newest Star, not owned' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Older Star, not owned' }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save team' }));
    expect(gameData('aa').teams[0]).toMatchObject({ name: 'Fire team', members: ['c1', 'c3'] });
  });

  it('Edit team list: reorder, add and remove per slot; saved as yours, tagged on the card, and reset to the game’s list', async () => {
    await show('teams');
    const card = () => screen.getByRole('article', { name: 'Fire team' });
    fireEvent.click(within(card()).getByRole('button', { name: 'Edit team list' }));
    const sheet = await screen.findByRole('dialog', { name: 'Team list · Fire team' });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Move Shield Friend earlier in slot 2' }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Remove Helper from slot 2' }));
    fireEvent.click(within(sheet).getByRole('button', { name: '+ Add to slot 2' }));
    fireEvent.change(within(sheet).getByLabelText('Add to slot 2'), { target: { value: 'older' } });
    fireEvent.click(within(within(sheet).getByRole('list', { name: 'Characters to add to slot 2' })).getByRole('button', { name: /Older Star/ }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save team list' }));
    expect(gameData('aa').teamLists?.p1?.slots).toEqual([['c1'], ['c4', 'c2'], ['c2']]);
    expect(within(card()).getByText('Edited by you')).toBeInTheDocument();
    expect(within(card()).getByRole('list', { name: 'Who else fits' })).toHaveTextContent('or Older Star');

    // Reset puts the game's lists back; saving them removes your edit. Nothing else in your data changes.
    fireEvent.click(within(card()).getByRole('button', { name: 'Edit team list' }));
    const again = await screen.findByRole('dialog', { name: 'Team list · Fire team' });
    fireEvent.click(within(again).getByRole('button', { name: 'Reset to the game’s list' }));
    fireEvent.click(within(again).getByRole('button', { name: 'Save team list' }));
    expect(gameData('aa').teamLists?.p1).toBeUndefined();
    expect(within(card()).queryByText('Edited by you')).not.toBeInTheDocument();
  });

  it('Cancel in Edit team list changes nothing', async () => {
    await show('teams');
    fireEvent.click(within(screen.getByRole('article', { name: 'Fire team' })).getByRole('button', { name: 'Edit team list' }));
    const sheet = await screen.findByRole('dialog', { name: 'Team list · Fire team' });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Remove Helper from slot 2' }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    expect(gameData('aa').teamLists).toBeUndefined();
  });

  it('team rules get your edited lists (TeamAccount.teamList) and fill the card from them', async () => {
    const fill = vi.fn((p: TeamPreset, account: Parameters<NonNullable<TeamRules['fill']>>[1]) => (account.teamList?.(p.id) ?? p.slots.map((sl) => sl.characters)).map((sl) => sl[0] ?? ''));
    const game = { ...makeGame(false), rules: { teams: { method: 'm', rated: () => false, verdict: () => ({ rated: false, why: '' }), whoFits: () => [], lineUps: () => [], ifYouPull: () => null, fill } as TeamRules } };
    act(() => {
      saveTeamListForTest();
    });
    await show('teams', game);
    const members = within(screen.getByRole('article', { name: 'Fire team' })).getAllByTitle(/·/).map((m) => m.getAttribute('title')?.split(' · ')[0]);
    expect(members).toEqual(['Newest Star', 'Shield Friend', 'Older Star']);
  });

  it('"Assume signature + average build" shows only with team scoring, starts off and is saved per game (T34)', async () => {
    await show('teams');
    expect(screen.queryByRole('switch', { name: /Assume signature \+ average build/ })).not.toBeInTheDocument();
    cleanup();
    const seen: (boolean | undefined)[] = [];
    const fill = (p: TeamPreset, account: Parameters<NonNullable<TeamRules['fill']>>[1]) => {
      seen.push(account.assumeAverage);
      return p.slots.map((sl) => sl.characters[0] ?? '');
    };
    // Line-ups are worked out once and kept: they must be worked out again when the switch changes.
    const lineUpsSeen: (boolean | undefined)[] = [];
    const lineUps = (account: Parameters<TeamRules['lineUps']>[0]) => {
      lineUpsSeen.push(account.assumeAverage);
      return [];
    };
    const rules = { method: 'm', rated: () => false, verdict: () => ({ rated: false, why: '' }), whoFits: () => [], lineUps, ifYouPull: () => null, fill } as unknown as TeamRules;
    await show('teams', { ...makeGame(false), rules: { teams: rules } });
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((v) => v === undefined)).toBe(true);
    const sw = screen.getByRole('switch', { name: 'Assume signature + average build when none is saved' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    const before = seen.length;
    const lineUpsBefore = lineUpsSeen.length;
    fireEvent.click(sw);
    expect(gameData('aa').assumeAverageBuilds).toBe(true);
    // The team rules get it with the account (TeamAccount.assumeAverage): wait for the screen to ask again,
    // then every answer it asked for since the click carries the switch (none from before it).
    await waitFor(() => expect(seen.length).toBeGreaterThan(before));
    expect(seen.slice(before).every((v) => v === true)).toBe(true);
    expect(lineUpsBefore).toBeGreaterThan(0);
    await waitFor(() => expect(lineUpsSeen.length).toBeGreaterThan(lineUpsBefore));
    expect(lineUpsSeen.at(-1)).toBe(true);
    expect(screen.getByRole('switch', { name: 'Assume signature + average build when none is saved' })).toHaveAttribute('aria-checked', 'true');
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
    const sheet = await screen.findByRole('dialog', { name: 'New team' });
    expect(within(sheet).getByLabelText('Team name')).toHaveValue('Newest Star team');
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
    fireEvent.click(within(page).getByRole('button', { name: 'Make a team with them →' }));
    const sheet = await screen.findByRole('dialog', { name: 'New team' });
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

  it('Kit check names its source and says when a kit has not been read yet', async () => {
    const base = makeGame(true);
    const unread: Kit[] = [{ characterId: 'c1', source: 'nanoka.cc', version: '3.3.4+19304006', beta: true, skills: [{ id: 'core', label: 'Core Passive: Glow', does: [], gameText: 'Glows.' }] }];
    await show('characters', { ...base, data: { ...base.data, kits: async () => unread } });
    const page = await openPage('Newest Star');
    expect(await within(page).findByText(/Game text from nanoka\.cc \(game data 3\.3\.4\)\./)).toBeInTheDocument();
    expect(within(page).getByText(/Not released yet: the text can still change\./)).toBeInTheDocument();
    expect(within(page).getByText(/Not read yet: what each skill does is added next\./)).toBeInTheDocument();
  });

  it('Enhanced / Potential: only for kits that need it, saved per character, read by team rules, and can go back to "Not set"', async () => {
    const seen: (number | undefined)[] = [];
    const base = makeGame(false);
    const game: GameContract = {
      ...base,
      potential: { name: 'Enhanced', max: 1 },
      data: {
        ...base.data,
        kits: async () => [
          { characterId: 'c1', skills: [{ id: 'c1-e', label: 'Enhanced Skill', does: [], gameText: 'Enhanced.', unlock: { potential: 1 } }] },
          { characterId: 'c2', skills: [{ id: 'c2-b', label: 'Basic', does: [], gameText: 'Hits.' }] },
        ],
      },
      rules: {
        teams: {
          method: 'Test method',
          rated: () => true,
          verdict: () => ({ rated: false, why: 'not rated yet' }),
          whoFits: (_m, a) => {
            seen.push(a.potential?.('c1'));
            return [];
          },
          lineUps: () => [],
          ifYouPull: () => null,
        },
      },
    };
    setRosterEntry('aa', 'c1', { owned: true, wanted: false, dupes: 0 });
    await show('characters', game);
    fireEvent.click(screen.getByRole('button', { name: /^Newest Star/ }));
    let page = await screen.findByRole('article', { name: 'Newest Star' });
    const pick = await within(page).findByLabelText('Enhanced');
    expect(within(page).getByText(/keeps Enhanced parts locked until you set it/)).toBeInTheDocument();
    fireEvent.change(pick, { target: { value: '1' } });
    expect(gameData('aa').roster.c1).toEqual({ owned: true, wanted: false, dupes: 0, potential: 1 });
    expect(within(page).getByRole('option', { name: 'Yes' })).toHaveProperty('selected', true);
    expect(seen.at(-1)).toBe(1);
    fireEvent.change(pick, { target: { value: '' } });
    expect(gameData('aa').roster.c1).toEqual({ owned: true, wanted: false, dupes: 0 });
    // A character whose kit has no Enhanced pieces gets no Enhanced control.
    fireEvent.click(within(page).getByRole('button', { name: '← Roster' }));
    await screen.findByRole('list', { name: /Characters/ });
    page = await openPage('Older Star');
    await within(page).findByText('Eidolon');
    expect(within(page).queryByLabelText('Enhanced')).not.toBeInTheDocument();
  });

  it('Build score shows the score, its grade and every checked part with its reason; parts with no data are not counted', async () => {
    const base = makeGame(false);
    const scoreBuild = vi.fn(() => ({
      known: true as const,
      source: 'user' as const,
      at: '2026-10-10T00:00:00Z',
      value: {
        score: 75,
        grade: 'A',
        basis: "Average of 2 checked parts against the game's own recommendation; 1 part with no data yet not counted.",
        parts: [
          { label: 'Level', value: 100, detail: 'Level 80 of 80.' },
          { label: 'Weapon', value: 50, detail: 'Spark Cone is recommended.' },
          { label: '4-piece set', value: null, detail: 'No sets entered.' },
        ],
      },
    }));
    const game: GameContract = { ...base, build: { levelMax: 80, weaponLevelMax: 80, refine: { name: 'Superimposition', max: 5 }, slots: [], subStats: [], skills: [] }, rules: { scoreBuild } };
    setRosterEntry('aa', 'c2', { owned: true, wanted: false, dupes: 0 });
    setBuild('aa', 'c2', { level: 80, weapon: { name: 'Spark Cone', refine: 2 }, gear: [{ slot: 'Head', set: 'Ember Set', subs: [{ stat: 'SPD', value: 4, rolls: 2 }] }], source: 'manual', updatedAt: '2026-10-10T00:00:00Z' });
    await show('characters', game);
    fireEvent.click(screen.getByRole('button', { name: /^Older Star/ }));
    const page = await screen.findByRole('article', { name: 'Older Star' });
    expect(within(page).getByText('75')).toBeInTheDocument();
    expect(within(page).getByText('A')).toBeInTheDocument();
    fireEvent.click(within(page).getByText(/^Why 75:/));
    expect(within(page).getByText('Spark Cone is recommended.')).toBeInTheDocument();
    expect(within(page).getByText('No data yet · No sets entered.')).toBeInTheDocument();
    // The whole saved build reaches the score: set, rolls and refinement included.
    expect(scoreBuild).toHaveBeenCalledWith(
      expect.objectContaining({ weapon: { name: 'Spark Cone', refine: 2 }, gear: [{ slot: 'Head', main: '', subs: { SPD: 4 }, set: 'Ember Set', rolls: { SPD: 2 } }] }),
    );
  });

  it('leaks in teams (T39): the rules get showLeaks from "Show leaked" + "Hide leaks"; a leak\'s page shows If you pull, marked unverified', async () => {
    const leak: Character = { id: 'c9', name: 'Rumoured One', rarity: 'top', element: 'fire', role: 'attack', leak: { source: 'a test leaker' } };
    const seen: (boolean | undefined)[] = [];
    const ifYouPull = (_id: string, account: Parameters<TeamRules['ifYouPull']>[1]) => {
      seen.push(account.showLeaks);
      return { percent: 12, why: ['Leak: Rumoured One: unverified beta kit, may change (a test leaker).', 'Buffs Newest Star.'] };
    };
    const rules = { method: 'm', rated: () => false, verdict: () => ({ rated: false, why: '' }), whoFits: () => [], lineUps: () => [], ifYouPull } as unknown as TeamRules;
    const base = makeGame(false);
    const game: GameContract = { ...base, data: { ...base.data, characters: async () => [...chars, leak] }, rules: { teams: rules } };

    // Leaks off (the default): the rules hear showLeaks off.
    await show('characters', game);
    fireEvent.click(screen.getByRole('button', { name: /^Older Star/ }));
    await screen.findByRole('article', { name: 'Older Star' });
    expect(seen.at(-1)).toBeUndefined();
    cleanup();

    // "Show leaked" on: the leak is listed, its page has If you pull marked unverified, and its leak line is tagged.
    setShowLeaked(true);
    await show('characters', game);
    fireEvent.click(screen.getByRole('button', { name: /^Rumoured One/ }));
    const page = await screen.findByRole('article', { name: 'Rumoured One' });
    expect(seen.at(-1)).toBe(true);
    const pull = within(page).getByRole('region', { name: 'If you pull' });
    expect(within(pull).getAllByText('? UNVERIFIED').length).toBeGreaterThanOrEqual(2);
    expect(within(pull).getByText('a test leaker')).toBeInTheDocument();
    expect(within(page).queryByRole('region', { name: 'Build score' })).not.toBeInTheDocument();
    setShowLeaked(false);
  });

  it('Target stats: you / target per stat from the saved totals, proof one tap below; totals entered in the build form (T35)', async () => {
    const base = makeGame(false);
    const statTargets: NonNullable<GameContract['rules']['statTargets']> = (_id, build) => {
      const crit = build?.totals?.['CRIT Rate'];
      return {
        rows: [
          {
            stat: 'CRIT Rate',
            target: '70%',
            ...(crit !== undefined ? { you: `${crit}%`, met: crit >= 70 } : {}),
            why: 'Her Talent hits its cap at 70%.',
            source: 'Kit: Talent',
            quote: 'CRIT Rate up to 70%.',
            working: '50% + 20% = 70%',
          },
        ],
        direction: { mains: { Body: ['CRIT Rate'] }, subs: ['CRIT DMG'], source: 'the game’s recommended build' },
      };
    };
    const game: GameContract = {
      ...base,
      build: { levelMax: 80, weaponLevelMax: 80, refine: { name: 'Superimposition', max: 5 }, slots: [{ id: 'Body', label: 'Body', mains: ['CRIT Rate'] }], subStats: ['CRIT DMG'], totalStats: ['CRIT Rate', 'SPD'], skills: [] },
      rules: { statTargets },
    };
    setRosterEntry('aa', 'c2', { owned: true, wanted: false, dupes: 0 });
    await show('characters', game);
    fireEvent.click(screen.getByRole('button', { name: /^Older Star/ }));
    const page = await screen.findByRole('article', { name: 'Older Star' });
    const card = () => within(page).getByRole('region', { name: 'Target stats' });
    expect(card()).toHaveTextContent('you: No data yet');
    expect(card()).toHaveTextContent('target: 70%');
    expect(card()).toHaveTextContent('Body: CRIT Rate');
    // The proof is there, one tap below the row.
    expect(within(card()).getByText('Kit: Talent: “CRIT Rate up to 70%.”')).toBeInTheDocument();
    expect(within(card()).getByText('How: 50% + 20% = 70%')).toBeInTheDocument();

    fireEvent.click(within(card()).getByRole('button', { name: 'Enter totals' }));
    const form = await screen.findByRole('form', { name: 'Edit build of Older Star' });
    fireEvent.change(within(form).getByLabelText('CRIT Rate total'), { target: { value: '72.5%' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save build' }));
    expect(gameData('aa').builds?.c2?.totals).toEqual({ 'CRIT Rate': 72.5 });
    expect(card()).toHaveTextContent('you: 72.5%');
    expect(card()).toHaveTextContent('Reached');
    expect(within(card()).getByRole('button', { name: 'Edit totals' })).toBeInTheDocument();
  });

  it('Target stats says "No data yet" when the game text gives no number for a character', async () => {
    const game: GameContract = { ...makeGame(false), rules: { statTargets: () => ({ rows: [] }) } };
    await show('characters', game);
    fireEvent.click(screen.getByRole('button', { name: /^Older Star/ }));
    const page = await screen.findByRole('article', { name: 'Older Star' });
    expect(within(page).getByRole('region', { name: 'Target stats' })).toHaveTextContent('Targets: No data yet');
  });

  it('Build score: enter a build, see it on the page, fix a wrong number, edit, clear with Undo', async () => {
    const base = makeGame(false);
    const game: GameContract = {
      ...base,
      build: {
        levelMax: 80,
        weaponLevelMax: 80,
        refine: { name: 'Superimposition', max: 5 },
        slots: [
          { id: 'Head', label: 'Head', mains: ['HP'] },
          { id: 'Body', label: 'Body', mains: ['CRIT Rate', 'CRIT DMG'] },
        ],
        subStats: ['SPD', 'CRIT Rate'],
        skills: [{ name: 'Skill', max: 15 }],
      },
    };
    setRosterEntry('aa', 'c2', { owned: true, wanted: false, dupes: 0 });
    await show('characters', game);
    fireEvent.click(screen.getByRole('button', { name: /^Older Star/ }));
    const page = await screen.findByRole('article', { name: 'Older Star' });
    expect(within(page).getByText('No build saved yet')).toBeInTheDocument();
    expect(within(page).getByText('No data yet · enter it in Build score')).toBeInTheDocument();
    fireEvent.click(within(page).getByRole('button', { name: 'Enter build' }));
    const form = await screen.findByRole('form', { name: 'Edit build of Older Star' });
    // Typing keeps the cursor in the field (it used to jump out after the first letter).
    const cone = within(form).getByLabelText('Cone');
    cone.focus();
    for (const v of ['N', 'Ni', 'Nig']) fireEvent.change(cone, { target: { value: v } });
    expect(document.activeElement).toBe(cone);
    fireEvent.change(within(form).getByLabelText('Older Star’s level (1–80)'), { target: { value: '99' } });
    fireEvent.change(within(form).getByLabelText('Cone'), { target: { value: 'Night on the Milky Way' } });
    fireEvent.change(within(form).getByLabelText('Superimposition'), { target: { value: '2' } });
    fireEvent.change(within(form).getByLabelText('Body extra stat 1'), { target: { value: 'SPD' } });
    fireEvent.change(within(form).getByLabelText('Body extra stat 1 value'), { target: { value: '7.2' } });
    fireEvent.change(within(form).getAllByLabelText('Main stat')[1] as HTMLElement, { target: { value: 'CRIT Rate' } });
    fireEvent.change(within(form).getByLabelText('Skill (1–15)'), { target: { value: '10' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save build' }));
    // A wrong number is named, and nothing is saved.
    expect(within(form).getByRole('alert')).toHaveTextContent('Level must be a whole number from 1 to 80.');
    expect(gameData('aa').builds?.c2).toBeUndefined();
    fireEvent.change(within(form).getByLabelText('Older Star’s level (1–80)'), { target: { value: '80' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save build' }));
    expect(gameData('aa').builds?.c2).toMatchObject({
      level: 80,
      weapon: { name: 'Night on the Milky Way', refine: 2 },
      gear: [{ slot: 'Body', main: 'CRIT Rate', subs: [{ stat: 'SPD', value: 7.2 }] }],
      skills: { Skill: 10 },
      source: 'manual',
    });
    // On the page: level in the header, the build in Build score; no score until scoring exists.
    expect(within(page).getByText('of 80')).toBeInTheDocument();
    expect(within(page).getByText('CRIT Rate · SPD 7.2')).toBeInTheDocument();
    expect(within(page).getByText('No score yet · scoring is being built')).toBeInTheDocument();
    // Edit opens with what was saved.
    fireEvent.click(within(page).getByRole('button', { name: 'Edit build' }));
    const again = await screen.findByRole('form', { name: 'Edit build of Older Star' });
    expect(within(again).getByLabelText('Older Star’s level (1–80)')).toHaveValue('80');
    fireEvent.click(within(again).getByRole('button', { name: 'Cancel' }));
    // Clear, then Undo puts it back exactly.
    const before = gameData('aa').builds?.c2;
    fireEvent.click(within(page).getByRole('button', { name: 'Clear build' }));
    expect(gameData('aa').builds?.c2).toBeUndefined();
    fireEvent.click(within(page).getByRole('button', { name: 'Undo' }));
    expect(gameData('aa').builds?.c2).toEqual(before);
  });

  it('Make a team: after the first pick it suggests teammates by %, owned only by default; the switch adds the rest as theory', async () => {
    const calls: { includeUnowned?: boolean | undefined }[] = [];
    const base = makeGame(false);
    const game: GameContract = {
      ...base,
      rules: {
        teams: {
          method: 'Test method',
          rated: () => true,
          verdict: (members) => ({ rated: true, percent: members.length * 20, label: 'Good', count: members.length, best: 5, bestMembers: members, order: members, reasons: [], notes: [] }),
          whoFits: (_m, _a, opts) => {
            calls.push({ includeUnowned: opts?.includeUnowned });
            const owned = [{ id: 'c3', count: 2, how: ['buffs Newest Star'], withEveryone: true, percent: 70, fromAccount: ['E2 counted.'], theory: false }];
            return opts?.includeUnowned ? [...owned, { id: 'c2', count: 3, how: ['shreds'], withEveryone: true, percent: 90, fromAccount: ['Not owned: scored as theory at E0.'], theory: true }] : owned;
          },
          lineUps: () => [],
          ifYouPull: () => null,
        },
      },
    };
    setRosterEntry('aa', 'c1', { owned: true, wanted: false, dupes: 0 });
    setRosterEntry('aa', 'c3', { owned: true, wanted: false, dupes: 2 });
    await show('teams', game);
    fireEvent.click(screen.getByRole('button', { name: 'Make a team' }));
    const sheet = await screen.findByRole('dialog', { name: 'New team' });
    const box = within(sheet).getByRole('region', { name: 'Suggested teammates' });
    expect(within(box).getByText(/Pick a first character/)).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: /^Newest Star/ }));
    expect(within(box).queryByText(/Team now/)).not.toBeInTheDocument();
    expect(calls.at(-1)).toEqual({ includeUnowned: false });
    expect(within(box).getByRole('button', { name: 'Add Helper: team 70%' })).toBeInTheDocument();
    expect(within(box).queryByText(/Theory/)).not.toBeInTheDocument();
    fireEvent.click(within(box).getByRole('switch', { name: 'Include characters I don’t own' }));
    expect(calls.at(-1)).toEqual({ includeUnowned: true });
    expect(within(box).getByRole('button', { name: 'Add Older Star: team 90%, not owned, theory' })).toBeInTheDocument();
    fireEvent.click(within(box).getByRole('button', { name: 'Add Helper: team 70%' }));
    expect(within(sheet).getByText(/Picked/)).toHaveTextContent('Picked 2 of 4');
    expect(within(box).getByText('Team now: 40%')).toBeInTheDocument();
  });

  it('a game with team rules shows the synergy % and, on tap, every reason with its proof', async () => {
    const base = makeGame(false);
    const rules: TeamRules = {
      method: 'Test method',
      rated: (id) => id !== 'c4',
      verdict: (members) =>
        members.includes('c4')
          ? { rated: false, why: 'not rated yet: Shield Friend not read yet' }
          : {
              rated: true,
              percent: 90,
              label: 'Excellent',
              count: 9,
              best: 10,
              bestMembers: ['c1', 'c3', 'c2'],
              order: ['c1', 'c3', 'c2'],
              reasons: [{ points: 1, group: 'counted', text: 'Helper · Squad: +40% DMG: reaches Newest Star', proof: { who: 'Helper', skill: 'Additional Ability: Glow', quote: 'DMG dealt is increased by 40%' } }],
              notes: ['A higher count means more of the kits connect, not more damage.'],
            },
      whoFits: () => [],
      lineUps: () => [{ members: ['c1', 'c3'], count: 4, why: 'Newest Star > Helper counts 4' }],
      ifYouPull: () => ({ percent: 75, why: ['As a teammate: Newest Star goes from 3 to 4'] }),
    };
    await show('teams', { ...base, rules: { teams: rules } });
    const card = screen.getByRole('article', { name: 'Fire team' });
    expect(within(card).getByText('90%')).toBeInTheDocument();
    expect(within(card).getByText('synergy · Excellent')).toBeInTheDocument();
    fireEvent.click(within(card).getByText(/Why 90%: count 9 of 10/));
    expect(within(card).getByText(/Helper · Squad: \+40% DMG/)).toBeInTheDocument();
    expect(within(card).getByText(/Additional Ability: Glow: “DMG dealt is increased by 40%”/)).toBeInTheDocument();
    // Ideas come from the rules too: Line-ups and If you pull, no examples.
    expect(screen.getByRole('button', { name: 'Newest Star, Helper: count 4. Make it my team' })).toBeInTheDocument();
    expect(screen.getAllByText('75%').length).toBeGreaterThan(0);
    // Every kit read (no readSoFar, like ZZZ): no "read so far" line.
    expect(screen.queryByText(/are read so far/)).toBeNull();
  });

  it('while only some kits are read: a line with the counts from the rules, in Teams and Team fit, and no grade word', async () => {
    const base = makeGame(false);
    const rules = {
      method: 'Test method',
      rated: (id: string) => id !== 'c4',
      readSoFar: () => ({ read: 3, total: 4 }),
      verdict: () => ({ rated: true, percent: 100, label: '', count: 9, best: 9, bestMembers: ['c1', 'c3', 'c2'], order: ['c1', 'c3', 'c2'], reasons: [], notes: [] }),
      whoFits: () => [],
      lineUps: () => [],
      ifYouPull: () => null,
    } as TeamRules;
    const line = 'Only 3 of 4 characters are read so far. These teams will change as more are read.';
    await show('teams', { ...base, rules: { teams: rules } });
    const teams = screen.getByRole('region', { name: 'Recommended teams' });
    expect(within(teams).getByRole('note')).toHaveTextContent(line);
    const card = within(teams).getByRole('article', { name: 'Fire team' });
    expect(within(card).getByText('100%')).toBeInTheDocument();
    expect(within(card).getByText('synergy')).toBeInTheDocument();
    expect(within(card).queryByText(/synergy ·/)).toBeNull();
    cleanup();
    await show('characters', { ...base, rules: { teams: rules } });
    const page = await openPage('Newest Star');
    expect(within(within(page).getByRole('region', { name: 'Team fit' })).getByRole('note')).toHaveTextContent(line);
  });

  it('the character page shows how to build them, step by step, with pictures and the source', async () => {
    const base = makeGame(false);
    const builds = [
      {
        characterId: 'c1',
        source: "the game's own recommendation",
        sets: [
          { pieces: 4, options: ['Ember Set'] },
          { pieces: 2, options: ['Glow Set', 'Dim Set'] },
        ],
        mainStats: { Body: ['CRIT Rate'] },
        subStats: ['ATK %', 'CRIT DMG'],
        weapons: ['Spark Cone'],
        skillsFirst: [['Skill']],
        items: {
          'Ember Set': { icon: 'https://example.test/ember.webp', effects: [{ label: '2-piece', text: 'Fire DMG +10%' }, { label: '4-piece', text: 'Skill DMG +20%' }] },
          'Glow Set': { effects: [{ label: '2-piece', text: 'ATK +12%' }, { label: '4-piece', text: 'Never shown for 2 pieces' }] },
          'Spark Cone': { icon: 'https://example.test/cone.webp', rarity: 5, effects: [{ label: 'Spark (Superimposition 1)', text: 'CRIT Rate +18%' }] },
        },
      },
    ];
    await show('characters', { ...base, data: { ...base.data, builds: async () => builds } });
    const page = await openPage('Newest Star');
    const card = within(page).getByRole('region', { name: 'How to build Newest Star' });
    expect(await within(card).findByText('Ember Set')).toBeInTheDocument();
    expect(within(card).getByText('Skill DMG +20%')).toBeInTheDocument();
    // A 2-piece slot only shows the 2-piece effect.
    expect(within(card).getByText('ATK +12%')).toBeInTheDocument();
    expect(within(card).queryByText('Never shown for 2 pieces')).toBeNull();
    expect(within(card).getByText('Spark Cone')).toBeInTheDocument();
    expect(within(card).getByText('CRIT Rate +18%')).toBeInTheDocument();
    expect(card.querySelectorAll('img').length).toBe(2);
    expect(within(card).getByText("Source: the game's own recommendation.")).toBeInTheDocument();
  });

  it('long team lists stay short: a few first, the rest one tap away, nothing dropped', async () => {
    const many: TeamPreset[] = Array.from({ length: 9 }, (_, i) => ({ id: `t${i}`, name: `Team ${i + 1}`, slots: [{ characters: ['c1'] }, { characters: ['c3'] }], source: 'test' }));
    await show('teams', makeGame(false, many));
    const teams = screen.getByRole('region', { name: 'Recommended teams' });
    expect(within(teams).getAllByRole('article')).toHaveLength(6);
    fireEvent.click(within(teams).getByRole('button', { name: /Show 3 more/ }));
    expect(within(teams).getAllByRole('article')).toHaveLength(9);
    // A search finds a team by its name or a member's name.
    fireEvent.change(within(teams).getByLabelText('Find a team'), { target: { value: 'Team 9' } });
    expect(within(teams).getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toEqual(['Team 9']);
    cleanup();
    // The character page shows three teams, then "Show N more teams with …".
    await show('characters', makeGame(false, many));
    const page = await openPage('Newest Star');
    const fit = within(page).getByRole('region', { name: 'Team fit' });
    expect(within(fit).getAllByText(/^Team \d$/)).toHaveLength(3);
    fireEvent.click(within(fit).getByRole('button', { name: 'Show 6 more teams with Newest Star' }));
    expect(within(fit).getAllByText(/^Team \d$/)).toHaveLength(9);
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
