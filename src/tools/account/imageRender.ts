/**
 * Draws the part of the picture you chose (see imageCrop.ts) onto a canvas at the
 * saved size, so the saved picture is exactly what the editor showed.
 */
import { hasGaps, OUTPUT_QUALITY, OUTPUT_SIZE, outputType, placement, type ImageKind, type Size, type View } from './imageCrop';

export interface Rendered {
  dataUrl: string;
  type: string;
  w: number;
  h: number;
}

type Context = Pick<CanvasRenderingContext2D, 'drawImage' | 'clearRect'>;
export interface CanvasLike {
  width: number;
  height: number;
  toDataURL(type?: string, quality?: number): string;
  getContext(id: '2d'): Context | null;
}

const newCanvas = (): CanvasLike => document.createElement('canvas');

/** Can this browser save WebP? (Some only make PNG when asked for WebP.) */
export function canMakeWebp(make: () => CanvasLike = newCanvas): boolean {
  try {
    const c = make();
    c.width = 1;
    c.height = 1;
    return c.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    return false;
  }
}

/** The saved picture: always OUTPUT_SIZE[kind], drawn exactly where the editor showed it. */
export function renderCrop(source: CanvasImageSource, img: Size, kind: ImageKind, view: View, make: () => CanvasLike = newCanvas): Rendered {
  const out = OUTPUT_SIZE[kind];
  const canvas = make();
  canvas.width = out.w;
  canvas.height = out.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser can’t resize pictures.');
  const gaps = hasGaps(img, out, view);
  const type = outputType(gaps, gaps && canMakeWebp(make));
  ctx.clearRect(0, 0, out.w, out.h);
  const p = placement(img, out, view);
  ctx.drawImage(source, p.x, p.y, p.w, p.h);
  return { dataUrl: canvas.toDataURL(type, type === 'image/png' ? undefined : OUTPUT_QUALITY), type, w: out.w, h: out.h };
}
