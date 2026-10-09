import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { BacklogItem, GameContract } from '../../core/contract';
import { gameData, resetUserData } from '../../core/data/userData';
import BacklogScreen from './BacklogScreen';

const makeGame = (backlog: BacklogItem[] = []): GameContract =>
  ({
    id: 'aa',
    short: 'AA',
    name: 'Game A',
    vent: '#A99BFF',
    terms: { rarity: { top: '5★', mid: '4★' }, gear: 'G', weapon: 'Cone', skill: 'S', character: 'Hero', endgame: [] },
    elements: [],
    roles: [],
    currencies: [
      { id: 'gem', name: 'Gem', perPull: 160 },
      { id: 'ticket', name: 'Ticket', pullItemFor: ['character'] },
    ],
    teamSize: 4,
    stamina: [],
    servers: [{ id: 'eu', label: 'Europe', utcOffset: 1 }],
    reset: { hour: 4, weekday: 1 },
    modules: ['backlog'],
    bannerTypes: [{ id: 'character', label: 'Character banner', pullItem: 'ticket', target: 'character', pity: { kind: 'hard-pity', hardPity: 90, baseRate: 0.006 } }],
    income: [],
    historyImporters: [],
    data: {
      characters: async () => [],
      banners: async () => [],
      events: async () => [],
      versions: async () => [],
      backlog: async () => backlog,
      materials: async () => [],
      teams: async () => [],
    },
    rules: {},
    sources: [],
  }) as unknown as GameContract;

let opened: [string, string | undefined] | null = null;
const show = async (game = makeGame()) => {
  render(
    <BacklogScreen
      games={[game]}
      scope="aa"
      servers={{}}
      openTab={() => {}}
      open={(m, t) => {
        opened = [m, t];
      }}
      openAccount={() => {}}
    />,
  );
  await screen.findByText('Backlog could add about');
};
const summary = () => screen.getByRole('region', { name: 'Backlog could add' });

describe('Backlog screen', () => {
  beforeEach(() => {
    localStorage.clear();
    resetUserData();
    opened = null;
  });

  it('shows the example backlog by category, clearly marked', async () => {
    await show();
    expect(screen.getByText(/Example data, not yours/)).toBeInTheDocument();
    expect(screen.getByText(/still has to be added by us/)).toBeInTheDocument();
    for (const c of ['Story', 'Side quests', 'Exploration', 'Modes', 'Achievements']) expect(screen.getByRole('region', { name: c })).toBeInTheDocument();
    expect(screen.getByText('Hero stories')).toBeInTheDocument();
    expect(screen.getAllByText('EXAMPLE').length).toBeGreaterThan(3);
    // An item with an unknown reward says so instead of guessing.
    expect(within(screen.getByRole('region', { name: 'Side quests' })).getByText(/No data yet/)).toBeInTheDocument();
    fireEvent.click(within(summary()).getByRole('button', { name: 'Open calculator' }));
    expect(opened).toEqual(['pulls', 'calculator']);
  });

  it('editing a done count saves it', async () => {
    await show();
    fireEvent.click(screen.getByRole('button', { name: 'Edit done count for Main story chapters' }));
    fireEvent.change(screen.getByLabelText('Done for Main story chapters'), { target: { value: '40' } });
    expect(gameData('aa').backlog['example-story-main']).toBe(40);
    expect(screen.getByText('40/52')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'One more done for Main story chapters' }));
    expect(gameData('aa').backlog['example-story-main']).toBe(41);
    fireEvent.click(screen.getByRole('button', { name: 'All done' }));
    expect(gameData('aa').backlog['example-story-main']).toBe(52);
  });

  it('switching a category off removes it from the pull estimate', async () => {
    await show();
    // Rewards left: 840 + 570 + 701 + 425 + 720 + 868 = 4,124 Gem → 25 pulls.
    expect(within(summary()).getByText('+25')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: 'Count Achievements toward pulls' }));
    expect(gameData('aa').backlogOff).toEqual(['achievements']);
    // Without achievements (868): 3,256 Gem → 20 pulls.
    expect(within(summary()).getByText('+20')).toBeInTheDocument();
    expect(within(summary()).getByText(/switched off: about 5 more pulls/)).toBeInTheDocument();
  });

  it('a real list with no progress entered shows No data yet, never 0', async () => {
    await show(makeGame([{ id: 'b1', category: 'story', title: 'Chapter one', total: 10, reward: 600, currency: 'gem' }]));
    expect(screen.queryByText(/Example data, not yours/)).not.toBeInTheDocument();
    expect(screen.queryByText('0/10')).not.toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Story' })).getAllByText(/No data yet/).length).toBeGreaterThan(0);
    expect(within(summary()).getByText(/No data yet/)).toBeInTheDocument();
  });
});
