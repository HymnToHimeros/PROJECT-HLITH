// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrast, ventProblems } from '../src/core/theme/contrast';
import { ACCENT_VALUE } from '../src/core/theme/look';
import { VENT_CHOICES } from '../src/core/theme/vents';
import { THEME_IDS, THEMES } from '../src/core/theme/themes';
import { games } from '../src/games';

/*
 * Every theme gets the same checks as Glacier (tests/tokens.test.ts): full token set,
 * readable text on every surface (CLAUDE.md Override 4 for ink.5), readable text over
 * the background art, and vents that still pass the vent rule.
 */
const FILES = ['tokens.css', 'tokens-light.css', 'tokens-themes.css'];
const read = (f: string) => readFileSync(resolve(__dirname, '../src/core/theme', f), 'utf8');

/** Theme id → its tokens (name → value), from blocks like `:root[data-theme='x'], [data-theme-preview='x'] { … }`. */
function parseThemes(): Map<string, Record<string, string>> {
  const out = new Map<string, Record<string, string>>();
  for (const file of FILES) {
    const css = read(file).replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const id = /\[data-theme-preview='([a-z-]+)'\]/.exec(m[1] ?? '')?.[1];
      if (!id) continue;
      const tokens: Record<string, string> = {};
      for (const d of (m[2] ?? '').matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) tokens[d[1] as string] = (d[2] as string).trim();
      out.set(id, tokens);
    }
  }
  return out;
}

const themes = parseThemes();
const glacier = themes.get('dark') ?? {};
const COLOUR = /^(#[0-9a-f]{6}|rgb\()/i;
/** The colour tokens Glacier defines: every theme must define all of them. */
const colourTokens = Object.keys(glacier).filter((k) => COLOUR.test(glacier[k] ?? '') || k.startsWith('art-'));

const hex = (t: Record<string, string>, name: string): string => {
  const v = t[name];
  if (!v || !/^#[0-9a-f]{6}$/i.test(v)) throw new Error(`--${name} is not a 6-digit hex colour: ${v}`);
  return v;
};

/** a painted over b at alpha t, in sRGB like the browser does. */
function over(b: string, a: string, t: number): string {
  const A = parseInt(a.slice(1), 16);
  const B = parseInt(b.slice(1), 16);
  return `#${[16, 8, 0].map((s) => Math.round(((B >> s) & 255) * (1 - t) + ((A >> s) & 255) * t).toString(16).padStart(2, '0')).join('')}`;
}

const SURFACES = ['bg-app', 'bg-card', 'bg-shell', 'bg-inset', 'bg-raised'];
const TEXT = ['ink-1', 'ink-2', 'ink-3', 'ink-4', 'glacier', 'ok', 'ember-soft', 'rarity-top', 'rarity-mid', 'rarity-low'];
const INKS = ['ink-1', 'ink-2', 'ink-3', 'ink-4', 'ink-5'];

describe('themes', () => {
  it('every theme id has a token block, and every block is a known theme', () => {
    expect([...themes.keys()].sort()).toEqual([...THEME_IDS].sort());
    expect(THEMES.map((t) => t.id).sort()).toEqual([...THEME_IDS].sort());
  });

  it('Glacier defines the art tokens too', () => {
    expect(colourTokens).toEqual(expect.arrayContaining(['bg-app', 'ink-5', 'vent-all', 'scrim', 'art-ink', 'art-glow', 'art-opacity']));
  });

  for (const info of THEMES) {
    const t = themes.get(info.id) ?? {};
    describe(`${info.name} (${info.id})`, () => {
      it('defines every colour token Glacier defines, and nothing unknown', () => {
        expect(colourTokens.filter((k) => !(k in t))).toEqual([]);
        expect(Object.keys(t).filter((k) => !(k in glacier))).toEqual([]);
      });

      it('its address-bar colour is its page colour', () => {
        expect(info.app.toLowerCase()).toBe(hex(t, 'bg-app').toLowerCase());
      });

      it('ink.5 reaches 4.5:1 on bg.app, bg.card and bg.shell (Override 4)', () => {
        for (const s of ['bg-app', 'bg-card', 'bg-shell']) expect(contrast(hex(t, 'ink-5'), hex(t, s)), `ink-5 on ${s}`).toBeGreaterThanOrEqual(4.5);
      });

      it('every text colour reaches 4.5:1 on the surfaces it sits on', () => {
        for (const c of TEXT) for (const s of SURFACES) expect(contrast(hex(t, c), hex(t, s)), `${c} on ${s}`).toBeGreaterThanOrEqual(4.5);
      });

      it('text on the page stays at 4.5:1 even where the background art is strongest', () => {
        const strength = Number(t['art-opacity']);
        expect(strength).toBeGreaterThan(0);
        expect(strength).toBeLessThanOrEqual(0.16);
        for (const a of ['art-ink', 'art-glow']) {
          const bg = over(hex(t, 'bg-app'), hex(t, a), strength);
          for (const c of INKS) expect(contrast(hex(t, c), bg), `${c} over ${a}`).toBeGreaterThanOrEqual(4.5);
        }
      });

      it('fills keep readable text: the All-games vent passes the vent rule, ember carries dark text', () => {
        expect(ventProblems(hex(t, 'vent-all'), hex(t, 'on-vent'))).toEqual([]);
        expect(contrast(hex(t, 'ember'), hex(t, 'on-vent'))).toBeGreaterThanOrEqual(4.5);
      });

      it('every game colour still works: readable as a fill, and as text on dark themes', () => {
        for (const g of games) {
          expect(contrast(g.vent, hex(t, 'on-vent')), `${g.short} fill`).toBeGreaterThanOrEqual(7);
          // Light themes show game names in ink instead (shell.module.css, data-tone='light').
          if (info.tone === 'dark') for (const s of ['bg-app', 'bg-shell']) expect(contrast(g.vent, hex(t, s)), `${g.short} on ${s}`).toBeGreaterThanOrEqual(4.5);
        }
      });
    });
  }
});

describe('accent colours (Account → Theme → Look, T52)', () => {
  // The accent replaces --glacier, a text colour: it must pass wherever glacier must, on every theme of its tone.
  for (const [id, v] of Object.entries(ACCENT_VALUE)) {
    it(`${id} reaches 4.5:1 on every surface of every theme`, () => {
      for (const info of THEMES) {
        const t = themes.get(info.id) ?? {};
        for (const s of SURFACES) expect(contrast(v[info.tone], hex(t, s)), `${id} on ${info.id} ${s}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});

describe('your own game colours (Customise → Look, T52b)', () => {
  for (const v of VENT_CHOICES) {
    it(`${v.label} passes the vent rule and reads as text on every dark theme`, () => {
      for (const info of THEMES) {
        const t = themes.get(info.id) ?? {};
        expect(ventProblems(v.value, hex(t, 'on-vent')), `${v.label} on ${info.id}`).toEqual([]);
        if (info.tone === 'dark') for (const s of ['bg-app', 'bg-shell']) expect(contrast(v.value, hex(t, s)), `${v.label} on ${info.id} ${s}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
