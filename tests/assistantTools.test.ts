// @vitest-environment node
/**
 * T69: Claude answered 400 to every Assistant message because strict tool schemas carried
 * `minimum`. These checks keep the tool schemas inside what strict mode accepts, and make
 * sure a 400 tells the user its real cause.
 */
import { describe, expect, it } from 'vitest';
import { ACTION_TOOLS, ASSISTANT_MODELS, buildParams, claudeError, errorCode, errorText, STRICT_TOOLS_MAX, STRICT_UNSUPPORTED } from '../supabase/functions/_shared/assistant';

/** Every keyword used anywhere in a schema, with its path. */
function keywords(node: unknown, path: string, out: [string, string][] = []): [string, string][] {
  if (Array.isArray(node)) node.forEach((n, i) => keywords(n, `${path}[${i}]`, out));
  else if (node && typeof node === 'object')
    for (const [k, v] of Object.entries(node)) {
      // Property names under "properties" are field names, not keywords.
      if (path.endsWith('.properties')) keywords(v, `${path}.${k}`, out);
      else {
        out.push([k, `${path}.${k}`]);
        keywords(v, `${path}.${k}`, out);
      }
    }
  return out;
}

describe('Assistant tool schemas (strict mode)', () => {
  for (const tool of ACTION_TOOLS) {
    it(`${tool.name}: no keyword strict mode rejects, every object closed`, () => {
      const found = keywords(tool.input_schema, tool.name).filter(([k]) => (STRICT_UNSUPPORTED as readonly string[]).includes(k));
      expect(found.map(([, p]) => p)).toEqual([]);
      const objects: Record<string, unknown>[] = [];
      const walk = (n: unknown): void => {
        if (Array.isArray(n)) n.forEach(walk);
        else if (n && typeof n === 'object') {
          const o = n as Record<string, unknown>;
          if (o.type === 'object') objects.push(o);
          Object.values(o).forEach(walk);
        }
      };
      walk(tool.input_schema);
      for (const o of objects) {
        expect(o.additionalProperties).toBe(false);
        expect(o.required).toEqual(Object.keys(o.properties as object));
      }
    });
  }

  it(`at most ${STRICT_TOOLS_MAX} strict tools (T72: 10 with web search made "The compiled grammar is too large")`, () => {
    const strict = ACTION_TOOLS.filter((t) => t.strict === true).map((t) => t.name);
    expect(strict.length).toBeLessThanOrEqual(STRICT_TOOLS_MAX);
    expect(strict).toEqual(['log_bank_balance', 'set_event_state', 'set_backlog_done', 'set_roster', 'tick_today_task', 'propose_plan', 'propose_route']);
  });

  it('the walker would catch the keyword that broke it', () => {
    const bad = { type: 'object', properties: { minimum: { type: 'integer', minimum: 0 } } };
    expect(keywords(bad, 't').filter(([k]) => k === 'minimum').map(([, p]) => p)).toEqual(['t.properties.minimum.minimum']);
  });

  for (const model of ASSISTANT_MODELS) {
    it(`${model}: the request carries only these clean tool schemas`, () => {
      const p = buildParams({ model, messages: [{ role: 'user', content: 'hi' }], userData: '{}' } as never);
      const custom = (p.tools ?? []).filter((t) => 'input_schema' in t);
      expect(custom.map((t) => t.name)).toEqual(ACTION_TOOLS.map((t) => t.name));
      expect(JSON.stringify(custom)).not.toMatch(new RegExp(`"(${STRICT_UNSUPPORTED.join('|')})":`));
    });
  }
});

describe('Claude 400 answers say their real cause', () => {
  const body = (message: string) => ({ type: 'error', error: { type: 'invalid_request_error', message } });

  it('a grammar too large for the model (T72): says to turn off web search, with a code', () => {
    const msg = 'The compiled grammar is too large, which would cause performance issues. Simplify your tool schemas or reduce the number of strict tools.';
    expect(errorText(400, claudeError(body(msg))).error).toBe(`The Assistant’s tools are too big for this model right now. Turn off web search and try again. (code ${errorCode(400, msg)})`);
  });

  it('low credit', () => {
    const e = errorText(400, claudeError(body('Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.')));
    expect(e.error).toBe('Your Claude account has no credit left. Add credit under Billing in the Claude Console.');
  });
  it('a tool schema Claude rejects (the T69 cause) is unknown to the user, with a code to quote', () => {
    const msg = "tools.0.custom: For 'integer' type, property 'minimum' is not supported";
    const e = errorText(400, claudeError(body(msg)));
    expect(e.error).toMatch(/^Claude could not read this request\. .*send us code E400-[0-9a-f]{6}\.$/);
    expect(e.error).toContain(errorCode(400, msg));
    expect(errorCode(400, msg)).toBe(errorCode(400, msg)); // same message, same code
  });
  it('a model this request can’t use, a too-long chat, a bad picture', () => {
    expect(errorText(400, { message: 'model: claude-x' }).error).toMatch(/Choose another model/);
    expect(errorText(400, { message: 'prompt is too long: 250000 tokens > 200000 maximum' }).error).toMatch(/Start a new chat/);
    expect(errorText(400, { message: 'messages.0.content.1.image.source.base64: invalid base64 data' }).error).toMatch(/picture/);
  });
  it('reads only type and message, and keeps the message short', () => {
    expect(claudeError(null)).toEqual({});
    expect(claudeError({ error: 'x' })).toEqual({});
    expect(claudeError(body('m'.repeat(1000))).message).toHaveLength(300);
    expect(errorText(401).error).not.toMatch(/sk-ant/);
  });
});
