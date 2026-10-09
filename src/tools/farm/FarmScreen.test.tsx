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
    expect(within(await screen.findByLabelText('Chosen')).getByText('Newest Star')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'help' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Helper' }));
    expect(gameData('aa').farm).toEqual(['c1', 'c2']);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Newest Star' }));
    expect(gameData('aa').farm).toEqual(['c2']);
  });

  it('nothing chosen: the dashed "Nothing chosen" card and no totals', async () => {
    show();
    expect(await screen.findByText('NOTHING CHOSEN')).toBeInTheDocument();
    expect(screen.queryByLabelText('Stamina plan')).not.toBeInTheDocument();
  });

  it('with the game material rule: real need, "have" left as no data, and no example notice', async () => {
    const real = {
      ...game,
      data: { ...game.data, materials: async () => [{ id: 'm1', name: 'Boss core', kind: 'ascension', dropsPerRun: 2, staminaPerRun: 40 }] },
      rules: { materialsFor: () => [{ material: 'm1', amount: 10 }] },
    } as unknown as GameContract;
    setFarm('aa', ['c1']);
    render(<FarmScreen games={[real]} scope="aa" servers={{}} openTab={() => {}} open={() => {}} openAccount={() => {}} />);
    const materials = await screen.findByLabelText('Materials');
    expect(within(materials).getByText('Boss core')).toBeInTheDocument();
    expect(within(materials).getByText('—/10')).toBeInTheDocument();
    expect(within(materials).getByText('5 runs · 200 stamina')).toBeInTheDocument();
    expect(within(materials).getByText('Have: no data yet')).toBeInTheDocument();
    expect(within(screen.getByLabelText('Stamina plan')).getByText('200')).toBeInTheDocument();
    expect(screen.queryByText(/Example data, not yours/)).not.toBeInTheDocument();
  });

  it('without material data: example rows, stamina and days are marked; gear says "No data yet"', async () => {
    show();
    await screen.findByText('NOTHING CHOSEN');
    act(() => setFarm('aa', ['c1']));
    const stamina = screen.getByLabelText('Stamina plan');
    expect(within(stamina).getByText(/at 240 Power a day/)).toBeInTheDocument(); // refill per day comes straight from the record
    expect(within(stamina).getAllByText('EXAMPLE').length).toBeGreaterThan(0);
    const materials = screen.getByLabelText('Materials');
    expect(within(materials).getAllByText('EXAMPLE').length).toBeGreaterThan(0);
    expect(screen.getByText(/Example data, not yours/)).toBeInTheDocument();
    // Gear needs build data that isn't there: honest empty, never a guess.
    expect(within(screen.getByLabelText('Gear to farm')).getByText(/No data yet/)).toBeInTheDocument();
  });
});
