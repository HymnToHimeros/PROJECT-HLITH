// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrast, ventProblems } from '../src/core/theme/contrast';

const css = readFileSync(resolve(__dirname, '../src/core/theme/tokens.css'), 'utf8');
const token = (name: string): string => {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  if (!m?.[1]) throw new Error(`token --${name} missing from tokens.css`);
  return m[1];
};

describe('tokens.css contrast', () => {
  const surfaces = ['bg-app', 'bg-card'];

  it('ink.5 reaches 4.5:1 on bg.app and bg.card (Override 4), and on bg.shell', () => {
    // ink.5 is for section labels only, which sit on the page, cards and the sidebar.
    for (const s of [...surfaces, 'bg-shell']) {
      expect(contrast(token('ink-5'), token(s)), `ink-5 on ${s}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('every text colour reaches 4.5:1 on the surfaces it sits on', () => {
    const text = ['ink-1', 'ink-2', 'ink-3', 'ink-4', 'glacier', 'ok', 'ember-soft', 'rarity-top', 'rarity-mid', 'rarity-low'];
    for (const t of text) {
      for (const s of [...surfaces, 'bg-shell', 'bg-inset', 'bg-raised']) {
        expect(contrast(token(t), token(s)), `${t} on ${s}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('the All-games vent passes the vent rule', () => {
    expect(ventProblems(token('vent-all'), token('on-vent'))).toEqual([]);
  });
});

describe('vent rule', () => {
  it('accepts the design vents', () => {
    expect(ventProblems('#A99BFF')).toEqual([]);
    expect(ventProblems('#D4F23A')).toEqual([]);
  });
  it('rejects dark or ember-like vents', () => {
    expect(ventProblems('#3355AA')).toHaveLength(1);
    expect(ventProblems('#FF8A4C')[0]).toMatch(/reserved for ember/);
  });
});
