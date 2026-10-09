import { beforeEach, describe, expect, it } from 'vitest';
import { addLedgerEntry, gameData, resetUserData, setBacklogCategory, setEventProgress, setRosterEntry, setTick } from './userData';

describe('your game data', () => {
  beforeEach(() => resetUserData());

  it('starts every field empty and keeps what you add', () => {
    expect(gameData('aa').roster).toEqual({});
    addLedgerEntry('aa', { at: '2026-10-09T10:00:00Z', currency: 'gem', kind: 'have', amount: 100 });
    setEventProgress('aa', 'ev1', { state: 'done' });
    setRosterEntry('aa', 'c1', { owned: true, wanted: false, dupes: 2 });
    expect(gameData('aa').ledger).toHaveLength(1);
    expect(gameData('aa').events.ev1?.state).toBe('done');
    expect(gameData('aa').roster.c1?.dupes).toBe(2);
  });

  it('switching a backlog category off and on never duplicates it', () => {
    setBacklogCategory('aa', 'story', false);
    setBacklogCategory('aa', 'story', false);
    expect(gameData('aa').backlogOff).toEqual(['story']);
    setBacklogCategory('aa', 'story', true);
    expect(gameData('aa').backlogOff).toEqual([]);
  });

  it('a tick can be set and cleared', () => {
    setTick('aa', 'daily', '2026-10-09T10:00:00Z');
    expect(gameData('aa').ticks.daily).toBeDefined();
    setTick('aa', 'daily', null);
    expect(gameData('aa').ticks.daily).toBeUndefined();
  });

  it('returns the same object until something changes (no needless redraws)', () => {
    expect(gameData('bb')).toBe(gameData('bb'));
  });
});
