import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Character, GameContract } from '../../core/contract';
import { gameData, resetUserData, setFarm } from '../../core/data/userData';
import FarmScreen from './FarmScreen';

const chars: Character[] = [
  { id: 'c1', name: 'Newest Star', rarity: 'top', element: 'e', role: 'r', releasedAt: '2026-09-01' },
  { id: 'c2', name: 'Helper', rarity: 'mid', element: 'e', role: 'r', releasedAt: '2025-01-01' },
];

const game = {
  id: 'aa',
  short: 'AA',
  name: 'Game A',
  vent: '#A99BFF',
  terms: { rarity: { top: '5★', mid: '4★' }, gear: 'Gear', weapon: 'Cone', skill: 'Skill', character: 'Character', endgame: [] },
  elements: [{ id: 'e', label: 'E', color: '#ffffff' }],
  roles: [{ id: 'r', label: 'R' }],
  currencies: [],
  stamina: [{ id: 'power', name: 'Power', max: 240, minutesPerPoint: 6 }],
  servers: [{ id: 'eu', label: 'Europe', utcOffset: 1 }],
  reset: { hour: 4, weekday: 1 },
  modules: ['farm'],
  bannerTypes: [],
  income: [],
  historyImporters: [],
  data: {
    characters: async () => chars,
    banners: async () => [],
    events: async () => [],
    versions: async () => [],
    backlog: async () => [],
    materials: async () => [],
  },
  rules: {},
  sources: [],
} as unknown as GameContract;

const show = () => render(<FarmScreen games={[game]} scope="aa" servers={{}} openTab={() => {}} open={() => {}} openAccount={() => {}} />);

describe('Farm', () => {
  beforeEach(() => {
    localStorage.clear();
    resetUserData();
  });

  it('the picker saves who you farm for, and removing works too', async () => {
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Add Newest Star' }));
    expect(gameData('aa').farm).toEqual(['c1']);
    expect(within(screen.getByLabelText('Chosen')).getByText('Newest Star')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'help' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Helper' }));
    expect(gameData('aa').farm).toEqual(['c1', 'c2']);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Newest Star' }));
    expect(gameData('aa').farm).toEqual(['c2']);
  });

  it('without material data: what you have and the totals say "No data yet"; example rows are marked', async () => {
    show();
    const stamina = await screen.findByLabelText('Stamina plan');
    // Nothing picked: nothing to add up, so no totals.
    expect(within(stamina).getAllByText(/No data yet/)).toHaveLength(2);
    expect(within(stamina).getByText('240')).toBeInTheDocument(); // refill per day comes straight from the record
    act(() => setFarm('aa', ['c1']));
    const materials = screen.getByLabelText('Materials');
    expect(within(materials).getAllByText(/No data yet/).length).toBeGreaterThan(0);
    expect(within(materials).getAllByText('EXAMPLE').length).toBeGreaterThan(0);
    expect(screen.getByText(/Example data, not yours/)).toBeInTheDocument();
    // Gear needs build data that isn't there: honest empty, never a guess.
    expect(within(screen.getByLabelText('Gear to farm')).getByText(/No data yet/)).toBeInTheDocument();
  });
});
