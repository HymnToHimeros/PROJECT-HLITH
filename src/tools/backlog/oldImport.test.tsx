import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { BacklogItem, GameContract } from '../../core/contract';
import { gameData, resetUserData, setBacklogDone } from '../../core/data/userData';
import { OldImportPanel } from './OldImport';
import { applyImport, looksLikeOldExport, parseOldExport, planImport, undoImport } from './oldImport';

// The old app's real export shape (docs/imports/2026-10-12-backlog-list-hsr-zzz.json), with progress added.
const exportFile = (rows: Record<string, unknown>[]) =>
  JSON.stringify({ format: 'hlith-backlog-export', version: 1, source: 'Gacha Tracker (old app)', dataAsOf: '2026-10-02T08:00:00.000Z', notes: ['Progress is from 2–3 Oct.'], backlog: rows });
const row = (id: string, game: string, total: number, done: number | undefined, extra: Record<string, unknown> = {}) => ({ id, game, category: 'Side quests', label: `Old ${id}`, total, rewardEach: 60, unit: 'mission', ...(done === undefined ? {} : { done }), ...extra });

const items: BacklogItem[] = [
  { id: 'aa.hq_one', oldId: 'hq_one', category: 'side-quests', title: 'Quest one', total: 1, reward: 60, currency: 'gem' },
  { id: 'aa.he_chests', oldId: 'he_chests', category: 'exploration', title: 'Chests', total: 50, reward: 100, currency: 'gem' },
  { id: 'aa.hm_mode', category: 'modes', title: 'Mode', total: 10, reward: 0, currency: 'gem' },
];
const rowsOf = (text: string) => {
  const p = parseOldExport(text);
  if (!p.ok) throw new Error(p.error);
  return p.value.rows;
};
const game = { id: 'aa', short: 'AA', name: 'Game A', currencies: [{ id: 'gem', name: 'Gem', perPull: 160 }], data: { backlog: async () => items } } as unknown as GameContract;

describe('import from the old app (T73)', () => {
  beforeEach(() => resetUserData());

  it('reads the export and its date; anything else says plainly what it is not', () => {
    const p = parseOldExport(exportFile([row('hq_one', 'aa', 1, 1)]));
    expect(p.ok && p.value.rows[0]).toMatchObject({ id: 'hq_one', game: 'aa', done: 1, total: 1 });
    expect(p.ok && p.value.asOf).toBe('2026-10-02T08:00:00.000Z');
    expect(parseOldExport('{"format":"uigf"}')).toEqual({ ok: false, error: 'This isn’t a backlog export from the old app (Gacha Tracker).' });
    expect(parseOldExport('nope')).toMatchObject({ ok: false });
    expect(looksLikeOldExport(exportFile([]))).toBe(true);
    expect(looksLikeOldExport('{"info":{}}')).toBe(false);
  });

  it('finds items by old id (or <game>.<oldId>); only raises progress, never lowers it; caps at the total', () => {
    setBacklogDone('aa', 'aa.he_chests', 40);
    const value = { rows: rowsOf(exportFile([row('hq_one', 'aa', 1, 1), row('he_chests', 'aa', 50, 30), row('hm_mode', 'aa', 10, 99), row('new_thing', 'aa', 3, 2), row('x', 'zz', 1, 1), row('hq_nodone', 'aa', 1, undefined)])) };
    const plan = planImport(value.rows, { aa: items }, { aa: gameData('aa').backlog });
    expect(plan.raise).toEqual([
      { game: 'aa', itemId: 'aa.hq_one', title: 'Quest one', from: undefined, to: 1 },
      { game: 'aa', itemId: 'aa.hm_mode', title: 'Mode', from: undefined, to: 10 },
    ]);
    expect(plan.lowerSkipped).toBe(1);
    expect(plan.unmatched.map((r) => r.id)).toEqual(['new_thing', 'hq_nodone']);
    expect(plan.otherGame).toBe(1);
  });

  it('Apply raises progress and can add unmatched rows as your own items; Undo puts everything back', () => {
    setBacklogDone('aa', 'aa.he_chests', 10);
    const value = { rows: rowsOf(exportFile([row('he_chests', 'aa', 50, 30), row('new_thing', 'aa', 3, 2, { where: 'Penacony' })])) };
    const plan = planImport(value.rows, { aa: items }, { aa: gameData('aa').backlog });
    const undo = applyImport(plan, { addUnmatched: true, premium: () => 'gem' });
    expect(gameData('aa').backlog['aa.he_chests']).toBe(30);
    const own = Object.values(gameData('aa').ownItems.backlog)[0];
    expect(own).toMatchObject({ mine: true, hidden: false, fields: { title: 'Old new_thing', category: 'side-quests', total: 3, reward: 180, currency: 'gem', group: 'Penacony', oldId: 'new_thing' } });
    expect(gameData('aa').backlog[own?.id ?? '']).toBe(2);
    undoImport(undo);
    expect(gameData('aa').backlog['aa.he_chests']).toBe(10);
    expect(gameData('aa').backlog[own?.id ?? '']).toBeUndefined();
    expect(gameData('aa').ownItems.backlog[own?.id ?? '']?.hidden).toBe(true);
  });

  it('the preview says what changes and the file’s date before anything happens; Apply then Undo', async () => {
    render(<OldImportPanel text={exportFile([row('hq_one', 'aa', 1, 1), row('he_chests', 'aa', 50, 20), row('lost', 'aa', 1, 1)])} games={[game]} />);
    expect(await screen.findByText(/items get/)).toHaveTextContent('2 items get progress, 0 lowered.');
    expect(screen.getByText(/Progress in this file is from/)).toHaveTextContent(/Oct 2|2 Oct/);
    expect(screen.getByText(/1 have no matching item/)).toBeInTheDocument();
    expect(gameData('aa').backlog).toEqual({});
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    });
    expect(gameData('aa').backlog).toEqual({ 'aa.hq_one': 1, 'aa.he_chests': 20 });
    expect(screen.getByRole('status')).toHaveTextContent('Imported: 2 items got progress. Nothing was lowered.');
    fireEvent.click(screen.getByRole('button', { name: 'Undo this import' }));
    expect(gameData('aa').backlog).toEqual({});
  });
});
