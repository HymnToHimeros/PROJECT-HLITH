import { describe, expect, it } from 'vitest';
import { coverFocusY, faceAt } from './artFit';

// Real sizes from the live boards (2026-10-11): ZZZ agents are tall full-body portraits,
// HSR splash art is square; the hero frame is wide (566×240 on PC, 419×240 for HSR).
const ZZZ_ROXY = { w: 1072, h: 1916 };
const ZZZ_WIDER = { w: 1520, h: 1896 };
const HSR_SPLASH = { w: 2048, h: 2048 };
const HERO = { w: 566, h: 240 };

/** The part of the picture shown (as shares of its height) for a cover crop at y %. */
function shown(natural: { w: number; h: number }, box: { w: number; h: number }, y: number) {
  const scale = Math.max(box.w / natural.w, box.h / natural.h);
  const height = natural.h * scale;
  const top = ((height - box.h) * y) / 100;
  return { from: top / height, to: (top + box.h) / height };
}

describe('banner art crop', () => {
  it('a tall full-body portrait shows the face, not the legs', () => {
    for (const art of [ZZZ_ROXY, ZZZ_WIDER]) {
      const y = coverFocusY(art, HERO);
      const view = shown(art, HERO, y);
      const face = faceAt(art.h / art.w);
      expect(view.from).toBeLessThanOrEqual(face);
      expect(view.to).toBeGreaterThan(face);
      // The old fixed 40% crop missed the face entirely.
      expect(shown(art, HERO, 40).from).toBeGreaterThan(face);
    }
  });

  it('square splash art keeps the middle of the picture, where the character is', () => {
    const view = shown(HSR_SPLASH, { w: 419, h: 240 }, coverFocusY(HSR_SPLASH, { w: 419, h: 240 }));
    expect(view.from).toBeLessThanOrEqual(0.38);
    expect(view.to).toBeGreaterThan(0.38);
  });

  it('works for any frame: a tall thumbnail and a phone-width hero', () => {
    for (const box of [{ w: 62, h: 78 }, { w: 340, h: 200 }]) {
      const y = coverFocusY(ZZZ_ROXY, box);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(100);
      const view = shown(ZZZ_ROXY, box, y);
      expect(view.from).toBeLessThanOrEqual(faceAt(ZZZ_ROXY.h / ZZZ_ROXY.w));
    }
  });

  it('nothing to crop, or a size not known yet: centred', () => {
    expect(coverFocusY({ w: 566, h: 240 }, HERO)).toBe(50);
    expect(coverFocusY({ w: 0, h: 0 }, HERO)).toBe(50);
  });
});
