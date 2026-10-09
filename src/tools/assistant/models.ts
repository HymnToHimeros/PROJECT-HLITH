/**
 * Models the Assistant offers, their prices and the cost of a reply.
 * Ids and prices come from the Claude API reference (claude-api skill, prices
 * cached 2026-10-06). Every cost the app shows is an ESTIMATE from the reply's
 * token counts × these list prices; your Claude Console bill is the real figure.
 * Pure: no React.
 */

export interface ModelInfo {
  id: string;
  label: string;
  /** One line: what it is good at. */
  blurb: string;
  goodFor: string;
  lessSuited: string;
  /** Web search (server tool) is used with this model. */
  webSearch: boolean;
}

/** In the picker, best first. The first is the default. */
export const MODELS: ModelInfo[] = [
  {
    id: 'claude-opus-5-5',
    label: 'Claude Opus 5.5',
    blurb: 'The most capable. Slower, and twice the price of Sonnet.',
    goodFor: 'Research with many web searches, reading a dense screenshot, planning a route or a pull budget with many moving parts.',
    lessSuited: 'Quick questions and ticking things off: you pay more for no visible difference.',
    webSearch: true,
  },
  {
    id: 'claude-sonnet-5-5',
    label: 'Claude Sonnet 5.5',
    blurb: 'Fast and half the price of Opus. Plenty for everyday use.',
    goodFor: 'Everyday questions about your account, ticking tasks, filling the backlog from a screenshot, small plan changes.',
    lessSuited: 'Long research with many searches, where Opus is more careful.',
    webSearch: true,
  },
  {
    id: 'claude-haiku-5-5',
    label: 'Claude Haiku 5.5',
    blurb: 'The cheapest and quickest, by far.',
    goodFor: 'Short questions about what is in your data.',
    lessSuited: 'Screenshots full of small text, planning, anything that needs the web (web search is off for this model here).',
    webSearch: false,
  },
];

export const DEFAULT_MODEL = MODELS[0]?.id ?? 'claude-opus-5-5';

/** US dollars per million tokens. `long` applies when the prompt is over 100K tokens (Haiku 5.5 only). */
interface Price {
  input: number;
  output: number;
  cacheWrite: number; // 5-minute cache write
  cacheRead: number;
  long?: { above: number; input: number; output: number; cacheWrite: number; cacheRead: number };
}

export const PRICES: Record<string, Price> = {
  'claude-opus-5-5': { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 },
  'claude-haiku-5-5': {
    input: 0.1,
    output: 0.5,
    cacheWrite: 0.125,
    cacheRead: 0.01,
    long: { above: 100_000, input: 0.5, output: 2.5, cacheWrite: 0.625, cacheRead: 0.05 },
  },
  // Models a declined request can fall back to (not in the picker).
  'claude-opus-5': { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  'claude-opus-4-8': { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  'claude-sonnet-5': { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 },
};

/** Web search: $10 per 1,000 searches. */
export const WEB_SEARCH_USD = 0.01;

export interface TokenCounts {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}
export interface Usage extends TokenCounts {
  server_tool_use?: { web_search_requests?: number | null } | null;
  iterations?: (TokenCounts & { type: string; model?: string | null })[] | null;
}

export interface Cost {
  /** null = a model we have no price for took part, so no honest total. */
  usd: number | null;
  inputTokens: number;
  outputTokens: number;
  searches: number;
  /** The request was declined and another model answered. */
  fellBack: boolean;
}

function priced(model: string, t: TokenCounts): number | null {
  const p = PRICES[model];
  if (!p) return null;
  const write = t.cache_creation_input_tokens ?? 0;
  const read = t.cache_read_input_tokens ?? 0;
  const prompt = t.input_tokens + write + read;
  const r = p.long && prompt > p.long.above ? p.long : p;
  return (t.input_tokens * r.input + t.output_tokens * r.output + write * r.cacheWrite + read * r.cacheRead) / 1_000_000;
}

/** Estimated cost of one API call from its usage. */
export function estimateCallCost(model: string, usage: Usage): Cost {
  const searches = usage.server_tool_use?.web_search_requests ?? 0;
  const its = usage.iterations ?? [];
  const fellBack = its.some((i) => i.type === 'fallback_message');
  const counted: { model: string; t: TokenCounts }[] = fellBack
    ? its.filter((i) => i.type === 'message' || i.type === 'fallback_message').map((i) => ({ model: i.model ?? model, t: i }))
    : [{ model, t: usage }];
  let usd: number | null = searches * WEB_SEARCH_USD;
  for (const c of counted) {
    const part = priced(c.model, c.t);
    usd = part === null || usd === null ? null : usd + part;
  }
  const sum = (k: 'input_tokens' | 'output_tokens') => counted.reduce((n, c) => n + c.t[k], 0);
  const cache = counted.reduce((n, c) => n + (c.t.cache_creation_input_tokens ?? 0) + (c.t.cache_read_input_tokens ?? 0), 0);
  return { usd, inputTokens: sum('input_tokens') + cache, outputTokens: sum('output_tokens'), searches, fellBack };
}

/** Add up the calls of one turn. */
export function addCosts(costs: Cost[]): Cost {
  return costs.reduce<Cost>(
    (a, c) => ({
      usd: a.usd === null || c.usd === null ? null : a.usd + c.usd,
      inputTokens: a.inputTokens + c.inputTokens,
      outputTokens: a.outputTokens + c.outputTokens,
      searches: a.searches + c.searches,
      fellBack: a.fellBack || c.fellBack,
    }),
    { usd: 0, inputTokens: 0, outputTokens: 0, searches: 0, fellBack: false },
  );
}

/** "$0.0123" under a cent shows more digits, so small costs are never shown as $0.00. */
export function formatUsd(usd: number): string {
  if (usd === 0) return '$0.00';
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

export const priceLine = (id: string) => {
  const p = PRICES[id];
  return p ? `$${p.input} in · $${p.output} out per million tokens` : 'Price not known';
};
