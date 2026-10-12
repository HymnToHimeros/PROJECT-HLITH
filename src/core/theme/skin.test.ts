import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readOwnerTheme } from './ownerThemes';
import { applySkin, readSkin } from './skin';
import { readPack, turned } from './skinPack';
import { cleanSvg } from './svgClean';

const base = { id: 'night', name: 'Night', mood: '', tone: 'dark', tokens: { 'bg-app': '#0a0b12', 'bg-card': '#10121c', 'ink-5': '#9aa3b8' }, ornaments: [] };

describe('skins (T74)', () => {
  it('the SVG cleaner keeps drawing elements and drops scripts, handlers, links, styles and foreign content', () => {
    const out = cleanSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="alert(1)"><script>alert(1)</script><style>*{}</style>
       <defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></defs>
       <g class="sk-spin evil"><circle cx="5" cy="5" r="4" fill="url(#g)" onclick="x()" style="fill:red"/></g>
       <a href="https://x.test"><rect width="1" height="1"/></a><image href="https://x.test/a.png"/><foreignObject><div>hi</div></foreignObject>
       <use href="#g"/><use href="https://x.test/s.svg#a"/><path d="M0 0L10 10" fill="javascript:alert(1)" stroke="url(https://x.test)"/>
       <animate attributeName="r" values="1;4" dur="1s"/></svg>`,
      'p',
    ) as string;
    expect(out).toBeTruthy();
    for (const bad of ['script', 'onload', 'onclick', 'style', 'foreignObject', 'image', '<a', 'x.test', 'javascript', 'animate', 'evil']) expect(out).not.toContain(bad);
    expect(out).toContain('id="p-g"');
    expect(out).toContain('fill="url(#p-g)"');
    expect(out).toContain('class="sk-spin"');
    expect(out).toContain('href="#p-g"');
    expect(cleanSvg('<div>not svg</div>')).toBeNull();
    expect(cleanSvg('<svg><unclosed')).toBeNull();
  });

  it('a look reads from fixed lists only; anything else falls back to the plain choice', () => {
    expect(readSkin({ card: 'notched', font: 'cinzel', button: 'url(x)', layout: 'nope' })).toMatchObject({ card: 'notched', font: 'cinzel', button: 'default', layout: 'standard', inner: 'none' });
    expect(readSkin('x')).toBeUndefined();
    const ok = readOwnerTheme({ ...base, look: { card: 'bevel', pack: 'sets/night/look-2.json' } });
    expect('theme' in ok && ok.theme.look).toMatchObject({ card: 'bevel', pack: 'sets/night/look-2.json' });
    const bad = readOwnerTheme({ ...base, look: { pack: '../../secret.json' } });
    expect('problems' in bad && bad.problems.join(' ')).toMatch(/look.pack/);
  });

  it('a worn skin puts its choices on <html>, and taking it off removes them', () => {
    const root = document.createElement('html');
    const skin = readSkin({ card: 'arched', progress: 'beads' });
    applySkin(skin && { ...skin }, root);
    expect(root.dataset).toMatchObject({ skin: 'on', skinCard: 'arched', skinProgress: 'beads', skinFont: 'default' });
    applySkin(undefined, root);
    expect(root.dataset.skin).toBeUndefined();
    expect(root.dataset.skinCard).toBeUndefined();
  });

  it('a pack: scene layers cleaned and placed, pictures become links, one corner turned four ways', () => {
    const s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="5" cy="5" r="4" fill="#fff"/></svg>';
    let n = 0;
    const pack = readPack({ scene: [{ svg: s, place: 'top-right', opacity: 2 }, { svg: '<p>no</p>' }], frame: { svg: s, slice: 24, width: 999 }, corner: { svg: s, size: 30 }, divider: { svg: s } }, () => `blob:${n++}`);
    expect(pack.scene).toHaveLength(1);
    expect(pack.scene[0]).toMatchObject({ place: 'top-right', opacity: 1 });
    expect(pack.problems).toEqual(['scene 2: not a usable drawing.']);
    expect(pack.art).toEqual(['frame', 'corner', 'divider']);
    expect(pack.vars['--skin-frame-width']).toBe('60px');
    expect(Object.keys(pack.vars).filter((k) => k.startsWith('--skin-corner-'))).toEqual(['--skin-corner-tl', '--skin-corner-tr', '--skin-corner-bl', '--skin-corner-br', '--skin-corner-size']);
    expect(turned(s).br).toContain('translate(40 40) scale(-1 -1)');
  });

  it('names stay neutral: the skin code never says who it is for', () => {
    for (const f of ['skin.ts', 'skinPack.ts', 'svgClean.ts', 'skins.css']) expect(readFileSync(join(__dirname, f), 'utf8')).not.toMatch(/owner/i);
  });
});
