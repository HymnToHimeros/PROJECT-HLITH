import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACCENT_SHAPES, MOTIF_LAYERS, OrnamentLayers, TEXTURE_LAYERS } from './ornaments';
import { readOwnerTheme } from './ownerThemes';

const theme = (ornaments: string[]) => ({ id: 'night', name: 'Night', mood: '', tone: 'dark', tokens: { 'bg-app': '#0a0b12', 'bg-card': '#10121c', 'ink-5': '#9aa3b8' }, ornaments });

describe('generic owner-theme layers (T74)', () => {
  it('every layer and accent shape is a known ornament id; unknown ids are dropped, not run', () => {
    const all = [...MOTIF_LAYERS, ...TEXTURE_LAYERS, ...ACCENT_SHAPES];
    const out = readOwnerTheme(theme([...all, 'script', 'url(x)']));
    expect('theme' in out && out.theme.ornaments).toEqual(all);
  });

  it('every layer draws something, and only the ones asked for', () => {
    for (const id of [...MOTIF_LAYERS, ...TEXTURE_LAYERS]) {
      const { container, unmount } = render(<OrnamentLayers ids={[id]} />);
      expect(container.firstChild, id).not.toBeNull();
      unmount();
    }
    const { container } = render(<OrnamentLayers ids={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('names stay neutral: the layer code never says who it is for', () => {
    const src = readFileSync(join(__dirname, 'ornaments.tsx'), 'utf8') + readFileSync(join(__dirname, 'ornaments.module.css'), 'utf8') + readFileSync(join(__dirname, 'ornamentIds.ts'), 'utf8');
    expect(src).not.toMatch(/owner/i);
  });

  it('every accent shape has its marker in the menu CSS', () => {
    const css = readFileSync(join(__dirname, '../shell/shell.module.css'), 'utf8');
    for (const a of ACCENT_SHAPES) expect(css).toContain(`[data-ornaments~='${a}']) .nav,`);
  });
});
