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

const show = async (tab: 'characters' | 'teams', game = makeGame(false)) => {
  render(<RosterScreen games={[game]} scope="aa" tab={tab} servers={{}} openTab={() => {}} open={() => {}} openAccount={() => {}} />);
  if (tab === 'characters') await screen.findByRole('list', { name: 'Characters' });
  else await screen.findByRole('region', { name: 'Recommended teams' });
};

const tileNames = () =>
  within(screen.getByRole('list', { name: 'Characters' }))
    .getAllByRole('button')
    .map((b) => b.getAttribute('aria-label'));

describe('Roster screen', () => {
  beforeEach(() => {
    localStorage.clear();
    resetUserData();
  });

  it('Characters shows every character, newest first', async () => {
    await show('characters');
    expect(tileNames()).toEqual(['Newest Star', 'Older Star', 'Helper', 'Shield Friend']);
    expect(screen.getAllByText('5★').length).toBeGreaterThan(0);
  });

  it('filters by element, owned and name', async () => {
    setRosterEntry('aa', 'c3', { owned: true, wanted: false, dupes: 0 });
    await show('characters');
    fireEvent.change(screen.getByLabelText('Element'), { target: { value: 'fire' } });
    expect(tileNames()).toEqual(['Newest Star', 'Helper, owned']);
    fireEvent.change(screen.getByLabelText('Show'), { target: { value: 'owned' } });
    expect(tileNames()).toEqual(['Helper, owned']);
    fireEvent.click(screen.getByText('Clear filters'));
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'shield' } });
    expect(tileNames()).toEqual(['Shield Friend']);
  });

  it('the character page saves owned, wanted and dupes to your data', async () => {
    await show('characters');
    fireEvent.click(screen.getByRole('button', { name: 'Older Star' }));
    const page = await screen.findByRole('dialog', { name: 'Older Star' });
    fireEvent.click(within(page).getByLabelText('Owned'));
    expect(gameData('aa').roster.c2).toEqual({ owned: true, wanted: false, dupes: 0 });
    fireEvent.click(within(page).getByRole('button', { name: 'One Eidolon more' }));
    fireEvent.click(within(page).getByLabelText('Wanted'));
    expect(gameData('aa').roster.c2).toEqual({ owned: true, wanted: true, dupes: 1 });
    expect(within(page).getByText('E1')).toBeInTheDocument();
    // Build and gear have no data in this game: honest "No data yet".
    expect(within(page).getAllByText('No data yet').length).toBeGreaterThan(1);
  });

  it('Teams shows preset slots with who you own, and leaves the fit score as "No data yet"', async () => {
    setRosterEntry('aa', 'c1', { owned: true, wanted: false, dupes: 0 });
    setRosterEntry('aa', 'c3', { owned: false, wanted: true, dupes: 0 });
    await show('teams');
    const card = screen.getByRole('heading', { name: 'Fire team' }).closest('article') as HTMLElement;
    expect(within(card.querySelector('[aria-label="Fit with your roster"]') as HTMLElement).getByText('No data yet')).toBeInTheDocument();
    expect(within(card).getByText('Newest Star').nextSibling).toHaveTextContent('owned');
    expect(within(card).getByText('Helper').nextSibling).toHaveTextContent('wanted');
    expect(within(card).getByText('Older Star').nextSibling).toHaveTextContent('not owned');
    expect(within(card).getByText('or Shield Friend')).toBeInTheDocument();
    expect(screen.queryByText('EXAMPLE')).not.toBeInTheDocument();
  });

  it('without presets, Teams shows example presets with an honest notice', async () => {
    await show('teams', makeGame(false, []));
    expect(screen.getByText(/Real recommended teams still have to be added by us/)).toBeInTheDocument();
    expect(screen.getAllByText('EXAMPLE').length).toBeGreaterThan(1);
    expect(screen.getByRole('heading', { name: /Newest Star team/ })).toBeInTheDocument();
  });

  it('you can make your own team from the characters you own', async () => {
    setRosterEntry('aa', 'c1', { owned: true, wanted: false, dupes: 0 });
    setRosterEntry('aa', 'c3', { owned: true, wanted: false, dupes: 0 });
    await show('teams');
    fireEvent.click(screen.getByRole('button', { name: 'New team' }));
    const sheet = await screen.findByRole('dialog', { name: 'New team' });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Newest Star' }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Helper' }));
    await act(async () => {
      fireEvent.click(within(sheet).getByRole('button', { name: 'Save team' }));
    });
    expect(gameData('aa').teams).toHaveLength(1);
    expect(gameData('aa').teams[0]?.members).toEqual(['c1', 'c3']);
  });

  it('Kit check says "No data yet" when the game has no kit data', async () => {
    await show('characters');
    fireEvent.click(screen.getByRole('button', { name: 'Newest Star' }));
    const kit = within(await screen.findByRole('dialog')).getByRole('region', { name: 'Kit check' });
    expect(within(kit).getByText('No data yet')).toBeInTheDocument();
  });

  it('Kit check shows what each skill does with the game text as proof', async () => {
    await show('characters', makeGame(true));
    fireEvent.click(screen.getByRole('button', { name: 'Newest Star' }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('Basic Attack: Ember')).toBeInTheDocument();
    expect(within(dialog).getByText('Swings twice, dealing Fire DMG.')).toBeInTheDocument();
    expect(within(dialog).getAllByText('fire damage').length).toBeGreaterThan(0);
  });

  it('Kit check also opens from a team in Teams', async () => {
    await show('teams', makeGame(true));
    fireEvent.click(screen.getByRole('button', { name: 'Kit check' }));
    const dialog = await screen.findByRole('dialog', { name: 'Kit check · Fire team' });
    expect(await within(dialog).findByText('Swings twice, dealing Fire DMG.')).toBeInTheDocument();
    // Members without kit data say so.
    expect(within(dialog).getAllByText('No data yet').length).toBe(2);
  });
});
