import { describe, expect, it } from 'vitest';
import type { PullRecord } from '../../core/contract';
import { EMPTY_GAME } from '../../core/data/userData';
import { fakeGame } from '../account-links/fakeGame';
import { gameNumbers, luckiestPull, winRate } from './cardExtras';

const pull = (id: number, rarity: PullRecord['rarity'], featured?: boolean, bannerType = 'char'): PullRecord => ({
  id: String(id),
  bannerType,
  itemId: rarity === 'top' ? `c${id}` : 'x',
  name: rarity === 'top' ? `Top ${id}` : 'X',
  rarity,
  time: `2026-01-01T00:00:0${id}Z`,
  ...(featured === undefined ? {} : { featured }),
});
// The same history the server was checked with on local Postgres (0018): lost, guaranteed, won.
const history = [pull(1, 'low'), pull(2, 'top', false), pull(3, 'low'), pull(4, 'top', true), pull(5, 'low'), pull(6, 'low'), pull(7, 'top', true)];

describe('more on the profile card (T64 B2)', () => {
  const game = fakeGame();
  const data = { [game.id]: { ...EMPTY_GAME, pulls: history } };

  it('the luckiest pull is the provable top result after the fewest pulls', () => {
    // Top 2 came on pull 2, but the count before the first top may include pulls never imported.
    expect(luckiestPull([game], data)).toEqual({ game: game.id, itemId: 'c4', name: 'Top 4', bannerType: 'char', pulls: 2, time: '2026-01-01T00:00:04Z' });
    expect(luckiestPull([game], { [game.id]: { ...EMPTY_GAME, pulls: [pull(1, 'top', true)] } })).toBeNull();
    expect(luckiestPull([game], {})).toBeNull();
  });

  it('pull numbers: average pulls per top result and the 50/50 record (a guaranteed result is no 50/50)', () => {
    const [n] = gameNumbers([game], data);
    expect(n).toMatchObject({ total: 7, tops: 3, won: 1, lost: 1 });
    expect(n?.averagePity).toBeCloseTo(7 / 3);
    expect(winRate({ won: 1, lost: 1 })).toBe(0.5);
  });

  it('nothing is made up: no pulls, no numbers; no known 50/50, no rate', () => {
    expect(gameNumbers([game], {})).toEqual([]);
    const [n] = gameNumbers([game], { [game.id]: { ...EMPTY_GAME, pulls: [pull(1, 'low'), pull(2, 'top')] } });
    expect(n).toMatchObject({ won: 0, lost: 0 });
    expect(winRate({ won: 0, lost: 0 })).toBeNull();
    const [none] = gameNumbers([game], { [game.id]: { ...EMPTY_GAME, pulls: [pull(1, 'low')] } });
    expect(none?.averagePity).toBeNull();
  });
});
