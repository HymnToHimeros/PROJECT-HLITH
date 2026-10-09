// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ACTION_TOOLS, ASSISTANT_MODELS, buildParams, checkRequest, errorText, runTurn } from '../supabase/functions/_shared/assistant';
import { MODELS, PRICES } from '../src/tools/assistant/models';

const KEY = 'sk-ant-api03-TESTKEY_abcdefghijklmnop1234';
const body = (over: Record<string, unknown> = {}) => ({
  apiKey: KEY,
  model: 'claude-opus-5-5',
  messages: [{ role: 'user', content: 'Hi' }],
  context: 'summary',
  webSearch: true,
  ...over,
});
const ok = (b: unknown) => {
  const r = checkRequest(b, JSON.stringify(b).length);
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

describe('assistant server function', () => {
  it('the app and the function offer the same models, each with a price', () => {
    expect(MODELS.map((m) => m.id).sort()).toEqual([...ASSISTANT_MODELS].sort());
    for (const m of ASSISTANT_MODELS) expect(PRICES[m]).toBeDefined();
  });

  it('checks the request', () => {
    expect(checkRequest(body({ apiKey: 'nope' }), 10)).toMatchObject({ ok: false });
    expect(checkRequest(body({ model: 'gpt-x' }), 10)).toMatchObject({ ok: false });
    expect(checkRequest(body({ messages: [] }), 10)).toMatchObject({ ok: false });
    expect(checkRequest(body({ messages: [{ role: 'assistant', content: 'x' }] }), 10)).toMatchObject({ ok: false });
    expect(checkRequest(body({ messages: [{ role: 'system', content: 'x' }] }), 10)).toMatchObject({ ok: false });
    expect(checkRequest(body({ messages: [{ role: 'user', content: [{ type: 'document' }] }] }), 10)).toMatchObject({ ok: false });
    expect(checkRequest(body(), 30_000_000)).toMatchObject({ ok: false });
    expect(ok(body()).model).toBe('claude-opus-5-5');
  });

  it('never puts the key in the Messages API request', () => {
    const { apiKey, ...rest } = ok(body());
    expect(apiKey).toBe(KEY);
    expect(JSON.stringify(buildParams(rest))).not.toContain(KEY);
  });

  it('builds the request: adaptive thinking, auto tool choice, caching, the user data, strict action tools', () => {
    const p = buildParams(ok(body()));
    expect(p.thinking).toEqual({ type: 'adaptive' });
    expect(p.tool_choice).toEqual({ type: 'auto' });
    expect(p.cache_control).toEqual({ type: 'ephemeral' });
    expect(JSON.stringify(p.system)).toContain('summary');
    expect(p.tools?.some((t) => 'type' in t && t.type === 'web_search_20260209')).toBe(true);
    expect(p.fallbacks).toBe('default');
    expect(p.betas).toEqual(['server-side-fallback-2026-07-01']);
    for (const t of ACTION_TOOLS) {
      expect(t.strict).toBe(true);
      expect(t.input_schema.additionalProperties).toBe(false);
      expect(t.input_schema.required).toEqual(Object.keys(t.input_schema.properties as object));
    }
  });

  it('web search and fallbacks are left out where they are not documented (Haiku 5.5) or switched off', () => {
    const h = buildParams(ok(body({ model: 'claude-haiku-5-5' })));
    expect(h.tools?.some((t) => 'type' in t && String(t.type).startsWith('web_search'))).toBe(false);
    expect(h.fallbacks).toBeUndefined();
    const off = buildParams(ok(body({ webSearch: false })));
    expect(off.tools?.some((t) => 'type' in t && String(t.type).startsWith('web_search'))).toBe(false);
  });

  it('resumes a paused web-search turn without adding a user message', async () => {
    const seen: unknown[] = [];
    const usage = { input_tokens: 10, output_tokens: 5 };
    const replies = [
      { content: [{ type: 'server_tool_use', id: 's1', name: 'web_search', input: { query: 'x' } }], stop_reason: 'pause_turn', model: 'claude-opus-5-5', usage, stop_details: null },
      { content: [{ type: 'text', text: 'Found it.' }], stop_reason: 'end_turn', model: 'claude-opus-5-5', usage, stop_details: null },
    ];
    const reply = await runTurn(ok(body()), async (params, key) => {
      expect(key).toBe(KEY);
      seen.push(structuredClone(params.messages));
      return replies.shift() as never;
    });
    expect(reply.calls).toHaveLength(2);
    expect(reply.content.map((b) => b.type)).toEqual(['server_tool_use', 'text']);
    const second = seen[1] as { role: string }[];
    expect(second.map((m) => m.role)).toEqual(['user', 'assistant']);
  });

  it('error messages are plain words and never contain the key', () => {
    for (const s of [400, 401, 403, 404, 413, 429, 500, 529, undefined]) {
      const e = errorText(s);
      expect(e.error).not.toContain('sk-ant');
      expect(e.status).toBeGreaterThanOrEqual(400);
    }
    expect(errorText(401).error).toMatch(/did not accept this API key/);
  });
});
