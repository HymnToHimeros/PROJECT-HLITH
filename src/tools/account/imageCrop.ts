/**
 * The maths behind "Adjust picture": where the picture sits inside its frame
 * (the round profile picture, or the wide banner) and which part of it is kept.
 * No React and no browser drawing here, so every rule is easy to test.
 *
 * Units: the frame is measured in *output* pixels (the size of the saved picture,
 * see OUTPUT_SIZE). The picture is measured in its own pixels. `scale` is how many
 * output pixels one picture pixel takes. (cx, cy) is the picture point at the centre
 * of the frame.
 *
 * Two modes:
 *  - fill (the default): the picture always covers the whole frame. You can't zoom
 *    out or drag far enough to leave an empty gap.
 *  - fit: the whole picture shows. Where it doesn't reach the frame's edge, the
 *    default background shows instead. Only happens when you press "Fit".
 */

export type ImageKind = 'avatar' | 'banner';
export type FitMode = 'fill' | 'fit';

export interface Size {
  w: number;
  h: number;
}

export interface View {
  scale: number;
  cx: number;
  cy: number;
  mode: FitMode;
}

/** Saved picture sizes. The banner's shape (4 : 1) is the same shape it has on the profile. */
export const OUTPUT_SIZE: Record<ImageKind, Size> = { avatar: { w: 512, h: 512 }, banner: { w: 1600, h: 400 } };
/** Banner width ÷ height, used by the profile's CSS too. */
export const BANNER_RATIO = OUTPUT_SIZE.banner.w / OUTPUT_SIZE.banner.h;
/** How far in you can zoom, compared with "Fill". */
export const MAX_ZOOM = 5;
/** One press of + or − (or one slider step feels the same). */
export const ZOOM_STEP = 1.15;
/** One arrow-key press moves the picture this share of the frame's width; with Shift, five times as far. */
export const MOVE_STEP = 0.02;
export const OUTPUT_QUALITY = 0.85;

/** Smallest scale where the picture covers the whole frame. */
export const fillScale = (img: Size, out: Size) => Math.max(out.w / img.w, out.h / img.h);
/** Scale where the whole picture just fits inside the frame. */
export const fitScale = (img: Size, out: Size) => Math.min(out.w / img.w, out.h / img.h);
export const maxScale = (img: Size, out: Size) => fillScale(img, out) * MAX_ZOOM;
export const minScale = (img: Size, out: Size, mode: FitMode) => (mode === 'fit' ? fitScale(img, out) : fillScale(img, out));

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** One axis: keep the frame inside the picture, or (picture smaller than the frame, only in fit) the picture inside the frame. */
function clampCentre(c: number, imgLen: number, viewLen: number): number {
  const half = viewLen / 2;
  return viewLen <= imgLen ? clamp(c, half, imgLen - half) : clamp(c, imgLen - half, half);
}

/** Any view → a valid one: zoom within limits, and no gaps unless in fit mode. */
export function clampView(img: Size, out: Size, v: View): View {
  const scale = clamp(v.scale, minScale(img, out, v.mode), Math.max(maxScale(img, out), minScale(img, out, v.mode)));
  return {
    mode: v.mode,
    scale,
    cx: clampCentre(v.cx, img.w, out.w / scale),
    cy: clampCentre(v.cy, img.h, out.h / scale),
  };
}

/** Fill, centred: what you get after picking a file, and after Reset. */
export const initialView = (img: Size, out: Size): View => ({ mode: 'fill', scale: fillScale(img, out), cx: img.w / 2, cy: img.h / 2 });
/** "Fill": cover the frame, keeping the centre you chose where possible. */
export const fillView = (img: Size, out: Size, v: View): View => clampView(img, out, { ...v, mode: 'fill', scale: fillScale(img, out) });
/** "Fit": the whole picture, centred. */
export const fitView = (img: Size, out: Size): View => ({ mode: 'fit', scale: fitScale(img, out), cx: img.w / 2, cy: img.h / 2 });

/** Move the picture by (dx, dy) output pixels (right and down are positive), like dragging it. */
export function moveBy(img: Size, out: Size, v: View, dx: number, dy: number): View {
  return clampView(img, out, { ...v, cx: v.cx - dx / v.scale, cy: v.cy - dy / v.scale });
}

/**
 * Zoom to `scale`, keeping the picture point under `anchor` (output pixels from the
 * frame's top-left; the frame's centre when left out) in the same place.
 */
export function zoomTo(img: Size, out: Size, v: View, scale: number, anchor?: { x: number; y: number }): View {
  const ax = (anchor?.x ?? out.w / 2) - out.w / 2;
  const ay = (anchor?.y ?? out.h / 2) - out.h / 2;
  const target = clampView(img, out, { ...v, scale }).scale;
  // Picture point under the anchor stays put: cx + ax/scale is constant.
  return clampView(img, out, { ...v, scale: target, cx: v.cx + ax / v.scale - ax / target, cy: v.cy + ay / v.scale - ay / target });
}

export const zoomBy = (img: Size, out: Size, v: View, factor: number, anchor?: { x: number; y: number }) => zoomTo(img, out, v, v.scale * factor, anchor);

/** Zoom as a slider value: 1 = Fill, MAX_ZOOM = closest. Below 1 only in fit mode. */
export const zoomLevel = (img: Size, out: Size, v: View) => v.scale / fillScale(img, out);
export const zoomFromLevel = (img: Size, out: Size, level: number) => level * fillScale(img, out);

/** The part of the picture that is kept, in picture pixels. Can reach past the picture's edges only in fit mode. */
export function sourceRect(out: Size, v: View): { sx: number; sy: number; sw: number; sh: number } {
  const sw = out.w / v.scale;
  const sh = out.h / v.scale;
  return { sx: v.cx - sw / 2, sy: v.cy - sh / 2, sw, sh };
}

/** Where the whole picture lands, in output pixels from the frame's top-left. Used both to draw the saved picture and to show the editor. */
export function placement(img: Size, out: Size, v: View): { x: number; y: number; w: number; h: number } {
  const { sx, sy } = sourceRect(out, v);
  return { x: 0 - sx * v.scale, y: 0 - sy * v.scale, w: img.w * v.scale, h: img.h * v.scale };
}

/** Does any part of the frame show the background instead of the picture? */
export function hasGaps(img: Size, out: Size, v: View): boolean {
  const p = placement(img, out, v);
  const e = 0.5; // half an output pixel of rounding is not a gap
  return p.x > e || p.y > e || p.x + p.w < out.w - e || p.y + p.h < out.h - e;
}

export type KeyAction = { move: [number, number] } | { zoom: number } | { reset: true };

/** What a key does on the focused frame. null = not ours (let the browser handle it). */
export function keyAction(key: string, shift = false): KeyAction | null {
  const step = MOVE_STEP * (shift ? 5 : 1);
  switch (key) {
    case 'ArrowLeft':
      return { move: [-step, 0] };
    case 'ArrowRight':
      return { move: [step, 0] };
    case 'ArrowUp':
      return { move: [0, -step] };
    case 'ArrowDown':
      return { move: [0, step] };
    case '+':
    case '=':
      return { zoom: ZOOM_STEP };
    case '-':
    case '_':
      return { zoom: 1 / ZOOM_STEP };
    case '0':
      return { reset: true };
    default:
      return null;
  }
}

/** Apply a key's action. Moves are a share of the frame's width, so they feel the same on any screen. */
export function applyKey(img: Size, out: Size, v: View, action: KeyAction): View {
  if ('reset' in action) return initialView(img, out);
  if ('zoom' in action) return zoomBy(img, out, v, action.zoom);
  return moveBy(img, out, v, action.move[0] * out.w, action.move[1] * out.w);
}

/**
 * File type for the saved picture. Without gaps: JPEG (small, works everywhere).
 * With gaps (fit): a type that keeps see-through edges, so the default background
 * shows there; WebP when the browser can make it, else PNG.
 */
export function outputType(gaps: boolean, webp: boolean): 'image/jpeg' | 'image/webp' | 'image/png' {
  if (!gaps) return 'image/jpeg';
  return webp ? 'image/webp' : 'image/png';
}
