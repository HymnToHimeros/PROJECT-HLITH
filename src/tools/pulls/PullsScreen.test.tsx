import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Character, GameContract } from '../../core/contract';
import { gameData, resetUserData } from '../../core/data/userData';
import PullsScreen from './PullsScreen';

const chars: Character[] = [
  {
    id: 'c1',
    name: 'Newest Star',
    rarity: 'top',
    element: 'e',
    role: 'r',
    releasedAt: '2026-09-01',
  },
  {
    id: 'c2',
    name: 'Older Star',
    rarity: 'top',
    element: 'e',
    role: 'r',
    releasedAt: '2025-01-01',
  },
  { id: 'c3', name: 'Helper', rarity: 'mid', element: 'e', role: 'r' },
];

const game: GameContract = {
  id: 'aa',
  short: 'AA',
  name: 'Game A',
  vent: '#A99BFF',
  terms: {
    rarity: { top: '5★', mid: '4★' },
    gear: 'G',
    weapon: 'Cone',
    skill: 'S',
    character: 'C',
    endgame: [],
  },
  elements: [{ id: 'e', label: 'E', color: '#ffffff' }],
  roles: [{ id: 'r', label: 'R' }],
  currencies: [
    { id: 'gem', name: 'Gem', perPull: 160 },
    { id: 'ticket', name: 'Ticket', pullItemFor: ['character'] },
  ],
  stamina: [],
  servers: [{ id: 'eu', label: 'Europe', utcOffset: 1 }],
  reset: { hour: 4, weekday: 1 },
  modules: ['pulls'],
  bannerTypes: [
    {
      id: 'character',
      label: 'Character banner',
      pullItem: 'ticket',
      target: 'character',
      pity: {
        kind: 'hard-pity',
        hardPity: 90,
        baseRate: 0.006,
        featured: { winRate: 0.5, guaranteeAfterLoss: true },
      },
    },
  ],
  income: [],
  historyImporters: [{ id: 'uigf-v4', kind: 'file', label: 'UIGF v4 export file' }],
  historyMapping: {
    uigfKey: 'hkrpg',
    gachaTypes: { '11': 'character' },
    rarity: { '5': 'top', '4': 'mid', '3': 'low' },
  },
  data: {
    characters: async () => chars,
    banners: async () => [],
    events: async () => [],
    versions: async () => [],
    backlog: async () => [],
  },
  rules: [],
  sources: [],
} as unknown as GameContract;

const show = async (tab: string) => {
  render(<PullsScreen games={[game]} scope="aa" tab={tab} servers={{ aa: 'eu' }} openTab={() => {}} open={() => {}} openAccount={() => {}} />);
  await screen.findByText(/Example data, not yours/);
};

describe('Pulls screen', () => {
  beforeEach(() => {
    localStorage.clear();
    resetUserData();
  });

  it('Planner shows example banners, built from the game’s newest character, clearly marked', async () => {
    await show('planner');
    expect(screen.getByText('Newest Star')).toBeInTheDocument();
    expect(screen.getAllByText('EXAMPLE').length).toBeGreaterThan(1);
    expect(screen.getByText(/Chance by end · official rates/)).toBeInTheDocument();
  });

  it('History shows the example pity and a Luck report card', async () => {
    await show('history');
    expect(screen.getByLabelText('Luck report')).toBeInTheDocument();
    expect(screen.getByText('18/90')).toBeInTheDocument();
    expect(screen.getByText('lost 50/50')).toBeInTheDocument();
  });

  it('Bank log: your first entry replaces the example balance and is stored', async () => {
    await show('log');
    fireEvent.change(screen.getByPlaceholderText('e.g. 8400'), {
      target: { value: '1,234' },
    });
    await act(async () => {
      fireEvent.submit(screen.getByPlaceholderText('e.g. 8400').closest('form') as HTMLFormElement);
    });
    expect(gameData('aa').ledger).toHaveLength(1);
    expect(screen.getAllByText('1,234').length).toBeGreaterThan(0);
  });
});
