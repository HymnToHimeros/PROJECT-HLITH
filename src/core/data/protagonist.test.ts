import { beforeEach, describe, expect, it } from 'vitest';
import type { Character, GameContract, TeamAccount } from '../contract';
import { chooseProtagonist, hiddenBy, withProtagonist } from './protagonist';
import { getPrefs, reloadPrefs } from './prefs';
import { gameData, resetUserData, setRosterEntry } from './userData';

const chars: Character[] = [
  { id: 'a-fire', name: 'Hero · Fire (Ann)', rarity: 'top', element: 'e', role: 'r' },
  { id: 'b-fire', name: 'Hero · Fire (Bo)', rarity: 'top', element: 'e', role: 'r' },
  { id: 'a-ice', name: 'Hero · Ice (Ann)', rarity: 'top', element: 'e', role: 'r' },
  { id: 'b-ice', name: 'Hero · Ice (Bo)', rarity: 'top', element: 'e', role: 'r' },
  { id: 'friend', name: 'Friend', rarity: 'mid', element: 'e', role: 'r' },
];

const game = {
  id: 'aa',
  short: 'AA',
  name: 'Game A',
  protagonist: {
    label: 'Hero',
    options: [
      { id: 'ann', name: 'Ann' },
      { id: 'bo', name: 'Bo' },
    ],
    of: (c: Character) => {
      const m = /^(Hero · .+) \((Ann|Bo)\)$/.exec(c.name);
      return m?.[1] && m[2] ? { option: m[2].toLowerCase(), form: m[1] } : undefined;
    },
  },
  data: {
    characters: async () => chars,
    teams: async () => [{ id: 't', name: 'Team', source: 'game', slots: [{ characters: ['b-fire', 'a-fire'] }, { characters: ['friend'] }] }],
    kits: async () => chars.map((c) => ({ characterId: c.id, skills: [] })),
  },
  rules: {
    teams: {
      method: 'm',
      rated: () => true,
      verdict: () => ({ rated: false, why: '' }),
      whoFits: () => [
        { id: 'b-ice', count: 2, how: [], withEveryone: true },
        { id: 'friend', count: 1, how: [], withEveryone: true },
      ],
      lineUps: () => [
        { members: ['b-fire', 'friend'], count: 2, why: '' },
        { members: ['a-fire', 'friend'], count: 2, why: '' },
      ],
      ifYouPull: () => null,
    },
  },
} as unknown as GameContract;

const account = {} as TeamAccount;
const ids = async (g: GameContract) => (await g.data.characters()).map((c) => c.id);

describe('your main character (T27)', () => {
  beforeEach(() => {
    localStorage.clear();
    reloadPrefs();
    resetUserData();
  });

  it('without a pick the game is unchanged', async () => {
    expect(withProtagonist(game, undefined)).toBe(game);
    expect(withProtagonist(game, 'nobody')).toBe(game);
    expect(await ids(game)).toHaveLength(5);
  });

  it('hides the other one everywhere and keeps the same object for the same pick', async () => {
    const g = withProtagonist(game, 'ann');
    expect(withProtagonist(game, 'ann')).toBe(g);
    expect(await ids(g)).toEqual(['a-fire', 'a-ice', 'friend']);
    expect((await g.data.kits?.())?.map((k) => k.characterId)).toEqual(['a-fire', 'a-ice', 'friend']);
    // Game teams use your pick's matching form, never the same one twice.
    expect((await g.data.teams())[0]?.slots).toEqual([{ characters: ['a-fire'] }, { characters: ['friend'] }]);
    expect(g.rules.teams?.whoFits([], account).map((s) => s.id)).toEqual(['friend']);
    expect(g.rules.teams?.lineUps(account).map((i) => i.members)).toEqual([['a-fire', 'friend']]);
    // For team rules (TeamAccount.skip).
    expect(['a-fire', 'b-fire', 'b-ice', 'friend'].map(hiddenBy(g))).toEqual([false, true, true, false]);
    expect(hiddenBy(game)('b-fire')).toBe(false);
  });

  it('picking marks yours owned, except where you set it yourself; nothing else is touched', async () => {
    setRosterEntry('aa', 'a-ice', { owned: false, wanted: true, dupes: 0 });
    setRosterEntry('aa', 'b-fire', { owned: true, wanted: false, dupes: 3 });
    // Loading alone writes nothing (sync may not have brought your roster in yet).
    await ids(withProtagonist(game, 'ann'));
    expect(gameData('aa').roster['a-fire']).toBeUndefined();
    // Picked from a screen that still sees the other one's game: yours are found all the same.
    await chooseProtagonist(withProtagonist(game, 'bo'), 'ann');
    const roster = gameData('aa').roster;
    expect(roster['a-fire']).toEqual({ owned: true, wanted: false, dupes: 0 });
    expect(roster['a-ice']).toEqual({ owned: false, wanted: true, dupes: 0 });
    // The other one's saved data stays, hidden; switching back shows it again.
    expect(roster['b-fire']).toEqual({ owned: true, wanted: false, dupes: 3 });
    expect(await ids(withProtagonist(game, 'bo'))).toEqual(['b-fire', 'b-ice', 'friend']);
    expect(gameData('aa').roster['b-fire']).toEqual({ owned: true, wanted: false, dupes: 3 });
  });

  it('the pick is saved with your settings', async () => {
    await chooseProtagonist(game, 'bo');
    expect(getPrefs().protagonists).toEqual({ aa: 'bo' });
  });
});
