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

  it('reads a file an assistant wrote with other names: "quests", no version, "oroberyl", "region", "exportDate"', () => {
    const text = JSON.stringify({
      format: 'hlith-backlog-export', game: 'endfield', exportDate: '2026-10-16', notes: 'Read from my quest screen',
      quests: [{ id: 'endfield-012', game: 'endfield', category: 'Side quests', label: 'Lone Wolf', total: 1, done: 0, oroberyl: 600, rewardUnknown: false, unit: 'quest', region: 'Power Plateau' }],
    });
    const p = parseBacklogFile(text);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.value.asOf).toBe('2026-10-16');
    expect(p.value.notes).toEqual(['Read from my quest screen']);
    expect(p.value.rows[0]).toMatchObject({ id: 'endfield-012', game: 'endfield', label: 'Lone Wolf', rewardEach: 600, where: 'Power Plateau', rewardUnknown: false });
    // A version other than 1 still says so.
    expect(parseBacklogFile(JSON.stringify({ format: 'hlith-backlog-export', version: 2, backlog: [] }))).toMatchObject({ ok: false });
  });

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

  it('export → import into a fresh account: built-in items only get their progress back, no duplicates', () => {
    const builtIn: BacklogItem[] = [
      { id: 'aa.main-story', category: 'story', title: 'Main story', total: 5, reward: 300, currency: 'gem', steps: ['a', 'b', 'c', 'd', 'e'] },
      { id: 'aa.chests', category: 'exploration', title: 'Chests', total: 50, reward: 100, currency: 'gem' },
    ];
    setBacklogDone('aa', 'aa.main-story', 3);
    setBacklogDone('aa', 'aa.chests', 20);
    applyImport(planImport(rowsOf(file([FULL])), { aa: { ...state().aa, builtIn } }), () => 'gem');
    const mine = mergeOwnItems('backlog', builtIn, gameData('aa').ownItems.backlog);
    const exported = exportBacklog([{ id: 'aa', items: mine, progress: gameData('aa').backlog }]);
    const progressBefore = { ...gameData('aa').backlog };
    resetUserData();
    const plan = planImport(rowsOf(exported), { aa: { ...state().aa, builtIn } });
    expect(plan.builtIn).toBe(2);
    expect(plan.add.map((r) => r.id)).toEqual([FULL.id]);
    applyImport(plan, () => 'gem');
    expect(Object.keys(gameData('aa').ownItems.backlog)).toEqual([ownIdFor(FULL)]);
    expect(gameData('aa').backlog).toEqual(progressBefore);
    // …and never lowers a built-in item's progress.
    setBacklogDone('aa', 'aa.chests', 45);
    applyImport(planImport(rowsOf(exported), { aa: { ...state().aa, builtIn } }), () => 'gem');
    expect(gameData('aa').backlog['aa.chests']).toBe(45);
  });

  it('the template is a valid backlog file', () => {
    expect(rowsOf(TEMPLATE).length).toBe(4);
    expect(rowsOf(TEMPLATE).some((r) => r.game === 'endfield')).toBe(true);
  });

  it('the preview says how many items, how many with progress and the file’s date; Apply then Undo', async () => {
    render(<ImportPanel text={file([FULL, quest('hq_a', 1), quest('hq_b')])} games={[game]} />);
    expect(await screen.findByText(/items to add/)).toHaveTextContent(/^3 items to add · 2 with progress · progress from (Oct 2|2 Oct) \(the file’s date\)$/);
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
