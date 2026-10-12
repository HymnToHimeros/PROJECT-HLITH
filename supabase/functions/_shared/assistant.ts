/**
 * The Assistant's server side, without the network: checks a request, builds
 * the Claude Messages API call and shapes the reply. The `assistant` function
 * (supabase/functions/assistant/index.ts) wires it to Deno and the SDK.
 *
 * The caller's own Claude API key arrives with each request, is handed to the
 * SDK client for that one call, and is never stored, logged or sent back.
 */
import type Anthropic from '@anthropic-ai/sdk';

type Params = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;
type Message = Anthropic.Beta.BetaMessage;
type MessageParam = Anthropic.Beta.BetaMessageParam;
type Tool = Anthropic.Beta.BetaTool;

/** Models the picker offers. Ids and prices: the Claude API reference (claude-api skill, cached 2026-10-06). */
export const ASSISTANT_MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'] as const;
export type AssistantModel = (typeof ASSISTANT_MODELS)[number];

/**
 * Web search (server tool). The dynamic-filtering version is documented for
 * Opus 5.5 and Sonnet 5.5; it is not listed for Haiku 5.5, so Haiku runs without it.
 */
export function webSearchAvailable(model: AssistantModel): boolean {
  return model !== 'claude-haiku-5-5';
}

/** Server-side refusal fallback: documented for Opus 5.5 and Sonnet 5.5 on the Claude API, not for Haiku 5.5. */
const FALLBACK_MODELS: readonly AssistantModel[] = ['claude-opus-5-5', 'claude-sonnet-5-5'];

const id = { type: 'string' } as const;
const why = { type: 'string', description: 'One short sentence for the user: why you propose this.' } as const;
const game = { type: 'string', description: 'Game id from the data summary, e.g. "hsr".' } as const;
const obj = (properties: Record<string, unknown>): Tool['input_schema'] => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

/**
 * Actions the Assistant can PROPOSE. None of them changes anything by itself:
 * the app shows each call as a card and applies it only when the user taps Approve.
 *
 * `strict: true` schemas must not use the keywords in STRICT_UNSUPPORTED: Claude answers 400 to
 * the whole request ("For 'integer' type, property 'minimum' is not supported"), so every message
 * fails. Limits go in the description; the app checks them on the card (src/tools/assistant/proposals.ts).
 */
export const ACTION_TOOLS: Tool[] = [
  {
    name: 'log_bank_balance',
    description:
      'Propose a bank log entry for a currency: "have" = the balance the user sees now; "earned", "bought", "spent" = an amount that changed. Use currency ids from the data summary.',
    strict: true,
    input_schema: obj({
      game,
      currency: id,
      kind: { type: 'string', enum: ['have', 'earned', 'bought', 'spent'] },
      amount: { type: 'integer', description: 'A whole number, 0 or more.' },
      note: { type: 'string', description: 'Short note, or "" for none.' },
      why,
    }),
  },
  {
    name: 'set_event_state',
    description: 'Propose marking an event open, done or skipped, and optionally how many login days are claimed. Use event ids from the data summary.',
    strict: true,
    input_schema: obj({
      game,
      event_id: id,
      state: { type: 'string', enum: ['open', 'done', 'skipped'] },
      login_days_claimed: { type: ['integer', 'null'], description: 'Days claimed, 0 or more; null = leave as it is.' },
      why,
    }),
  },
  {
    name: 'set_backlog_done',
    description: 'Propose how many steps of a backlog item are done (out of its total). Use item ids from the data summary.',
    strict: true,
    input_schema: obj({ game, item_id: id, done: { type: 'integer', description: 'Steps done, 0 or more.' }, why }),
  },
  {
    name: 'add_backlog_item',
    description:
      'Propose adding one of the user\'s own backlog items (something to do, with a count: chapters, chests, points…). It is added to their own items, like Edit mode. Use a category id from the data summary when one fits (for example "side-quests"), or a short new one.',
    strict: true,
    input_schema: obj({
      game,
      title: { type: 'string', description: 'Short name, up to 80 characters.' },
      category: { type: 'string', description: 'Category id, e.g. "story", "side-quests", "exploration"; lower case with dashes.' },
      total: { type: 'integer', description: 'How much there is to do, 1 or more (1 = a single tick box).' },
      reward: { type: ['integer', 'null'], description: 'Premium currency for finishing it, 0 or more; null = unknown.' },
      note: { type: 'string', description: 'One short line, or "".' },
      why,
    }),
  },
  {
    name: 'edit_backlog_item',
    description: 'Propose renaming a backlog item or changing how much there is to do. Use item ids from the data summary.',
    strict: true,
    input_schema: obj({
      game,
      item_id: id,
      title: { type: ['string', 'null'], description: 'New name, or null = keep it.' },
      total: { type: ['integer', 'null'], description: 'New total, 1 or more; null = keep it.' },
      why,
    }),
  },
  {
    name: 'hide_backlog_item',
    description: 'Propose hiding a backlog item from the user\'s list (nothing is deleted; they can show it again in Edit mode). Use item ids from the data summary.',
    strict: true,
    input_schema: obj({ game, item_id: id, why }),
  },
  {
    name: 'set_roster',
    description: 'Propose marking a character owned or not, wanted or not, and their dupes. Use character ids from the data summary or the game list.',
    strict: true,
    input_schema: obj({
      game,
      character_id: id,
      owned: { type: 'boolean' },
      wanted: { type: 'boolean' },
      dupes: { type: ['integer', 'null'], description: '0 or more; null = leave as it is.' },
      why,
    }),
  },
  {
    name: 'tick_today_task',
    description: "Propose ticking (or unticking) one of Today's tasks. Use task ids from the data summary.",
    strict: true,
    input_schema: obj({ game, task_id: id, done: { type: 'boolean' }, why }),
  },
  {
    name: 'propose_plan',
    description: 'Propose a plan for the Calendar (for example "farm ornaments during double drops").',
    strict: true,
    input_schema: obj({
      game,
      title: { type: 'string' },
      start: { type: 'string', description: 'ISO 8601 date-time.' },
      end: { type: ['string', 'null'], description: 'ISO 8601 date-time, or null.' },
      note: { type: 'string', description: 'One line, or "".' },
      why,
    }),
  },
  {
    name: 'propose_route',
    description: 'Propose a route: stops in an order that saves time, each with its small steps. It becomes a plan for that day.',
    strict: true,
    input_schema: obj({
      game,
      title: { type: 'string' },
      date: { type: 'string', description: 'ISO 8601 date-time the route is for.' },
      stops: {
        type: 'array',
        items: obj({ title: { type: 'string' }, minutes: { type: ['integer', 'null'] }, items: { type: 'array', items: { type: 'string' } } }),
      },
      why,
    }),
  },
];

export const ACTION_TOOL_NAMES = ACTION_TOOLS.map((t) => t.name);

/** JSON Schema keywords kept out of strict tool schemas (tests/assistantTools.test.ts walks every schema for them). */
export const STRICT_UNSUPPORTED = ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf', 'minLength', 'maxLength', 'pattern', 'format', 'minItems', 'maxItems', 'uniqueItems', 'minProperties', 'maxProperties'] as const;

/** Stable instructions (cached). The user's data follows as a second block. */
export const SYSTEM_PROMPT = `You are the Assistant inside HLITH (PROJECT-HLITH, HLIÐSKJÁLF), a personal hub for gacha games such as Honkai: Star Rail and Zenless Zone Zero.

How to answer:
- Answer from the user's data summary below and from what they show you (screenshots and attached files: .json, .md, .txt, .csv or .pdf, each titled with its file name). If a fact is not there and you cannot check it, say "no data yet" rather than guessing. Never present an estimate as a fact; label it.
- Plain, friendly English. Short answers first; details only when asked. Times in the user's local time.
- When you use web search, say where the information came from.

Changing the user's data:
- You can propose changes with your tools (bank log entries, event and backlog progress, adding, renaming or hiding the user's own backlog items, roster, Today's tasks, plans and routes). Every tool call becomes a card the user approves or dismisses; nothing changes until they approve. Never say a change is done before the user approves it.
- Use only ids that appear in the data summary. If you do not know the id, ask.
- When an attached file lists things to do (a checklist, a guide, a spreadsheet), you can propose them as backlog items with add_backlog_item, one card each; keep it to the ones the user asked for.
- A pull history export (UIGF or SRGF .json) is imported by the app itself: the user sees an Import button under the file. Don't retype its pulls into the chat.
- Tool results tell you what the user decided.`;

export interface AssistantRequest {
  model: AssistantModel;
  messages: MessageParam[];
  context: string;
  webSearch: boolean;
  apiKey: string;
}

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

const BLOCK_TYPES = new Set(['text', 'image', 'document', 'tool_use', 'tool_result', 'thinking', 'redacted_thinking', 'server_tool_use', 'web_search_tool_result']);
const MAX_MESSAGES = 200;
const MAX_CONTEXT = 24_000;
const MAX_BODY_CHARS = 20_000_000;
/** Files per message (T71); the app also keeps text files to 500 KB and PDFs to 4 MB. */
const MAX_FILES = 5;
const MAX_TEXT_CHARS = 600_000;
const MAX_PDF_CHARS = 6_000_000;

/** A file the user attached: plain text, or a base64 PDF. Nothing else (no links to fetch). */
function okDocument(src: { type?: unknown; media_type?: unknown; data?: unknown } | undefined): boolean {
  if (!src || typeof src.data !== 'string') return false;
  if (src.type === 'text') return src.media_type === 'text/plain' && src.data.length <= MAX_TEXT_CHARS;
  if (src.type === 'base64') return src.media_type === 'application/pdf' && src.data.length <= MAX_PDF_CHARS && /^[A-Za-z0-9+/=]+$/.test(src.data.slice(0, 4096));
  return false;
}

/** Check a request body. The key is checked for shape only; Claude decides if it is valid. */
export function checkRequest(body: unknown, bodyChars: number): Checked<AssistantRequest> {
  if (bodyChars > MAX_BODY_CHARS) return { ok: false, error: 'That message is too large. Try a smaller screenshot.' };
  if (!body || typeof body !== 'object') return { ok: false, error: 'Send JSON.' };
  const b = body as Record<string, unknown>;
  const apiKey = typeof b.apiKey === 'string' ? b.apiKey.trim() : '';
  if (!/^sk-ant-[A-Za-z0-9_-]{10,300}$/.test(apiKey)) return { ok: false, error: 'Add your Claude API key first (it starts with sk-ant-).' };
  const model = ASSISTANT_MODELS.find((m) => m === b.model);
  if (!model) return { ok: false, error: 'Choose one of the listed models.' };
  if (!Array.isArray(b.messages) || b.messages.length === 0 || b.messages.length > MAX_MESSAGES)
    return { ok: false, error: `Send between 1 and ${MAX_MESSAGES} messages. Start a new chat if this one is long.` };
  for (const [i, m] of b.messages.entries()) {
    if (!m || typeof m !== 'object') return { ok: false, error: 'A message is malformed.' };
    const { role, content } = m as { role?: unknown; content?: unknown };
    if (role !== 'user' && role !== 'assistant') return { ok: false, error: 'Messages are from the user or the assistant only.' };
    if (i === 0 && role !== 'user') return { ok: false, error: 'The chat must start with your message.' };
    if (typeof content === 'string') continue;
    if (!Array.isArray(content) || content.some((c) => !c || typeof c !== 'object' || !BLOCK_TYPES.has(String((c as { type?: unknown }).type))))
      return { ok: false, error: 'A message has content the Assistant does not accept.' };
    const docs = content.filter((c) => (c as { type: string }).type === 'document') as { source?: { type?: unknown; media_type?: unknown; data?: unknown } }[];
    if (docs.some((d) => !okDocument(d.source))) return { ok: false, error: 'Attach a .json, .md, .txt, .csv or .pdf file.' };
    if (role === 'user' && docs.length > MAX_FILES) return { ok: false, error: `Attach up to ${MAX_FILES} files per message.` };
  }
  if ((b.messages[b.messages.length - 1] as { role: string }).role !== 'user') return { ok: false, error: 'The last message must be yours.' };
  const context = typeof b.context === 'string' ? b.context.slice(0, MAX_CONTEXT) : '';
  return { ok: true, value: { model, messages: b.messages as MessageParam[], context, webSearch: b.webSearch === true && webSearchAvailable(model), apiKey } };
}

/** The Messages API request. The key is not part of it (it goes to the client constructor). */
export function buildParams(req: Omit<AssistantRequest, 'apiKey'>): Params {
  const tools: Params['tools'] = [...ACTION_TOOLS];
  if (req.webSearch) tools.push({ type: 'web_search_20260209', name: 'web_search', max_uses: 5 });
  return {
    model: req.model,
    max_tokens: 16000,
    system: [
      { type: 'text', text: SYSTEM_PROMPT },
      { type: 'text', text: `The user's data (summary made by the app just now):\n${req.context || 'No data yet.'}` },
    ],
    messages: req.messages,
    tools,
    tool_choice: { type: 'auto' },
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium' },
    // Caches the conversation so far; later turns re-read it at the cache price.
    cache_control: { type: 'ephemeral' },
    ...(FALLBACK_MODELS.includes(req.model) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
  };
}

export interface CallUsage {
  model: string;
  usage: Message['usage'];
}

export interface AssistantReply {
  /** The assistant turn, ready to append to the history unchanged. */
  content: Message['content'];
  stop_reason: Message['stop_reason'];
  stop_details: Message['stop_details'];
  /** The model that wrote the reply (differs from the chosen one after a fallback). */
  model: string;
  /** One entry per API call this turn (more than one when a long web search paused and resumed). */
  calls: CallUsage[];
}

const MAX_CONTINUATIONS = 3;

/**
 * Run one assistant turn. `create` makes one Messages API call with the
 * caller's key. A turn that pauses during web search is resumed (no extra user message).
 */
export async function runTurn(req: AssistantRequest, create: (params: Params, apiKey: string) => Promise<Message>): Promise<AssistantReply> {
  const { apiKey, ...rest } = req;
  let messages = [...rest.messages];
  const content: Message['content'] = [];
  const calls: CallUsage[] = [];
  let last: Message | null = null;
  for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
    last = await create(buildParams({ ...rest, messages }), apiKey);
    calls.push({ model: last.model, usage: last.usage });
    content.push(...last.content);
    if (last.stop_reason !== 'pause_turn') break;
    messages = [...rest.messages, { role: 'assistant', content: content as MessageParam['content'] }];
  }
  if (!last) throw new Error('no reply');
  return { content, stop_reason: last.stop_reason, stop_details: last.stop_details, model: last.model, calls };
}

/** Claude's own error, as its API sends it: `{ type: 'error', error: { type, message } }`. */
export interface ClaudeError {
  type?: string;
  message?: string;
}

/** Read the type and message from an API error body (anything else: empty). Never the key or the request. */
export function claudeError(body: unknown): ClaudeError {
  const e = body && typeof body === 'object' ? (body as { error?: unknown }).error : undefined;
  if (!e || typeof e !== 'object') return {};
  const { type, message } = e as { type?: unknown; message?: unknown };
  return { ...(typeof type === 'string' ? { type } : {}), ...(typeof message === 'string' ? { message: message.slice(0, 300) } : {}) };
}

/** A short code for an unknown error, the same for the same message, so a user can quote it and we find it in the logs. */
export function errorCode(status: number | undefined, message: string | undefined): string {
  let h = 0x811c9dc5;
  for (const ch of message ?? '') h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  return `E${status ?? 0}-${h.toString(16).padStart(8, '0').slice(0, 6)}`;
}

/** What the user sees when Claude returns an error. Never includes the key. */
export function errorText(status: number | undefined, detail: ClaudeError = {}): { status: number; error: string } {
  const message = detail.message ?? '';
  switch (status) {
    case 400:
      if (/credit balance/i.test(message)) return { status: 400, error: 'Your Claude account has no credit left. Add credit under Billing in the Claude Console.' };
      if (/^model:|model.*(not (found|supported|available)|does not support)/i.test(message))
        return { status: 400, error: 'That model can’t be used for this request with your key. Choose another model.' };
      if (/prompt is too long|too many tokens/i.test(message)) return { status: 400, error: 'This chat is too long for the model. Start a new chat.' };
      if (/image/i.test(message)) return { status: 400, error: 'Claude could not read that picture. Try a PNG or JPEG screenshot.' };
      return { status: 400, error: `Claude could not read this request. Try again, or start a new chat. If it keeps happening, send us code ${errorCode(400, message)}.` };
    case 401:
      return { status: 401, error: 'Claude did not accept this API key. Check it in the Assistant settings.' };
    case 403:
      return { status: 403, error: 'This API key is not allowed to use that model. Try another model, or check your Console settings.' };
    case 404:
      return { status: 404, error: 'That model is not available to your key. Choose another model.' };
    case 413:
      return { status: 413, error: 'That message is too large. Try a smaller screenshot.' };
    case 429:
      return { status: 429, error: 'Your Claude account hit its rate or spend limit. Wait a minute, or check Billing in the Claude Console.' };
    case 529:
    case 503:
      return { status: 503, error: 'Claude is busy right now. Try again in a minute.' };
    default:
      return { status: 502, error: 'The Assistant could not reach Claude. Try again in a minute.' };
  }
}
