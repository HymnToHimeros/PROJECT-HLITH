import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameContract } from '../../core/contract';
import { resetUserData } from '../../core/data/userData';
import type { LiveStamina } from '../account-links/liveStamina';

let live: Record<string, LiveStamina> = {};
const retry = vi.fn();
vi.mock('../account-links/liveStamina', async (original) => ({
  ...(await original<typeof import('../account-links/liveStamina')>()),
  useLiveStamina: () => ({ stamina: live, retry }),
}));

const { default: TodayScreen } = await import('./TodayScreen');

const READ = Date.UTC(2026, 9, 7, 12);
const game = {
  id: 'aa',
  short: 'AA',
  name: 'Game A',
  vent: '#A99BFF',
  terms: { rarity: { top: '5★', mid: '4★' }, gear: 'Gear', weapon: 'Cone', skill: 'Skill', character: 'Character', endgame: [] },
  elements: [],
  roles: [],
  currencies: [{ id: 'gem', name: 'Gem', perPull: 160 }],
  stamina: [{ id: 'power', name: 'Power', max: 240, minutesPerPoint: 6 }],
  servers: [{ id: 'eu', label: 'Europe', utcOffset: 1 }],
  reset: { hour: 4, weekday: 1 },
  modules: ['today'],
  bannerTypes: [],
  income: [],
  historyImporters: [],
  accountLinks: [{ provider: 'hoyolab', supports: ['stamina'], config: { gameBiz: 'hkrpg_global' } }],
  data: { characters: async () => [], banners: async () => [], events: async () => [], versions: async () => [], backlog: async () => [] },
  rules: {},
  sources: [],
} as unknown as GameContract;

const props = (now: number) => ({ games: [game], scope: 'aa', servers: { aa: 'eu' }, openTab: () => {}, open: () => {}, openAccount: () => {}, now });
const tileOf = async () => (await screen.findByText('Power', { selector: 'span' })).closest('div')?.parentElement?.parentElement as HTMLElement;
const two = (n: number) => String(n).padStart(2, '0');
const clock = (ms: number) => `${two(new Date(ms).getHours())}:${two(new Date(ms).getMinutes())}`;

describe('Today: live stamina', () => {
  beforeEach(() => {
    localStorage.clear();
    resetUserData();
    retry.mockReset();
  });

  it('shows the live value, when it’s full and when HoYoLAB was read, counted forward between reads', async () => {
    live = { aa: { state: 'ok', reading: { current: 182, max: 240, fullInSeconds: 20_880, readAt: new Date(READ).toISOString() }, refreshing: false } };
    const { rerender } = render(<TodayScreen {...props(READ)} />);
    const tile = await tileOf();
    expect(within(tile).getByText('182/240')).toBeInTheDocument();
    expect(within(tile).getByText(`Full in 5 h 48 min · as of ${clock(READ)} (HoYoLAB)`)).toBeInTheDocument();
    rerender(<TodayScreen {...props(READ + 12 * 60_000)} />);
    expect(within(tile).getByText('184/240')).toBeInTheDocument();
    expect(within(tile).getByText(`Full in 5 h 36 min · counted on from HoYoLAB’s read at ${clock(READ)}`)).toBeInTheDocument();
  });

  it('an error shows the reason and a retry, never a number', async () => {
    live = { aa: { state: 'error', text: 'HoYoLAB is busy. Try again in a minute.' } };
    render(<TodayScreen {...props(READ)} />);
    const tile = await tileOf();
    expect(within(tile).getByRole('alert')).toHaveTextContent('Couldn’t read it: HoYoLAB is busy. Try again in a minute.');
    expect(within(tile).queryByText(/\/240/)).toBeNull();
    fireEvent.click(within(tile).getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledWith('aa');
  });

  it('a failed re-read keeps the last answer, shown as of its read time', async () => {
    live = { aa: { state: 'error', text: 'HoYoLAB is busy.', reading: { current: 100, max: 240, fullInSeconds: 50_400, readAt: new Date(READ).toISOString() } } };
    render(<TodayScreen {...props(READ + 60 * 60_000)} />);
    const tile = await tileOf();
    expect(within(tile).getByText('100/240')).toBeInTheDocument();
    expect(within(tile).getByText(new RegExp(`as of ${clock(READ)}`))).toBeInTheDocument();
    expect(within(tile).getByRole('alert')).toHaveTextContent('Couldn’t read it again: HoYoLAB is busy.');
  });

  it('no linked account: No data yet · Connect account', async () => {
    live = { aa: { state: 'none' } };
    render(<TodayScreen {...props(READ)} />);
    const tile = (await screen.findByText('Power', { selector: 'span' })).closest('div')?.parentElement as HTMLElement;
    expect(within(tile).getByText(/No data yet/)).toBeInTheDocument();
    expect(within(tile).getByRole('button', { name: 'Connect account' })).toBeInTheDocument();
  });
});
