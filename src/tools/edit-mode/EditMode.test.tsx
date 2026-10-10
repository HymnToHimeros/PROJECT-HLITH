import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BacklogItem, GameContract, GameEvent } from '../../core/contract';
import { gameData, resetUserData, saveOwnItem, setOwnItemHidden } from '../../core/data/userData';
import { EditLists, EditMode } from './EditMode';
import { mergeOwnItems, mergeRows } from './merge';
import { useWithOwnItems } from './useWithOwnItems';

const events: GameEvent[] = [
  { id: 'ev1', title: 'Built-in Event', kind: 'event', start: '2026-10-01T00:00:00Z', end: '2026-10-20T00:00:00Z', reward: 800, currency: 'gem' },
  { id: 'ev2', title: 'Second Event', kind: 'login', start: '2026-10-01T00:00:00Z', end: '2026-10-08T00:00:00Z', reward: null, currency: 'gem', loginDays: 7 },
];
const backlog: BacklogItem[] = [{ id: 'bl1', title: 'Story', category: 'story', total: 12, reward: 600, currency: 'gem' }];
const AT = '2026-10-09T10:00:00Z';

const game = {
  id: 'aa',
  short: 'AA',
  name: 'Game A',
  vent: '#A99BFF',
  currencies: [{ id: 'gem', name: 'Gem', perPull: 160 }],
  bannerTypes: [{ id: 'character', label: 'Character banner' }],
  data: { events: async () => events, banners: async () => [], backlog: async () => backlog },
} as unknown as GameContract;

describe('Edit mode: your own items on top of the built-in list', () => {
  beforeEach(() => {
    localStorage.clear();
    resetUserData();
  });

  it('adds your item, applies your change, and leaves hidden ones out', () => {
    saveOwnItem('aa', 'events', { id: 'own-1', mine: true, fields: { title: 'My event', kind: 'web', start: AT, end: '2026-10-12T10:00:00Z', currency: 'gem', reward: 40 }, hidden: false, at: AT });
    saveOwnItem('aa', 'events', { id: 'ev1', mine: false, fields: { reward: 1000 }, hidden: false, at: AT });
    setOwnItemHidden('aa', 'events', 'ev2', true, AT);
    const list = mergeOwnItems('events', events, gameData('aa').ownItems.events);
    expect(list.map((e) => e.id)).toEqual(['ev1', 'own-1']);
    expect(list[0]?.reward).toBe(1000);
    expect(list[0]?.title).toBe('Built-in Event'); // unchanged fields come from the list
    const rows = mergeRows('events', events, gameData('aa').ownItems.events);
    expect(rows.map((r) => r.origin)).toEqual(['changed', 'built-in', 'mine']);
    expect(rows[1]?.hidden).toBe(true);
  });

  it('hiding is a flag: showing it again brings it back, nothing is deleted', () => {
    setOwnItemHidden('aa', 'backlog', 'bl1', true, AT);
    expect(mergeOwnItems('backlog', backlog, gameData('aa').ownItems.backlog)).toEqual([]);
    expect(gameData('aa').ownItems.backlog.bl1).toMatchObject({ hidden: true });
    setOwnItemHidden('aa', 'backlog', 'bl1', false, AT);
    expect(mergeOwnItems('backlog', backlog, gameData('aa').ownItems.backlog)).toEqual(backlog);
  });

  it('a list update never touches your items (they are matched by id)', () => {
    saveOwnItem('aa', 'backlog', { id: 'own-x', mine: true, fields: { title: 'Mine', category: 'story', total: 3, reward: null, currency: 'gem' }, hidden: false, at: AT });
    const updated = [...backlog, { id: 'bl2', title: 'New in list', category: 'modes', total: 5, reward: 100, currency: 'gem' }];
    expect(mergeOwnItems('backlog', updated, gameData('aa').ownItems.backlog).map((b) => b.id)).toEqual(['bl1', 'bl2', 'own-x']);
  });

  it('skips an own item that is missing required fields instead of showing a broken row', () => {
    saveOwnItem('aa', 'events', { id: 'own-bad', mine: true, fields: { title: 'No dates' }, hidden: false, at: AT });
    expect(mergeOwnItems('events', events, gameData('aa').ownItems.events).map((e) => e.id)).toEqual(['ev1', 'ev2']);
  });

  it('data saved before Edit mode existed still loads (new fields start empty, old ones kept)', async () => {
    localStorage.setItem('hlith.userdata', JSON.stringify({ version: 1, games: { aa: { ledger: [], backlog: { bl1: 2 } } } }));
    vi.resetModules();
    const fresh = await import('../../core/data/userData');
    expect(fresh.gameData('aa').backlog).toEqual({ bl1: 2 });
    expect(fresh.gameData('aa').ownItems).toEqual({ events: {}, banners: {}, backlog: {} });
    expect(fresh.gameData('aa').plans).toEqual([]);
    expect(fresh.gameData('aa').assistantActions).toEqual([]);
  });

  it('useWithOwnItems gives screens the merged list', () => {
    saveOwnItem('aa', 'backlog', { id: 'own-y', mine: true, fields: { title: 'Mine', category: 'story', total: 3, reward: null, currency: 'gem' }, hidden: false, at: AT });
    const { result } = renderHook(() => useWithOwnItems(game, 'backlog', backlog));
    expect(result.current.map((b) => b.id)).toEqual(['bl1', 'own-y']);
    act(() => setOwnItemHidden('aa', 'backlog', 'own-y', true, AT));
    expect(result.current.map((b) => b.id)).toEqual(['bl1']);
  });

  it('the screen: add an item, hide a built-in one, show hidden', async () => {
    render(<EditMode game={game} kind="backlog" />);
    expect(await screen.findByText('Story')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add backlog item' }));
    // The same form as on the Backlog screen (one editor for backlog items).
    const form = screen.getByRole('form', { name: 'Add a backlog item' });
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'Hidden achievements' } });
    fireEvent.change(within(form).getByLabelText('Category'), { target: { value: 'achievements' } });
    fireEvent.change(within(form).getByLabelText('How much there is in total'), { target: { value: '20' } });
    fireEvent.change(within(form).getByLabelText(/Reward for all of it/), { target: { value: '100' } });
    fireEvent.submit(form);
    expect(screen.getByText('Hidden achievements')).toBeInTheDocument();
    expect(screen.getByText('YOURS')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hide Story' }));
    expect(screen.queryByText('Story')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show hidden (1)' }));
    expect(screen.getByText('Story')).toBeInTheDocument();
    expect(gameData('aa').ownItems.backlog.bl1?.hidden).toBe(true);
  });

  it('the screen: changing a built-in item stores only what you changed, keeps earlier changes, and can go back to the list’s version', async () => {
    render(<EditMode game={game} kind="backlog" />);
    await screen.findByText('Story');
    fireEvent.click(screen.getByRole('button', { name: 'Change Story' }));
    const form = screen.getByRole('form', { name: 'Change Story' });
    fireEvent.change(within(form).getByLabelText('How much there is in total'), { target: { value: '14' } });
    fireEvent.submit(form);
    expect(gameData('aa').ownItems.backlog.bl1).toMatchObject({ mine: false, fields: { total: 14 } });
    expect(screen.getByText('CHANGED')).toBeInTheDocument();
    // A second change keeps the first one.
    fireEvent.click(screen.getByRole('button', { name: 'Change Story' }));
    const again = screen.getByRole('form', { name: 'Change Story' });
    fireEvent.change(within(again).getByLabelText('Name'), { target: { value: 'Story arc' } });
    fireEvent.submit(again);
    expect(gameData('aa').ownItems.backlog.bl1?.fields).toEqual({ total: 14, title: 'Story arc' });
    fireEvent.click(screen.getByRole('button', { name: 'Back to the list’s version of Story arc' }));
    expect(gameData('aa').ownItems.backlog.bl1?.fields).toEqual({});
    expect(screen.getByText('Story')).toBeInTheDocument();
    expect(screen.queryByText('CHANGED')).not.toBeInTheDocument();
  });

  it('the screen: emptying login days removes them', async () => {
    saveOwnItem('aa', 'events', { id: 'own-l', mine: true, fields: { title: 'My login', kind: 'login', start: AT, end: '2026-10-12T10:00:00Z', currency: 'gem', reward: 70, loginDays: 7 }, hidden: false, at: AT });
    render(<EditMode game={game} kind="events" />);
    await screen.findByText('My login');
    fireEvent.click(screen.getByRole('button', { name: 'Change My login' }));
    const form = screen.getByRole('form', { name: 'Change My login' });
    expect(within(form).getByLabelText('Login days')).toHaveValue('7');
    fireEvent.change(within(form).getByLabelText('Login days'), { target: { value: '' } });
    fireEvent.submit(form);
    expect(gameData('aa').ownItems.events['own-l']?.fields).not.toHaveProperty('loginDays');
    expect(gameData('aa').ownItems.events['own-l']?.fields).toMatchObject({ title: 'My login', reward: 70 });
  });

  it('Edit lists → Backlog uses the Backlog form and shows the Backlog examples', async () => {
    const empty = { ...game, data: { ...game.data, backlog: async () => [] } } as unknown as GameContract;
    render(<EditLists games={[empty]} initialGame="aa" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Backlog' }));
    const row = await screen.findByText('Main story');
    expect(within(row.closest('li') as HTMLElement).getByText('EXAMPLE')).toBeInTheDocument();
    expect(within(row.closest('li') as HTMLElement).getByText(/^Main story · 6 to do/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Change Main story' }));
    const form = screen.getByRole('form', { name: 'Change Main story' });
    expect(within(form).getByRole('radio', { name: /Checklist in order/ })).toBeChecked();
    expect(within(form).getByLabelText(/Steps, one per line/)).toHaveValue('Prologue\nChapter 1\nChapter 2\nChapter 3 · start\nChapter 3 · end\nChapter 4 (latest)');
    expect(within(form).queryByLabelText('Steps in total')).not.toBeInTheDocument();
  });

  it('the screen: a bad form says what to fix and saves nothing', async () => {
    render(<EditMode game={game} kind="events" />);
    await screen.findByText('Built-in Event');
    fireEvent.click(screen.getByRole('button', { name: 'Add event' }));
    const form = screen.getByRole('form', { name: 'Add event' });
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'No dates' } });
    fireEvent.submit(form);
    expect(screen.getByRole('alert')).toHaveTextContent('Set when it starts and ends.');
    expect(gameData('aa').ownItems.events).toEqual({});
  });

  it('shows the screen’s examples while the list is empty: change one and it becomes yours, or hide it', async () => {
    const empty = { ...game, data: { ...game.data, banners: async () => [] } } as unknown as GameContract;
    const ex = [{ id: 'example-character', title: 'Example banner', type: 'character', featured: [], start: AT, end: '2026-10-20T10:00:00Z' }];
    render(<EditMode game={empty} kind="banners" examples={ex} />);
    const row = await screen.findByText('Example banner');
    expect(within(row.closest('li') as HTMLElement).getByText('EXAMPLE')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hide Example banner' }));
    expect(gameData('aa').ownItems.banners['example-character']).toMatchObject({ hidden: true, mine: false });
    fireEvent.click(screen.getByRole('button', { name: /Show hidden/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Show Example banner' }));
    fireEvent.click(screen.getByRole('button', { name: 'Change Example banner' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'My banner' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save change' }));
    expect(gameData('aa').ownItems.banners['example-character']).toMatchObject({ mine: true, fields: { title: 'My banner', type: 'character' } });
  });
});
