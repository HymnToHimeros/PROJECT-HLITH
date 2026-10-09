import { describe, expect, it } from 'vitest';
import { addCosts, estimateCallCost, formatUsd, MODELS, PRICES } from './models';

const M = 1_000_000;

describe('cost of a reply (estimate from token counts)', () => {
  it('prices input and output per million tokens', () => {
    expect(estimateCallCost('claude-opus-5-5', { input_tokens: M, output_tokens: M }).usd).toBeCloseTo(24);
    expect(estimateCallCost('claude-sonnet-5-5', { input_tokens: M, output_tokens: M }).usd).toBeCloseTo(12);
    expect(estimateCallCost('claude-haiku-5-5', { input_tokens: 10_000, output_tokens: 1_000 }).usd).toBeCloseTo(0.0015);
  });

  it('prices cache writes and reads at their own rates', () => {
    const c = estimateCallCost('claude-opus-5-5', { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: M, cache_read_input_tokens: M });
    expect(c.usd).toBeCloseTo(5 + 0.2);
    expect(c.inputTokens).toBe(2 * M);
  });

  it('uses Haiku 5.5’s long-prompt prices above 100K prompt tokens', () => {
    expect(estimateCallCost('claude-haiku-5-5', { input_tokens: 200_000, output_tokens: 0 }).usd).toBeCloseTo(0.1);
    expect(estimateCallCost('claude-haiku-5-5', { input_tokens: 100_000, output_tokens: 0 }).usd).toBeCloseTo(0.01);
  });

  it('adds $0.01 per web search', () => {
    const c = estimateCallCost('claude-sonnet-5-5', { input_tokens: 0, output_tokens: 0, server_tool_use: { web_search_requests: 3 } });
    expect(c.usd).toBeCloseTo(0.03);
    expect(c.searches).toBe(3);
  });

  it('after a fallback, prices each attempt at the model that ran it', () => {
    const c = estimateCallCost('claude-opus-5-5', {
      input_tokens: M,
      output_tokens: 0,
      iterations: [
        { type: 'message', model: 'claude-opus-5-5', input_tokens: M, output_tokens: 0 },
        { type: 'fallback_message', model: 'claude-opus-4-8', input_tokens: M, output_tokens: 0 },
      ],
    });
    expect(c.fellBack).toBe(true);
    expect(c.usd).toBeCloseTo(4 + 5);
  });

  it('says "unknown" rather than guessing when a model has no price', () => {
    expect(estimateCallCost('claude-someday-9', { input_tokens: 10, output_tokens: 10 }).usd).toBeNull();
    expect(addCosts([estimateCallCost('claude-opus-5-5', { input_tokens: 1, output_tokens: 1 }), estimateCallCost('x', { input_tokens: 1, output_tokens: 1 })]).usd).toBeNull();
  });

  it('adds up the calls of one turn', () => {
    const a = estimateCallCost('claude-opus-5-5', { input_tokens: M, output_tokens: 0 });
    const t = addCosts([a, a]);
    expect(t.usd).toBeCloseTo(8);
    expect(t.inputTokens).toBe(2 * M);
  });

  it('never shows a small cost as $0.00', () => {
    expect(formatUsd(0.0004)).toBe('$0.0004');
    expect(formatUsd(0.034)).toBe('$0.034');
    expect(formatUsd(2.5)).toBe('$2.50');
  });

  it('every model in the picker has a price', () => {
    for (const m of MODELS) expect(PRICES[m.id]).toBeDefined();
  });
});
