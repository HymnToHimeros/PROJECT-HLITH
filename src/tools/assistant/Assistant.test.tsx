import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { GameContract } from '../../core/contract';
import { gameData, resetUserData } from '../../core/data/userData';
import { Assistant } from './Assistant';
import { newChat, type Reply, type RequestBody } from './chat';
import { forgetKey, readKey, saveKey } from './keyStore';
import { resetSettings, updateSettings } from './settings';

const KEY = 'sk-ant-api03-TESTKEY_abcdefghijklmnop1234';
const game = {
  id: 'aa',
  short: 'AA',
  name: 'Game A',
  vent: '#A99BFF',
  currencies: [{ id: 'gem', name: 'Gem', perPull: 160 }],
  servers: [{ id: 'eu', label: 'Europe', utcOffset: 1 }],
  reset: { hour: 4, weekday: 1 },
  income: [],
  stamina: [],
  bannerTypes: [],
  data: {
    characters: async () => [],
    banners: async () => [],
    events: async () => [],
    backlog: async () => [{ id: 'bl1', title: 'Side quests', category: 'side-quests', total: 10, reward: 300, currency: 'gem' }],
  },
} as unknown as GameContract;

const reply: Reply = {
  content: [
    { type: 'text', text: 'Nice work! Want me to log it?', citations: null },
    { type: 'tool_use', id: 'tu1', name: 'set_backlog_done', input: { game: 'aa', item_id: 'bl1', done: 3, why: 'You said you did 3.' } },
  ],
  stop_reason: 'tool_use',
  model: 'claude-opus-5-5',
  calls: [{ model: 'claude-opus-5-5', usage: { input_tokens: 2000, output_tokens: 200 } }],
};

describe('Assistant panel', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    forgetKey();
    resetSettings();
    resetUserData();
    newChat();
  });

  it('without a key: the setup step, how to get a key, and a clearly marked example chat', () => {
    render(<Assistant games={[game]} scope="aa" servers={{}} account={null} />);
    expect(screen.getByRole('region', { name: 'Add your Claude API key' })).toBeInTheDocument();
    expect(screen.getByText('How to get a Claude API key')).toBeInTheDocument();
    const example = screen.getByRole('region', { name: 'Example conversation' });
    expect(within(example).getAllByText('EXAMPLE').length).toBeGreaterThan(0);
    for (const b of within(example).getAllByRole('button', { name: /Approve|Dismiss/ })) expect(b).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('saving and forgetting the key', () => {
    render(<Assistant games={[game]} scope="aa" servers={{}} account={null} />);
    fireEvent.change(screen.getByLabelText('Claude API key'), { target: { value: KEY } });
    fireEvent.click(screen.getByRole('button', { name: 'Save key' }));
    expect(readKey()).toEqual({ key: KEY, place: 'device' });
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByText('sk-ant-…1234')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Forget key' }));
    expect(readKey()).toBeNull();
  });

  it('chat → proposal card → Approve applies → Undo puts it back; cost shown as an estimate', async () => {
    saveKey(KEY, 'device');
    const sent: RequestBody[] = [];
    const transport = async (b: RequestBody) => (sent.push(b), reply);
    render(<Assistant games={[game]} scope="aa" servers={{}} account={{ email: 'a@b.c' }} transport={transport} />);
    fireEvent.change(screen.getByLabelText('Message to the Assistant'), { target: { value: 'I did 3 side quests' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });
    expect(sent[0]?.model).toBe('claude-opus-5-5');
    expect(sent[0]?.context).toContain('bl1 | Side quests');
    expect(await screen.findByText('Nice work! Want me to log it?')).toBeInTheDocument();
    expect(screen.getByText(/≈ \$0\.012 · 2,000 in \/ 200 out · estimate/)).toBeInTheDocument();
    const card = screen.getByRole('article', { name: /Proposal: “Side quests”: 3\/10 done/ });
    expect(gameData('aa').backlog.bl1).toBeUndefined();
    fireEvent.click(within(card).getByRole('button', { name: /Approve/ }));
    expect(gameData('aa').backlog.bl1).toBe(3);
    expect(within(card).getByText('✓ Applied')).toBeInTheDocument();
    fireEvent.click(within(card).getByRole('button', { name: /Undo/ }));
    expect(gameData('aa').backlog.bl1).toBe(0);
    expect(within(card).getByText(/Undone/)).toBeInTheDocument();
  });

  it('stops at the daily limit', () => {
    saveKey(KEY, 'device');
    updateSettings((s) => ({ ...s, dailyLimit: 0.5, spent: { [localDayNow()]: 0.6 } }));
    render(<Assistant games={[game]} scope="aa" servers={{}} account={{ email: 'a@b.c' }} />);
    expect(screen.getByText(/You reached today’s limit of \$0\.500/)).toBeInTheDocument();
    expect(screen.getByLabelText('Message to the Assistant')).toBeDisabled();
  });

  it('Edit lists opens Edit mode for the game in view', async () => {
    render(<Assistant games={[game]} scope="aa" servers={{}} account={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit lists' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Backlog' }));
    expect(await screen.findByText('Side quests')).toBeInTheDocument();
  });
});

function localDayNow() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
