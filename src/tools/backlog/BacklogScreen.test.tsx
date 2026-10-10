import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { BacklogItem, GameContract } from '../../core/contract';
import { updatePrefs } from '../../core/data/prefs';
import { gameData, resetUserData, saveOwnItem, setBacklogDone } from '../../core/data/userData';
import BacklogScreen from './BacklogScreen';

const makeGame = (backlog: BacklogItem[] = []): GameContract =>
  ({
    id: 'aa',
    short: 'AA',
    name: 'Game A',
    vent: '#A99BFF',
    terms: { rarity: { top: '5★', mid: '4★' }, gear: 'G', weapon: 'Cone', skill: 'S', character: 'Hero', endgame: [] },
    elements: [],
    roles: [],
    currencies: [
      { id: 'gem', name: 'Gem', perPull: 160 },
      { id: 'ticket', name: 'Ticket', pullItemFor: ['character'] },
    ],
    teamSize: 4,
    stamina: [],
    servers: [{ id: 'eu', label: 'Europe', utcOffset: 1 }],
    reset: { hour: 4, weekday: 1 },
    modules: ['backlog'],
    bannerTypes: [{ id: 'character', label: 'Character banner', pullItem: 'ticket', target: 'character', pity: { kind: 'hard-pity', hardPity: 90, baseRate: 0.006 } }],
    income: [],
    historyImporters: [],
    data: {
      characters: async () => [],
      banners: async () => [],
      events: async () => [],
      versions: async () => [],
      backlog: async () => backlog,
      materials: async () => [],
      teams: async () => [],
    },
    rules: {},
    sources: [],
  }) as unknown as GameContract;

let opened: [string, string | undefined] | null = null;
const show = async (game = makeGame()) => {
  render(
    <BacklogScreen
      games={[game]}
      scope="aa"
      servers={{}}
      openTab={() => {}}
      open={(m, t) => {
        opened = [m, t];
      }}
      openAccount={() => {}}
    />,
  );
  await screen.findByText('Still on the table');
};
const summary = () => screen.getByRole('region', { name: 'Still on the table' });
const tab = (name: RegExp) => fireEvent.click(screen.getByRole('tab', { name }));
const panel = (name: string) => screen.getByRole('region', { name });

describe('Backlog screen', () => {
  beforeEach(() => {
    localStorage.clear();
    resetUserData();
    updatePrefs((p) => ({ ...p, hideExamples: false }));
    opened = null;
  });

  it('shows the examples in category tabs, clearly marked, and never counts them', async () => {
    await show();
    expect(screen.getByText(/Example data, not yours/)).toBeInTheDocument();
    for (const c of [/Main story/, /Side quests/, /Permanent events/, /Exploration/, /Modes/, /Achievements/]) expect(screen.getByRole('tab', { name: c })).toBeInTheDocument();
    // The story is a checklist: example progress is at step 5.
    expect(within(panel('Main story')).getByText('You are at: Chapter 3 · end')).toBeInTheDocument();
    expect(within(panel('Main story')).getByText('checklist only · no rewards counted')).toBeInTheDocument();
    expect(within(summary()).getByText(/Examples are never counted: add your own items, or change an example in Edit, and this fills in/)).toBeInTheDocument();
    fireEvent.click(within(summary()).getByRole('button', { name: 'Open calculator' }));
    expect(opened).toEqual(['pulls', 'calculator']);
  });

  it('story: tap the step you are on; finished and start buttons', async () => {
    await show();
    fireEvent.click(within(panel('Main story')).getByRole('button', { name: /Chapter 2/ }));
    expect(gameData('aa').backlog['example-story']).toBe(2);
    expect(screen.getByText('You are at: Chapter 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /I’ve finished main story/ }));
    expect(gameData('aa').backlog['example-story']).toBe(6);
    expect(screen.getByRole('tab', { name: /Main story/ })).toHaveTextContent('✓');
    fireEvent.click(screen.getByRole('button', { name: 'Start of main story' }));
    expect(gameData('aa').backlog['example-story']).toBe(0);
  });

  it('side quests are tick boxes in their regions; counters take − / + and typed numbers', async () => {
    await show();
    tab(/Side quests/);
    expect(screen.getByRole('button', { name: /Second region/ })).toHaveTextContent('2 of 2 still open');
    fireEvent.click(screen.getByRole('button', { name: 'Open all' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Side quest C done' }));
    expect(gameData('aa').backlog['example-side-2-a']).toBe(1);
    // An unknown reward says so instead of guessing.
    expect(within(panel('Side quests')).getByText(/No data yet/)).toBeInTheDocument();
    tab(/Modes/);
    fireEvent.change(screen.getByLabelText('Done for A permanent mode', { selector: 'input' }), { target: { value: '1000' } });
    expect(gameData('aa').backlog['example-mode-1']).toBe(1000);
    fireEvent.click(screen.getByRole('button', { name: 'One more done for A permanent mode' }));
    expect(gameData('aa').backlog['example-mode-1']).toBe(1001);
  });

  it('Edit: change an example (it becomes yours), add your own item, hide and show again', async () => {
    await show();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Game A backlog' }));
    tab(/Permanent events/);
    fireEvent.click(screen.getByRole('button', { name: 'Change A permanent event' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Seal event' } });
    fireEvent.change(screen.getByLabelText(/Reward for all of it/), { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save change' }));
    const own = gameData('aa').ownItems.backlog['example-event-1'];
    expect(own).toMatchObject({ mine: true, fields: { title: 'Seal event', reward: 500 } });
    expect(screen.getByText('Seal event')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '+ Add item' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'My own mode' } });
    fireEvent.change(screen.getByLabelText('How much there is in total'), { target: { value: '300' } });
    fireEvent.change(screen.getByLabelText(/Reward for all of it/), { target: { value: '300' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
    expect(screen.getByText('My own mode')).toBeInTheDocument();
    // Your own items count toward pulls: 300 Gem left → about 1 pull once progress is entered.
    fireEvent.change(screen.getByLabelText('Done for My own mode', { selector: 'input' }), { target: { value: '0' } });
    expect(within(summary()).queryByText(/Examples are never counted/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hide Another permanent event' }));
    expect(screen.queryByText('Another permanent event')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show hidden (1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show Another permanent event again' }));
    expect(screen.getByText('Another permanent event')).toBeInTheDocument();
  });

  it('switching a category off removes it from the pull estimate (real items only)', async () => {
    await show(
      makeGame([
        { id: 'm1', category: 'modes', title: 'Mode', total: 100, reward: 3200, currency: 'gem' },
        { id: 'a1', category: 'achievements', title: 'Achievements', total: 100, reward: 1600, currency: 'gem' },
      ]),
    );
    tab(/Modes/);
    fireEvent.change(screen.getByLabelText('Done for Mode', { selector: 'input' }), { target: { value: '0' } });
    tab(/Achievements/);
    fireEvent.change(screen.getByLabelText('Done for Achievements', { selector: 'input' }), { target: { value: '0' } });
    // 3,200 + 1,600 Gem = 4,800 → 30 pulls.
    expect(within(summary()).getByText('30')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: 'Count Achievements toward pulls' }));
    expect(gameData('aa').backlogOff).toEqual(['achievements']);
    expect(within(summary()).getByText('20')).toBeInTheDocument();
    expect(within(summary()).getByText(/switched off: about 10 more pulls/)).toBeInTheDocument();
  });

  it('a real list with no progress entered shows No data yet, never 0', async () => {
    await show(makeGame([{ id: 'b1', category: 'modes', title: 'Chapter one', total: 10, reward: 600, currency: 'gem' }]));
    expect(screen.queryByText(/Example data, not yours/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Done for Chapter one', { selector: 'input' })).toHaveValue(null);
    expect(within(summary()).getByText(/No data yet/)).toBeInTheDocument();
  });

  const AT = '2026-10-09T10:00:00Z';
  const own = (id: string, fields: Partial<BacklogItem>) => saveOwnItem('aa', 'backlog', { id, mine: true, fields: { category: 'modes', currency: 'gem', reward: null, ...fields }, hidden: false, at: AT });
  const form = (name: string) => screen.getByRole('form', { name });

  it('your own counter item can be changed and saved again (its total is filled in)', async () => {
    updatePrefs((p) => ({ ...p, hideExamples: true }));
    own('own-1', { title: 'My mode', total: 300, steps: [] });
    await show();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Game A backlog' }));
    tab(/Modes/);
    fireEvent.click(screen.getByRole('button', { name: 'Change My mode' }));
    expect(within(form('Change My mode')).getByLabelText('How much there is in total')).toHaveValue('300');
    fireEvent.change(within(form('Change My mode')).getByLabelText('Name'), { target: { value: 'My mode 2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save change' }));
    expect(gameData('aa').ownItems.backlog['own-1']?.fields).toMatchObject({ title: 'My mode 2', total: 300 });
  });

  it('a second change to a built-in item keeps the first; “Back to the list’s version” drops both', async () => {
    await show(makeGame([{ id: 'b1', category: 'modes', title: 'Mode', total: 100, reward: 600, currency: 'gem' }]));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Game A backlog' }));
    tab(/Modes/);
    fireEvent.click(screen.getByRole('button', { name: 'Change Mode' }));
    fireEvent.change(screen.getByLabelText(/Reward for all of it/), { target: { value: '800' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save change' }));
    fireEvent.click(screen.getByRole('button', { name: 'Change Mode' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Big mode' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save change' }));
    expect(gameData('aa').ownItems.backlog.b1?.fields).toEqual({ reward: 800, title: 'Big mode' });
    fireEvent.click(screen.getByRole('button', { name: 'Back to the list’s version of Big mode' }));
    expect(gameData('aa').ownItems.backlog.b1?.fields).toEqual({});
    expect(screen.getByText('Mode')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Back to the list’s version/ })).not.toBeInTheDocument();
  });

  it('“All done” can be undone, putting every value back as it was', async () => {
    await show();
    tab(/Side quests/);
    act(() => setBacklogDone('aa', 'example-side-2-a', 0));
    fireEvent.click(within(panel('Side quests')).getByRole('button', { name: 'All done' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    expect(gameData('aa').backlog['example-side-2-b']).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(gameData('aa').backlog).toEqual({ 'example-side-2-a': 0 });
    // The examples' own progress shows again.
    expect(screen.getByRole('button', { name: /First region/ })).toHaveTextContent('all 2 done');
  });

  it('clearing a counter’s box clears your progress (back to No data yet)', async () => {
    await show(makeGame([{ id: 'b1', category: 'modes', title: 'Mode', total: 100, reward: 600, currency: 'gem' }]));
    const box = screen.getByLabelText('Done for Mode', { selector: 'input' });
    fireEvent.change(box, { target: { value: '40' } });
    expect(gameData('aa').backlog.b1).toBe(40);
    fireEvent.change(box, { target: { value: '' } });
    expect(gameData('aa').backlog).not.toHaveProperty('b1');
    expect(within(summary()).getByText(/No data yet/)).toBeInTheDocument();
  });

  it('“Still on the table”: No data yet with no real items, and says so when every category is switched off', async () => {
    updatePrefs((p) => ({ ...p, hideExamples: true }));
    await show();
    expect(within(summary()).getByText(/No data yet/)).toBeInTheDocument();
    expect(within(summary()).queryByText('0')).not.toBeInTheDocument();
    cleanup();
    await show(makeGame([{ id: 'b1', category: 'modes', title: 'Mode', total: 100, reward: 3200, currency: 'gem' }]));
    fireEvent.change(screen.getByLabelText('Done for Mode', { selector: 'input' }), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('switch', { name: 'Count Modes toward pulls' }));
    expect(within(summary()).getByText('All categories switched off')).toBeInTheDocument();
    expect(within(summary()).queryByText('0')).not.toBeInTheDocument();
    expect(within(summary()).getByText(/switched off: about 20 more pulls/)).toBeInTheDocument();
  });

  it('changing an example keeps its example progress as yours, and the form says so', async () => {
    await show();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Game A backlog' }));
    tab(/Permanent events/);
    fireEvent.click(screen.getByRole('button', { name: 'Change A permanent event' }));
    expect(screen.getByText('Its example progress (120 of 420) becomes yours when you save. You can change it any time.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Seal event' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save change' }));
    expect(gameData('aa').backlog['example-event-1']).toBe(120);
    expect(screen.getByLabelText('Done for Seal event', { selector: 'input' })).toHaveValue(120);
  });

  it('switching a counter to a tick box clears its progress instead of marking it done, and says so', async () => {
    updatePrefs((p) => ({ ...p, hideExamples: true }));
    own('own-1', { title: 'Chests', total: 10, steps: [], reward: 100 });
    act(() => setBacklogDone('aa', 'own-1', 4));
    await show();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Game A backlog' }));
    tab(/Modes/);
    fireEvent.click(screen.getByRole('button', { name: 'Change Chests' }));
    fireEvent.click(screen.getByRole('radio', { name: /Tick box/ }));
    expect(screen.getByText('Changing the kind clears its progress (4 of 10). Enter yours again after saving.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save change' }));
    expect(gameData('aa').backlog).not.toHaveProperty('own-1');
    expect(screen.getByRole('checkbox', { name: 'Chests done' })).not.toBeChecked();
    expect(screen.queryByText('All collected')).not.toBeInTheDocument();
  });

  it('a new item takes the usual kind for its category, unless you picked one', async () => {
    await show();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Game A backlog' }));
    fireEvent.click(screen.getByRole('button', { name: '+ Add item' }));
    expect(screen.getByRole('radio', { name: /Checklist in order/ })).toBeChecked();
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'side-quests' } });
    expect(screen.getByRole('radio', { name: /Tick box/ })).toBeChecked();
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'modes' } });
    expect(screen.getByRole('radio', { name: /Counter/ })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: /Tick box/ }));
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'story' } });
    expect(screen.getByRole('radio', { name: /Tick box/ })).toBeChecked();
  });
});
