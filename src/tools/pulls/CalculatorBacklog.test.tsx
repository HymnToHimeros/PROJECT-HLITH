import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { BacklogItem, GameContract } from '../../core/contract';
import { updatePrefs } from '../../core/data/prefs';
import { resetUserData, setBacklogCategory, setBacklogDone } from '../../core/data/userData';
import PullsScreen from './PullsScreen';

const versions = [{ id: '1.0', start: new Date(Date.now() - 10 * 86_400_000).toISOString(), end: new Date(Date.now() + 20 * 86_400_000).toISOString() }];

const makeGame = (backlog: BacklogItem[]): GameContract =>
  ({
    id: 'aa',
    short: 'AA',
    name: 'Game A',
    vent: '#A99BFF',
    terms: { rarity: { top: '5★', mid: '4★' }, gear: 'G', weapon: 'Cone', skill: 'S', character: 'C', endgame: [] },
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
    modules: ['pulls'],
    bannerTypes: [{ id: 'character', label: 'Character banner', pullItem: 'ticket', target: 'character', pity: { kind: 'hard-pity', hardPity: 90, baseRate: 0.006 } }],
    income: [],
    historyImporters: [],
    data: { characters: async () => [], banners: async () => [], events: async () => [], versions: async () => versions, backlog: async () => backlog },
    rules: [],
    sources: [],
  }) as unknown as GameContract;

const show = async (game: GameContract) => {
  render(<PullsScreen games={[game]} scope="aa" tab="calculator" servers={{ aa: 'eu' }} openTab={() => {}} open={() => {}} openAccount={() => {}} />);
  await screen.findByText('Budget to version end');
};

describe('Calculator: Backlog rows', () => {
  beforeEach(() => {
    localStorage.clear();
    resetUserData();
    updatePrefs((p) => ({ ...p, hideExamples: false }));
  });

  it('with examples hidden and no items of your own, still shows a Backlog row with no data', async () => {
    updatePrefs((p) => ({ ...p, hideExamples: true }));
    await show(makeGame([]));
    expect(screen.getByText('Backlog')).toBeInTheDocument();
    expect(screen.getByText(/no items yet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Backlog' })).toBeInTheDocument();
  });

  it('a switched-off category names its currency and pulls; a checklist-only category gets no switch', async () => {
    await show(
      makeGame([
        { id: 'm1', category: 'modes', title: 'Mode', total: 100, reward: 3200, currency: 'gem' },
        { id: 's1', category: 'story', title: 'Story', total: 3, reward: 0, currency: 'gem', steps: ['a', 'b', 'c'] },
      ]),
    );
    act(() => setBacklogDone('aa', 'm1', 0));
    act(() => setBacklogCategory('aa', 'modes', false));
    expect(await screen.findByText('Switched off · about 20 pulls (3,200 Gem) left if you count it')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Count Backlog: Modes' })).toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Count Backlog: Main story' })).not.toBeInTheDocument();
  });
});
