import { beforeEach, describe, expect, it } from 'vitest';
import type { GameContract } from '../../core/contract';
import { gameData, resetUserData } from '../../core/data/userData';
import { getChat, newChat, replayable, send, setProposalStatus, type Reply, type RequestBody } from './chat';
import type { Lookup } from './context';
import { applyProposal } from './proposals';

const KEY = 'sk-ant-api03-TESTKEY_abcdefghijklmnop1234';
const game = { id: 'aa', short: 'AA', name: 'Game A', currencies: [{ id: 'gem', name: 'Gem' }], servers: [] } as unknown as GameContract;
const lookup = (): Lookup =>
  new Map([
    [
      'aa',
      {
        game,
        serverId: undefined,
        user: gameData('aa'),
        characters: new Map(),
        events: new Map(),
        backlog: new Map([['bl1', { id: 'bl1', title: 'Side quests', category: 'side-quests', total: 10, reward: null, currency: 'gem' }]]),
        banners: [],
        tasks: new Map(),
      },
    ],
  ]);

const usage = { input_tokens: 1000, output_tokens: 100 };
const fake = (replies: Reply[]) => {
  const sent: RequestBody[] = [];
  return {
    sent,
    transport: async (body: RequestBody) => {
      sent.push(structuredClone(body));
      const r = replies.shift();
      if (!r) throw new Error('no more replies');
      return r;
    },
  };
};
const base = (transport: (b: RequestBody) => Promise<Reply>) => ({
  apiKey: KEY,
  model: 'claude-sonnet-5-5',
  webSearch: false,
  prepare: async () => ({ context: 'summary', lookup: lookup() }),
  transport,
});

describe('the chat', () => {
  beforeEach(() => {
    newChat();
    resetUserData();
  });

  it('sends the key only inside the request, and shows reply + cost', async () => {
    const f = fake([{ content: [{ type: 'text', text: 'Hello!', citations: null }], stop_reason: 'end_turn', model: 'claude-sonnet-5-5', calls: [{ model: 'claude-sonnet-5-5', usage }] }]);
    await send({ ...base(f.transport), text: 'Hi' });
    expect(f.sent[0]?.apiKey).toBe(KEY);
    expect(JSON.stringify(f.sent[0]?.messages)).not.toContain(KEY);
    expect(f.sent[0]?.context).toBe('summary');
    const items = getChat().items;
    expect(items.map((i) => i.role)).toEqual(['user', 'assistant']);
    expect(items[1]?.text).toBe('Hello!');
    expect(items[1]?.cost?.usd).toBeCloseTo((1000 * 2 + 100 * 10) / 1e6);
  });

  it('attached files go to Claude as documents titled with their names; the chat keeps only names and sizes (T71)', async () => {
    const f = fake([{ content: [{ type: 'text', text: 'Read it.', citations: null }], stop_reason: 'end_turn', model: 'claude-sonnet-5-5', calls: [{ model: 'claude-sonnet-5-5', usage }] }]);
    await send({ ...base(f.transport), text: '', files: [{ name: 'todo.md', kind: 'text', data: '- chests', size: 8 }] });
    const content = f.sent[0]?.messages[0]?.content as { type: string; title?: string; source?: unknown; text?: string }[];
    expect(content[0]).toEqual({ type: 'document', title: 'todo.md', source: { type: 'text', media_type: 'text/plain', data: '- chests' } });
    expect(content[1]).toEqual({ type: 'text', text: 'Here is a file.' });
    expect(getChat().items[0]?.files).toEqual([{ name: 'todo.md', kind: 'text', size: 8 }]);
    expect(JSON.stringify(getChat().items)).not.toContain('- chests');
  });

  it('proposals wait for you; your decision reaches the model as a tool result; history is append-only', async () => {
    const f = fake([
      {
        content: [
          { type: 'thinking', thinking: '', signature: 'sig' },
          { type: 'text', text: 'I can update that.', citations: null },
          { type: 'tool_use', id: 'tu1', name: 'set_backlog_done', input: { game: 'aa', item_id: 'bl1', done: 3, why: 'from your screenshot' } },
        ],
        stop_reason: 'tool_use',
        model: 'claude-sonnet-5-5',
        calls: [{ model: 'claude-sonnet-5-5', usage }],
      },
      { content: [{ type: 'text', text: 'Done, thanks.', citations: null }], stop_reason: 'end_turn', model: 'claude-sonnet-5-5', calls: [{ model: 'claude-sonnet-5-5', usage }] },
    ]);
    await send({ ...base(f.transport), text: 'I did 3 side quests' });
    expect(getChat().proposals.tu1?.status).toBe('pending');
    expect(gameData('aa').backlog.bl1).toBeUndefined(); // not applied yet

    const p = getChat().proposals.tu1?.proposal;
    if (!p) throw new Error('no proposal');
    expect(applyProposal(p).ok).toBe(true);
    setProposalStatus('tu1', 'applied');
    expect(gameData('aa').backlog.bl1).toBe(3);

    const firstHistory = JSON.stringify(getChat().history);
    await send({ ...base(f.transport), text: 'Thanks' });
    const second = f.sent[1]?.messages ?? [];
    // Earlier turns are sent back unchanged, thinking block included.
    expect(JSON.stringify(second.slice(0, 2))).toBe(firstHistory);
    const last = second[2];
    expect(last?.role).toBe('user');
    const blocks = Array.isArray(last?.content) ? last.content : [];
    expect(blocks[0]).toMatchObject({ type: 'tool_result', tool_use_id: 'tu1', content: expect.stringMatching(/approved/) });
  });

  it('an error leaves the conversation unchanged', async () => {
    const f = fake([]);
    await send({ ...base(f.transport), text: 'Hi' });
    expect(getChat().history).toEqual([]);
    expect(getChat().items.at(-1)?.role).toBe('error');
  });

  it('a declined reply shows a notice and is not sent back', async () => {
    const f = fake([{ content: [], stop_reason: 'refusal', stop_details: { category: 'cyber' }, model: 'claude-sonnet-5-5', calls: [{ model: 'claude-sonnet-5-5', usage }] }]);
    await send({ ...base(f.transport), text: 'Hi' });
    expect(getChat().history.map((m) => m.role)).toEqual(['user']);
    expect(getChat().items.at(-1)?.role).toBe('notice');
  });

  it('after a fallback, only text before the switch point is sent back', () => {
    const out = replayable([
      { type: 'thinking', thinking: '', signature: 's' },
      { type: 'text', text: 'partial', citations: null },
      { type: 'fallback', from: { model: 'a' }, to: { model: 'b' } } as never,
      { type: 'text', text: 'rest', citations: null },
    ]);
    expect(out.map((b) => b.type)).toEqual(['text', 'text']);
  });
});
