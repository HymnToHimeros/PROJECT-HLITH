import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { BacklogItem, GameContract } from '../../core/contract';
import { gameData, resetUserData, setBacklogDone } from '../../core/data/userData';
import { mergeOwnItems } from '../edit-mode/merge';
import { applyImport, categoryId, exportBacklog, looksLikeBacklogFile, ownIdFor, parseBacklogFile, planImport, TEMPLATE, undoImport, type FileRow } from './backlogFile';
import { ImportPanel } from './OldImport';

// The old app's real shape (docs/imports/2026-10-12-backlog-list-hsr-zzz.json on manager/jobs-list), with progress added.
const file = (rows: Record<string, unknown>[], extra: Record<string, unknown> = {}) =>
  JSON.stringify({ format: 'hlith-backlog-export', version: 1, source: 'Gacha Tracker (old app)', dataAsOf: '2026-10-02T08:00:00.000Z', notes: ['Progress is from 2–3 Oct.'], backlog: rows, ...extra });
const FULL = { id: 'hm_divergent_universe_arcadia', game: 'aa', category: 'Modes', label: 'Divergent Universe: Arcadian Chronicles', total: 4000, done: 1200, rewardEach: 1, unit: 'Stellar Jade', step: 100, where: 'Penacony', note: 'total worked out from the in-game percentage' };
const quest = (id: string, done?: number) => ({ id, game: 'aa', category: 'Side quests', label: `Quest ${id}`, total: 1, rewardEach: 60, unit: 'mission', ...(done === undefined ? {} : { done }) });
const rowsOf = (text: string): FileRow[] => {
  const p = parseBacklogFile(text);
  if (!p.ok) throw new Error(p.error);
  return p.value.rows;
};
const state = () => ({ aa: { own: gameData('aa').ownItems.backlog, progress: gameData('aa').backlog } });
const game = { id: 'aa', short: 'AA', name: 'Game A', currencies: [{ id: 'gem', name: 'Gem', perPull: 160 }], data: { backlog: async () => [] as BacklogItem[] } } as unknown as GameContract;

describe('backlog files: import (T73)', () => {
  beforeEach(() => resetUserData());

  it('reads the format and its date; anything else says what it must be', () => {
    const p = parseBacklogFile(file([FULL]));
    expect(p.ok && p.value.asOf).toBe('2026-10-02T08:00:00.000Z');
    expect(parseBacklogFile('{"format":"uigf"}')).toEqual({ ok: false, error: 'This isn’t a backlog file (its "format" must be "hlith-backlog-export").' });
    expect(looksLikeBacklogFile(file([]))).toBe(true);
    expect(categoryId('Side quests')).toBe('side-quests');
    expect(categoryId('Main story')).toBe('story');
    expect(categoryId('Story')).toBe('story');
    expect(categoryId('My Raids!')).toBe('my-raids');
  });

  it('every row becomes your own item, in full, with its progress; Undo hides what it added', () => {
    const plan = planImport(rowsOf(file([FULL, quest('hq_a', 1), quest('hq_b'), { ...quest('lost'), game: 'zz' }])), state());
    expect(plan.add).toHaveLength(3);
    expect(plan.addWithProgress).toBe(2);
    expect(plan.otherGame).toBe(1);
    const undo = applyImport(plan, () => 'gem');
    const id = ownIdFor(FULL);
    expect(gameData('aa').ownItems.backlog[id]).toMatchObject({
      mine: true,
      hidden: false,
      fields: { title: FULL.label, category: 'modes', total: 4000, reward: 4000, currency: 'gem', unit: 'Stellar Jade', step: 100, group: 'Penacony', note: FULL.note },
    });
    expect(gameData('aa').backlog[id]).toBe(1200);
    expect(gameData('aa').backlog[ownIdFor({ game: 'aa', id: 'hq_b' })]).toBeUndefined();
    undoImport(undo);
    expect(gameData('aa').ownItems.backlog[id]?.hidden).toBe(true);
    expect(gameData('aa').backlog[id]).toBeUndefined();
  });

  it('rewardUnknown becomes “No data yet” (no reward), and a new category name makes a new category', () => {
    applyImport(planImport(rowsOf(file([{ ...quest('x'), rewardUnknown: true, rewardEach: 0, category: 'Collab' }])), state()), () => 'gem');
    expect(gameData('aa').ownItems.backlog[ownIdFor({ game: 'aa', id: 'x' })]?.fields).toMatchObject({ reward: null, category: 'collab' });
  });

  it('the same file again adds nothing twice and only raises progress', () => {
    applyImport(planImport(rowsOf(file([FULL, quest('hq_a', 0)])), state()), () => 'gem');
    const id = ownIdFor(FULL);
    setBacklogDone('aa', id, 2000); // you got further in HLITH since
    const again = planImport(rowsOf(file([{ ...FULL, done: 1500 }, quest('hq_a', 1)])), state());
    expect(again.add).toEqual([]);
    expect(again.raise).toEqual([{ game: 'aa', itemId: ownIdFor({ game: 'aa', id: 'hq_a' }), from: 0, to: 1 }]);
    expect(again.unchanged).toBe(1);
    applyImport(again, () => 'gem');
    expect(gameData('aa').backlog[id]).toBe(2000);
    expect(Object.keys(gameData('aa').ownItems.backlog)).toHaveLength(2);
  });

  it('a full row round-trips: import → export gives every field back', () => {
    applyImport(planImport(rowsOf(file([FULL, { ...quest('hq_u'), rewardUnknown: true, rewardEach: 0 }])), state()), () => 'gem');
    const items = mergeOwnItems('backlog', [], gameData('aa').ownItems.backlog);
    const out = JSON.parse(exportBacklog([{ id: 'aa', items, progress: gameData('aa').backlog }])) as { format: string; version: number; backlog: Record<string, unknown>[] };
    expect(out.format).toBe('hlith-backlog-export');
    expect(out.version).toBe(1);
    expect(out.backlog.find((r) => r.id === FULL.id)).toEqual(FULL);
    expect(out.backlog.find((r) => r.id === 'hq_u')).toEqual({ id: 'hq_u', game: 'aa', category: 'Side quests', label: 'Quest hq_u', total: 1, rewardEach: 0, rewardUnknown: true, unit: 'mission' });
    // …and importing the export into another account gives the same items.
    resetUserData();
    applyImport(planImport(rowsOf(JSON.stringify(out)), state()), () => 'gem');
    expect(mergeOwnItems('backlog', [], gameData('aa').ownItems.backlog)).toEqual(items);
  });

  it('the template is a valid backlog file', () => {
    expect(rowsOf(TEMPLATE).length).toBe(3);
  });

  it('the preview says how many items, how many with progress and the file’s date; Apply then Undo', async () => {
    render(<ImportPanel text={file([FULL, quest('hq_a', 1), quest('hq_b')])} games={[game]} />);
    expect(screen.getByText(/items to add/)).toHaveTextContent(/^3 items to add · 2 with progress · progress from (Oct 2|2 Oct) \(the file’s date\)$/);
    expect(gameData('aa').ownItems.backlog).toEqual({});
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    });
    expect(Object.keys(gameData('aa').ownItems.backlog)).toHaveLength(3);
    expect(screen.getByRole('status')).toHaveTextContent('Imported: 3 items added to your backlog. Nothing was lowered.');
    fireEvent.click(screen.getByRole('button', { name: 'Undo this import' }));
    expect(Object.values(gameData('aa').ownItems.backlog).every((e) => e.hidden)).toBe(true);
  });
});
