// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrast, ventProblems } from '../src/core/theme/contrast';

const read = (f: string) => readFileSync(resolve(__dirname, '../src/core/theme', f), 'utf8');
const light = read('tokens-light.css');
const dark = read('tokens.css');
const names = (css: string) => [...css.matchAll(/--([a-z0-9-]+):/g)].map((m) => m[1] as string);
const token = (name: string): string => {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(light);
  if (!m?.[1]) throw new Error(`token --${name} missing from tokens-light.css`);
  return m[1];
};

describe('tokens-light.css (R61)', () => {
  it('only uses token names that exist in tokens.css', () => {
    const known = new Set(names(dark));
    expect(names(light).filter((n) => !known.has(n))).toEqual([]);
  });

  it('switches on with data-theme="light" on <html>', () => {
    expect(light).toMatch(/:root\[data-theme='light'\]/);
  });

  it('every text colour reaches 4.5:1 on the surfaces it sits on', () => {
    const text = ['ink-1', 'ink-2', 'ink-3', 'ink-4', 'ink-5', 'glacier', 'ok', 'ember-soft', 'rarity-top', 'rarity-mid'];
    for (const t of text) {
      for (const s of ['bg-app', 'bg-card', 'bg-shell', 'bg-inset', 'bg-raised']) {
        expect(contrast(token(t), token(s)), `${t} on ${s}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('text on fills (vents, ember) stays readable', () => {
    expect(ventProblems(token('vent-all'), token('on-vent'))).toEqual([]);
    expect(contrast(token('ember'), token('on-vent'))).toBeGreaterThanOrEqual(4.5);
  });
});
