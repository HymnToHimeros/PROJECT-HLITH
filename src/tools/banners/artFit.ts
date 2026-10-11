/**
 * Where to crop banner art so the important part is in view, whatever the picture's shape.
 * The lists carry no focus point, so it is worked out from the picture's own shape:
 * a tall picture is a full-body portrait with the face near the top (ZZZ agents: about 13%
 * down); a square or wide one is a splash with the character nearer the middle (HSR: about
 * 38% down). The crop puts the face about a third of the way down the frame, so the head and
 * upper body show above the card's text. Weapon art is never cropped (see BannerArt).
 */

/** Face height as a share of the picture, by shape (height ÷ width). */
export function faceAt(ratio: number): number {
  return ratio > 1.15 ? 0.13 : 0.38;
}

/** Where the face should sit in the frame, from the top. */
const FACE_IN_FRAME = 0.3;

/**
 * The vertical object-position (0–100 %) for `object-fit: cover` that keeps the face in view.
 * 50 when nothing is cropped vertically or a size is unknown.
 */
export function coverFocusY(natural: { w: number; h: number }, box: { w: number; h: number }): number {
  if (natural.w <= 0 || natural.h <= 0 || box.w <= 0 || box.h <= 0) return 50;
  const scale = Math.max(box.w / natural.w, box.h / natural.h);
  const shownHeight = natural.h * scale;
  const extra = shownHeight - box.h;
  if (extra < 1) return 50;
  const top = faceAt(natural.h / natural.w) * shownHeight - FACE_IN_FRAME * box.h;
  return Math.round(Math.min(1, Math.max(0, top / extra)) * 1000) / 10;
}
