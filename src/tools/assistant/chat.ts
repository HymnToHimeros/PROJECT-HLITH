/**
 * The chat: what you see, and the conversation sent to Claude. Kept in memory
 * for this tab (closing the panel keeps it; "New chat" or closing the tab
 * clears it). Applied changes are recorded in your data, so Undo still works
 * after the chat is gone.
 *
 * The conversation is append-only: earlier turns are sent back unchanged
 * (including the model's thinking blocks), and your decisions on proposals
 * reach the model as tool results in your next message.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { useSyncExternalStore } from 'react';
import { backend } from '../../core/data/backend';
import { addCosts, estimateCallCost, type Cost, type Usage } from './models';
import { readProposal, type Proposal } from './proposals';
import type { Lookup } from './context';

type MessageParam = Anthropic.Beta.BetaMessageParam;
type Block = Anthropic.Beta.BetaContentBlock;
type BlockParam = Anthropic.Beta.BetaContentBlockParam;

export interface Reply {
  content: Block[];
  stop_reason: string | null;
  stop_details?: { category?: string | null } | null;
  model: string;
  calls: { model: string; usage: Usage }[];
}

export interface RequestBody {
  apiKey: string;
  model: string;
  messages: MessageParam[];
  context: string;
  webSearch: boolean;
}

/** Sends one turn to the `assistant` server function. */
export type Transport = (body: RequestBody) => Promise<Reply>;

export class AssistantError extends Error {}

/** The real transport: the signed-in `assistant` function. */
export const functionTransport: Transport = async (body) => {
  if (!backend) throw new AssistantError('The Assistant runs through HLITH’s server, and this copy of the app isn’t connected to one, so it can’t send yet.');
  const { data: session } = await backend.auth.getSession();
  if (!session.session) throw new AssistantError('Sign in (Account) to use the Assistant. It runs through HLITH’s server so your key never sits in a web page’s network log.');
  const { data, error } = await backend.functions.invoke<Reply>('assistant', { body });
  if (error || !data) {
    const res: unknown = error && 'context' in error && error.context instanceof Response ? await error.context.json().catch(() => null) : null;
    const text = res && typeof res === 'object' && 'error' in res && typeof res.error === 'string' ? res.error : 'The Assistant could not be reached. Try again in a minute.';
    throw new AssistantError(text);
  }
  return data;
};

export type ProposalStatus = 'pending' | 'applied' | 'dismissed' | 'undone';

export interface ChatItem {
  id: string;
  role: 'user' | 'assistant' | 'error' | 'notice';
  text: string;
  /** Small preview of an attached screenshot (data URL). */
  image?: string;
  proposals?: string[];
  searches?: string[];
  sources?: { title: string; url: string }[];
  model?: string;
  cost?: Cost;
}

export interface ChatState {
  items: ChatItem[];
  history: MessageParam[];
  proposals: Record<string, { proposal: Proposal; status: ProposalStatus; error?: string }>;
  /** Proposal id → the status the model was last told. */
  told: Record<string, ProposalStatus | 'invalid'>;
  thinking: boolean;
}

const EMPTY: ChatState = { items: [], history: [], proposals: {}, told: {}, thinking: false };
let state: ChatState = EMPTY;
const listeners = new Set<() => void>();
const set = (next: ChatState) => {
  state = next;
  listeners.forEach((l) => l());
};

export const getChat = () => state;
export function useChat(): ChatState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getChat,
    getChat,
  );
}

export function newChat(): void {
  set(EMPTY);
}

export function setProposalStatus(id: string, status: ProposalStatus, error?: string): void {
  const p = state.proposals[id];
  if (!p) return;
  set({ ...state, proposals: { ...state.proposals, [id]: { ...p, status, ...(error ? { error } : {}) } } });
}

let seq = 0;
const nextId = () => `c${Date.now().toString(36)}${(seq++).toString(36)}`;

const TOLD: Record<ProposalStatus | 'invalid', string> = {
  pending: 'The user has not decided yet. Nothing has changed.',
  applied: 'The user approved this and it was applied.',
  dismissed: 'The user dismissed this. Nothing changed.',
  undone: 'The user approved this, then undid it. It is back as it was.',
  invalid: 'The app could not apply this (see the reason). Nothing changed.',
};

/**
 * After a request that fell back to another model mid-reply, only text and
 * what came after the switch point can be sent back (the API's rule).
 */
export function replayable(content: Block[]): BlockParam[] {
  const lastFallback = content.map((b) => b.type).lastIndexOf('fallback');
  if (lastFallback < 0) return content as BlockParam[];
  return [...content.slice(0, lastFallback).filter((b) => b.type === 'text'), ...content.slice(lastFallback + 1)] as BlockParam[];
}

export interface SendInput {
  text: string;
  image?: { data: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'; preview: string } | undefined;
  apiKey: string;
  model: string;
  webSearch: boolean;
  /** Fresh data summary and lookup, made just before sending. */
  prepare: () => Promise<{ context: string; lookup: Lookup }>;
  transport: Transport;
  onCost?: (model: string, cost: Cost) => void;
}

/** Send a message. Resolves when the reply (or an error) is in the chat. */
export async function send(input: SendInput): Promise<void> {
  const text = input.text.trim();
  if ((!text && !input.image) || state.thinking) return;
  const userItem: ChatItem = { id: nextId(), role: 'user', text, ...(input.image ? { image: input.image.preview } : {}) };
  set({ ...state, items: [...state.items, userItem], thinking: true });

  // Tool results first: every proposal from the last reply gets an answer.
  const content: BlockParam[] = [];
  const told = { ...state.told };
  const last = state.history[state.history.length - 1];
  const lastCalls = last?.role === 'assistant' && Array.isArray(last.content) ? last.content.filter((b) => b.type === 'tool_use').map((b) => b.id) : [];
  for (const id of lastCalls) {
    const p = state.proposals[id];
    const status = p ? (p.proposal.problem ? 'invalid' : p.status) : 'invalid';
    content.push({ type: 'tool_result', tool_use_id: id, content: p?.proposal.problem ? `${TOLD.invalid} Reason: ${p.proposal.problem}` : TOLD[status], ...(status === 'invalid' ? { is_error: true } : {}) });
    told[id] = status;
  }
  // Decisions on older proposals since the model last heard.
  const changes = Object.entries(state.proposals)
    .filter(([id, p]) => !lastCalls.includes(id) && told[id] !== undefined && told[id] !== p.status && told[id] !== 'invalid')
    .map(([id, p]) => {
      told[id] = p.status;
      return `- “${p.proposal.title}”: ${TOLD[p.status]}`;
    });
  if (changes.length) content.push({ type: 'text', text: `(Note from the app: since your last reply, the user decided on earlier proposals.)\n${changes.join('\n')}` });
  if (input.image) content.push({ type: 'image', source: { type: 'base64', media_type: input.image.mediaType, data: input.image.data } });
  content.push({ type: 'text', text: text || 'Here is a screenshot.' });

  const history: MessageParam[] = [...state.history, { role: 'user', content }];
  try {
    const { context, lookup } = await input.prepare();
    const reply = await input.transport({ apiKey: input.apiKey, model: input.model, messages: history, context, webSearch: input.webSearch });
    const cost = addCosts(reply.calls.map((c) => estimateCallCost(c.model, c.usage)));
    input.onCost?.(input.model, cost);
    const refused = reply.stop_reason === 'refusal';
    const calls = reply.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
    const proposals = { ...state.proposals };
    for (const c of calls) proposals[c.id] = { proposal: readProposal(c, lookup), status: 'pending' };
    const searches = reply.content.flatMap((b) => (b.type === 'server_tool_use' && b.name === 'web_search' && b.input && typeof b.input === 'object' && 'query' in b.input ? [String(b.input.query)] : []));
    const sources = reply.content.flatMap((b) => (b.type === 'web_search_tool_result' && Array.isArray(b.content) ? b.content.map((r) => ({ title: r.title, url: r.url })) : [])).slice(0, 6);
    const replyText = reply.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    const items: ChatItem[] = [
      ...state.items,
      {
        id: nextId(),
        role: 'assistant',
        text: refused ? '' : replyText,
        proposals: calls.map((c) => c.id),
        ...(searches.length ? { searches } : {}),
        ...(sources.length ? { sources } : {}),
        model: reply.model,
        cost,
      },
    ];
    if (refused) items.push({ id: nextId(), role: 'notice', text: 'Claude declined to answer this one (a safety check). Nothing was changed. Try asking another way.' });
    if (reply.stop_reason === 'max_tokens') items.push({ id: nextId(), role: 'notice', text: 'The reply was cut off because it got too long. Ask it to continue, or to be shorter.' });
    set({
      items,
      // A declined reply is not sent back; your message stays.
      history: refused ? history : [...history, { role: 'assistant', content: replayable(reply.content) }],
      proposals,
      told,
      thinking: false,
    });
  } catch (err) {
    const msg = err instanceof AssistantError ? err.message : 'The Assistant could not be reached. Try again in a minute.';
    // The conversation is unchanged: this message was not sent.
    set({ ...state, items: [...state.items, { id: nextId(), role: 'error', text: `Not sent. ${msg}` }], thinking: false });
  }
}
