import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { OWNER_FRAME_ART, OWNER_FRAME_VARIANTS } from './art';
import { OWNER_NAME_VARIANTS } from './nameVariants';
import { fillVariant, OwnerName } from './OwnerArt';
import { OWNER_SETS } from './style';

const css = (f: string) => readFileSync(join(__dirname, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

describe('owner look variants (T64: the owner kept them all)', () => {
  it('every set has five frames and five name styles, A being the set’s own, each one different', () => {
    for (const s of OWNER_SETS) {
      const frames = OWNER_FRAME_VARIANTS[s.frame] ?? [];
      expect(frames, s.name).toHaveLength(5);
      if (s.frame !== 16) expect(frames[0]).toEqual(OWNER_FRAME_ART[s.frame - 1]);
      expect(new Set(frames.map((f) => f.name)).size).toBe(5);
      expect(new Set(frames.map((f) => f.under + f.over)).size).toBe(5);
      const names = OWNER_NAME_VARIANTS[s.nameStyle] ?? [];
      expect(names, s.name).toHaveLength(4);
      expect(new Set(names.map((n) => n.tpl)).size).toBe(4);
    }
  });

  it('the name goes in escaped: nothing a person types can become markup', () => {
    const tpl = '<span class="oa-v-echo" data-t="@@W@@">@@W@@</span><span>@@L@@</span>';
    const out = fillVariant(tpl, '<img src=x onerror=alert(1)> "A"');
    expect(out).not.toContain('<img');
    expect(out).toContain('&#60;img');
    expect(out).toContain('data-t="&#60;img src=x onerror=alert(1)&#62; &#34;A&#34;"');
    expect(out.match(/class="oa-l"/g)).toHaveLength([...'<img src=x onerror=alert(1)> "A"'].length);
  });

  it('a variant name keeps the plain name for screen readers', () => {
    render(<OwnerName n={13} variant={1} text="Odin" />);
    expect(screen.getByText('Odin', { selector: '.oa-sr' })).toBeInTheDocument();
  });

  it('every animation follows Account → Theme → Animations (On moves, Reduced only soft glows, Off still)', () => {
    for (const f of ['svgMotion.css', 'nameVariants.css']) {
      const rules = css(f).replace(/@keyframes[\s\S]*?\{[\s\S]*?\}\s*\}/g, '');
      for (const m of rules.matchAll(/([^{}]+)\{([^{}]*animation[^{}]*)\}/g)) expect((m[1] ?? '').trim(), f).toMatch(/^:root\[data-motion='(on|reduced)'\]/);
    }
    // Name variant classes are scoped, so they can't touch the rest of the app.
    for (const m of css('nameVariants.css').matchAll(/^([^@{}\s][^{}]*)\{/gm)) for (const sel of (m[1] ?? '').split(',')) expect(sel.trim()).toMatch(/(^|\s)\.oa-name /);
  });
});
