import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { BacklogItem, GameContract } from '../../core/contract';
import { gameData, resetUserData } from '../../core/data/userData';
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
    opened = null;
  });

  it('shows the examples in category tabs, clearly marked, and never counts them', async () => {
    await show();
    expect(screen.getByText(/Example data, not yours/)).toBeInTheDocument();
    for (const c of [/Main story/, /Side quests/, /Permanent events/, /Exploration/, /Modes/, /Achievements/]) expect(screen.getByRole('tab', { name: c })).toBeInTheDocument();
    // The story is a checklist: example progress is at step 5.
    expect(within(panel('Main story')).getByText('You are at: Chapter 3 · end')).toBeInTheDocument();
    expect(within(panel('Main story')).getByText('checklist only · no rewards counted')).toBeInTheDocument();
    expect(within(summary()).getByText(/Examples are never counted/)).toBeInTheDocument();
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
});
