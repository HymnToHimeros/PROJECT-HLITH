import { describe, expect, it, vi } from 'vitest';
import {
  applyKey,
  BANNER_RATIO,
  clampView,
  fillScale,
  fillView,
  fitScale,
  fitView,
  hasGaps,
  initialView,
  keyAction,
  MAX_ZOOM,
  MOVE_STEP,
  moveBy,
  OUTPUT_SIZE,
  outputType,
  placement,
  sourceRect,
  zoomBy,
  zoomFromLevel,
  zoomLevel,
  zoomTo,
  type View,
} from './imageCrop';
import { renderCrop, type CanvasLike } from './imageRender';

/** keyAction for a key that is ours. */
const key = (k: string, shift = false) => {
  const a = keyAction(k, shift);
  if (!a) throw new Error(`no action for ${k}`);
  return a;
};
const AV = OUTPUT_SIZE.avatar; // 512 × 512
const BN = OUTPUT_SIZE.banner; // 1600 × 400
const wide = { w: 2000, h: 1000 };
const tall = { w: 1000, h: 3000 };

/** Every edge of the frame is covered by the picture. */
const covers = (img: { w: number; h: number }, out: { w: number; h: number }, v: View) => {
  const r = sourceRect(out, v);
  return r.sx >= -1e-9 && r.sy >= -1e-9 && r.sx + r.sw <= img.w + 1e-9 && r.sy + r.sh <= img.h + 1e-9;
};

describe('saved sizes', () => {
  it('picture is 512 × 512 and the banner a 4 : 1 strip, 1600 × 400', () => {
    expect(AV).toEqual({ w: 512, h: 512 });
    expect(BN).toEqual({ w: 1600, h: 400 });
    expect(BANNER_RATIO).toBe(4);
  });
});

describe('starting view (Fill, centred)', () => {
  it('a wide picture in the circle keeps the full height and the middle of the width', () => {
    const v = initialView(wide, AV);
    expect(v.mode).toBe('fill');
    expect(sourceRect(AV, v)).toEqual({ sx: 500, sy: 0, sw: 1000, sh: 1000 });
    expect(hasGaps(wide, AV, v)).toBe(false);
  });

  it('a tall picture in the banner keeps the full width and the middle strip', () => {
    const v = initialView(tall, BN);
    expect(sourceRect(BN, v)).toEqual({ sx: 0, sy: 1375, sw: 1000, sh: 250 });
  });
});

describe('drag → source rectangle', () => {
  it('dragging right shows more of the left side', () => {
    const v = moveBy(wide, AV, initialView(wide, AV), 100, 0); // 100 output px = 100 / 0.512 picture px
    expect(sourceRect(AV, v).sx).toBeCloseTo(500 - 100 / fillScale(wide, AV));
    expect(sourceRect(AV, v).sy).toBe(0);
  });

  it('can’t be dragged past an edge in Fill: no gaps', () => {
    const start = initialView(wide, AV);
    for (const [dx, dy] of [
      [99999, 0],
      [-99999, 0],
      [0, 99999],
      [0, -99999],
      [5000, -5000],
    ] as const) {
      const v = moveBy(wide, AV, start, dx, dy);
      expect(covers(wide, AV, v)).toBe(true);
      expect(hasGaps(wide, AV, v)).toBe(false);
    }
    expect(sourceRect(AV, moveBy(wide, AV, start, 99999, 0)).sx).toBe(0);
    expect(sourceRect(AV, moveBy(wide, AV, start, -99999, 0)).sx).toBe(1000);
  });
});

describe('zoom → source rectangle', () => {
  it('zooming in keeps a smaller part, around the centre', () => {
    const v = zoomBy(wide, AV, initialView(wide, AV), 2);
    expect(sourceRect(AV, v)).toEqual({ sx: 750, sy: 250, sw: 500, sh: 500 });
    expect(zoomLevel(wide, AV, v)).toBeCloseTo(2);
  });

  it('zooming around a point keeps that point still', () => {
    const v0 = zoomBy(wide, AV, initialView(wide, AV), 2);
    const anchor = { x: 128, y: 128 };
    const before = { x: sourceRect(AV, v0).sx + anchor.x / v0.scale, y: sourceRect(AV, v0).sy + anchor.y / v0.scale };
    const v1 = zoomBy(wide, AV, v0, 1.5, anchor);
    expect(sourceRect(AV, v1).sx + anchor.x / v1.scale).toBeCloseTo(before.x);
    expect(sourceRect(AV, v1).sy + anchor.y / v1.scale).toBeCloseTo(before.y);
  });

  it('can’t zoom out past Fill (no gaps) or in past the limit', () => {
    const start = initialView(wide, AV);
    expect(zoomBy(wide, AV, start, 0.1).scale).toBe(fillScale(wide, AV));
    expect(zoomBy(wide, AV, start, 1000).scale).toBeCloseTo(fillScale(wide, AV) * MAX_ZOOM);
    // Zoom out after moving to a corner: the frame is pulled back inside the picture.
    const corner = moveBy(wide, AV, zoomBy(wide, AV, start, 3), 99999, 99999);
    const out = zoomTo(wide, AV, corner, 0);
    expect(covers(wide, AV, out)).toBe(true);
  });

  it('slider value 1 = Fill', () => {
    expect(zoomFromLevel(wide, AV, 1)).toBe(fillScale(wide, AV));
    expect(zoomLevel(wide, AV, initialView(wide, AV))).toBe(1);
  });

  it('clamps any random view so there are no gaps in Fill', () => {
    for (let i = 0; i < 200; i++) {
      const img = { w: 50 + Math.round(Math.random() * 4000), h: 50 + Math.round(Math.random() * 4000) };
      const out = i % 2 ? AV : BN;
      const v = clampView(img, out, { mode: 'fill', scale: Math.random() * 3, cx: (Math.random() - 0.5) * 9000, cy: (Math.random() - 0.5) * 9000 });
      expect(covers(img, out, v)).toBe(true);
    }
  });
});

describe('Fit and Fill', () => {
  it('Fit shows the whole picture, centred, with gaps', () => {
    const v = fitView(wide, BN); // 2000 × 1000 in 1600 × 400: height limits
    expect(v.mode).toBe('fit');
    expect(v.scale).toBe(fitScale(wide, BN));
    expect(placement(wide, BN, v)).toEqual({ x: 400, y: 0, w: 800, h: 400 });
    expect(hasGaps(wide, BN, v)).toBe(true);
    expect(zoomLevel(wide, BN, v)).toBeLessThan(1);
  });

  it('in Fit you can move the picture inside the frame but not out of it', () => {
    const v = moveBy(wide, BN, fitView(wide, BN), 99999, 0);
    expect(placement(wide, BN, v).x).toBeCloseTo(800); // right edge touches the frame's right edge
    const back = moveBy(wide, BN, v, -99999, 0);
    expect(placement(wide, BN, back).x).toBeCloseTo(0);
  });

  it('in Fit you can zoom back down to Fit, not further', () => {
    const v = zoomBy(wide, BN, fitView(wide, BN), 0.2);
    expect(v.scale).toBe(fitScale(wide, BN));
  });

  it('Fill after Fit covers the frame again', () => {
    const v = fillView(wide, BN, fitView(wide, BN));
    expect(v.mode).toBe('fill');
    expect(v.scale).toBe(fillScale(wide, BN));
    expect(hasGaps(wide, BN, v)).toBe(false);
  });

  it('a picture already the frame’s shape has no gaps even in Fit', () => {
    expect(hasGaps({ w: 800, h: 200 }, BN, fitView({ w: 800, h: 200 }, BN))).toBe(false);
  });
});

describe('keyboard', () => {
  it('arrow keys move, Shift moves five times as far, + and − zoom, 0 resets', () => {
    expect(keyAction('ArrowRight')).toEqual({ move: [MOVE_STEP, 0] });
    expect(keyAction('ArrowUp', true)).toEqual({ move: [0, -MOVE_STEP * 5] });
    expect(keyAction('+')).toHaveProperty('zoom');
    expect(keyAction('=')).toHaveProperty('zoom');
    expect((keyAction('-') as { zoom: number }).zoom).toBeLessThan(1);
    expect(keyAction('0')).toEqual({ reset: true });
    expect(keyAction('a')).toBeNull();
    expect(keyAction('Tab')).toBeNull();
  });

  it('a right-arrow press moves the picture right by 2% of the frame', () => {
    const start = initialView(wide, AV);
    const v = applyKey(wide, AV, start, key('ArrowRight'));
    expect(placement(wide, AV, v).x - placement(wide, AV, start).x).toBeCloseTo(AV.w * MOVE_STEP);
  });

  it('keys respect the same limits', () => {
    let v = initialView(wide, AV);
    for (let i = 0; i < 200; i++) v = applyKey(wide, AV, v, key('ArrowLeft', true));
    expect(sourceRect(AV, v).sx + sourceRect(AV, v).sw).toBeCloseTo(wide.w);
    for (let i = 0; i < 50; i++) v = applyKey(wide, AV, v, key('-'));
    expect(v.scale).toBe(fillScale(wide, AV));
    v = applyKey(wide, AV, applyKey(wide, AV, v, key('+')), key('0'));
    expect(v).toEqual(initialView(wide, AV));
  });
});

describe('saved picture', () => {
  const fake = (webp = true) => {
    const drawImage = vi.fn();
    const made: CanvasLike[] = [];
    const make = () => {
      const c: CanvasLike = {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage, clearRect: vi.fn() }) as unknown as ReturnType<CanvasLike['getContext']>,
        toDataURL: (type = 'image/png') => `data:${type === 'image/webp' && !webp ? 'image/png' : type};base64,AAAA`,
      };
      made.push(c);
      return c;
    };
    return { make, made, drawImage };
  };
  const src = {} as CanvasImageSource;

  it('the picture is drawn at 512 × 512, exactly where the editor showed it, as JPEG', () => {
    const f = fake();
    const v = zoomBy(wide, AV, initialView(wide, AV), 2);
    const r = renderCrop(src, wide, 'avatar', v, f.make);
    expect([r.w, r.h]).toEqual([512, 512]);
    expect([f.made[0]?.width, f.made[0]?.height]).toEqual([512, 512]);
    expect(r.type).toBe('image/jpeg');
    const p = placement(wide, AV, v);
    expect(f.drawImage).toHaveBeenCalledWith(src, p.x, p.y, p.w, p.h);
  });

  it('the banner is drawn at 1600 × 400', () => {
    const f = fake();
    const r = renderCrop(src, tall, 'banner', initialView(tall, BN), f.make);
    expect([r.w, r.h]).toEqual([1600, 400]);
    expect(r.dataUrl).toMatch(/^data:image\/jpeg/);
  });

  it('with gaps (Fit) it keeps see-through edges: WebP, or PNG where WebP isn’t possible', () => {
    expect(renderCrop(src, wide, 'banner', fitView(wide, BN), fake(true).make).type).toBe('image/webp');
    expect(renderCrop(src, wide, 'banner', fitView(wide, BN), fake(false).make).type).toBe('image/png');
    expect(outputType(false, true)).toBe('image/jpeg');
  });
});
