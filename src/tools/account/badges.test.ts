import { describe, expect, it } from 'vitest';
import type { GameContract, PullRecord } from '../../core/contract';
import { EMPTY_GAME, type GameUserData } from '../../core/data/userData';
import { badgeStates, longestRun, shownBadge, type BadgeInput } from './badges';

const game = (id: string, teamSize = 4) =>
  ({
    id,
    teamSize,
    bannerTypes: [{ id: 'char', label: 'Character', pity: { kind: 'hard-pity', hardPity: 90, baseRate: 0.006 } }],
  }) as unknown as GameContract;

const pull = (n: number, rarity: PullRecord['rarity'] = 'low', day = 1): PullRecord => ({
  id: String(n).padStart(5, '0'),
  bannerType: 'char',
  itemId: 'x',
  name: 'x',
  rarity,
  time: `2025-01-${String(day).padStart(2, '0')}T00:00:${String(n % 60).padStart(2, '0')}Z`,
});

const run = (data: Record<string, Partial<GameUserData>>, over: Partial<BadgeInput> = {}) =>
  badgeStates({
    games: [game('aa'), game('bb', 3)],
    data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, { ...EMPTY_GAME, ...v }])),
    isOwner: false,
    checkinDays: null,
    profile: { hasPicture: false, hasTitle: false },
    ...over,
  });
const earned = (states: ReturnType<typeof run>) => states.filter((s) => s.earned).map((s) => s.def.id);

describe('profile badges (T52)', () => {
  it('with no data, only the high seat is earned; everything else is "not yet"', () => {
    const s = run({});
    expect(earned(s)).toEqual(['seated']);
    expect(s.length).toBeGreaterThan(10);
  });

  it('the owner badge exists only when the server said owner, and is never in anyone else’s list', () => {
    expect(run({}).some((s) => s.def.id === 'owner')).toBe(false);
    const owner = run({}, { isOwner: true });
    expect(earned(owner)).toEqual(['owner', 'seated']);
    expect(shownBadge(owner, null)).toBe('owner');
    expect(shownBadge(run({}), null)).toBe('seated');
  });

  it('pull badges come from imported history, with the date from the pull itself', () => {
    const pulls = [...Array.from({ length: 99 }, (_, i) => pull(i)), pull(99, 'top', 5)];
    const s = run({ aa: { pulls } });
    expect(earned(s)).toEqual(expect.arrayContaining(['first-light', 'hundred']));
    expect(earned(s)).not.toContain('thousand');
    expect(s.find((x) => x.def.id === 'first-light')?.at).toBe(pull(99, 'top', 5).time);
  });

  it('hard pity counts only when the whole run is in the history (after an earlier top)', () => {
    // First top at pull 90 of the history: the count may have started before the import, so it isn't proven.
    const first = [...Array.from({ length: 89 }, (_, i) => pull(i)), pull(89, 'top', 2)];
    expect(earned(run({ aa: { pulls: first } }))).not.toContain('storm');
    // A full 90 after an earlier top: proven.
    const proven = [pull(0, 'top', 1), ...Array.from({ length: 89 }, (_, i) => pull(i + 1, 'low', 2)), pull(90, 'top', 3)];
    expect(earned(run({ aa: { pulls: proven } }))).toContain('storm');
    // 89 isn't 90.
    const short = [pull(0, 'top', 1), ...Array.from({ length: 88 }, (_, i) => pull(i + 1, 'low', 2)), pull(89, 'top', 3)];
    expect(earned(run({ aa: { pulls: short } }))).not.toContain('storm');
  });

  it('a full team uses each game’s own team size', () => {
    expect(earned(run({ aa: { teams: [{ id: 't', name: 'T', members: ['a', 'b', 'c'] }] } }))).not.toContain('shield-wall');
    expect(earned(run({ bb: { teams: [{ id: 't', name: 'T', members: ['a', 'b', 'c'] }] } }))).toContain('shield-wall');
  });

  it('two games with real data make Between Worlds; module firsts come from each module’s own data', () => {
    const s = run({
      aa: { roster: { c1: { owned: true, wanted: false, dupes: 0 } }, farm: ['c1'] },
      bb: { pulls: [pull(1)], ledger: [{ id: 'l', at: '2025-02-01T00:00:00Z', currency: 'gem', kind: 'have', amount: 5 }] },
    });
    expect(earned(s)).toEqual(expect.arrayContaining(['between-worlds', 'hall', 'gatherer', 'treasurer']));
    expect(earned(s)).not.toContain('sagas');
    expect(s.find((x) => x.def.id === 'treasurer')?.at).toBe('2025-02-01T00:00:00Z');
  });

  it('thirty dawns needs 30 days in a row from real check-ins; none known = not yet', () => {
    const days = Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10));
    expect(longestRun(days)).toBe(30);
    expect(longestRun([...days.slice(0, 10), ...days.slice(11)])).toBe(19);
    expect(earned(run({}, { checkinDays: days }))).toContain('thirty-dawns');
    expect(earned(run({}, { checkinDays: days.slice(1) }))).not.toContain('thirty-dawns');
  });

  it('a pinned badge shows only while it is earned', () => {
    const s = run({ aa: { roster: { c1: { owned: true, wanted: false, dupes: 0 } } } });
    expect(shownBadge(s, 'hall')).toBe('hall');
    expect(shownBadge(s, 'thousand')).toBe('seated');
  });
});
