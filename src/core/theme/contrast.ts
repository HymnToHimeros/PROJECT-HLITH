/** WCAG 2 contrast. Used by token tests and, later, to reject a game's vent. */
export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m?.[1]) throw new Error(`Not a 6-digit hex colour: ${hex}`);
  const n = parseInt(m[1], 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** A new game's vent: 7:1 with the text drawn on it, and not orange or red (ember is reserved). */
export function ventProblems(vent: string, onVent = '#08090B'): string[] {
  const out: string[] = [];
  const ratio = contrast(vent, onVent);
  if (ratio < 7) out.push(`vent ${vent} reaches only ${ratio.toFixed(2)}:1 with ${onVent}, needs 7:1`);
  const hue = hueOf(vent);
  if (hue !== null && (hue < 45 || hue >= 345)) out.push(`vent ${vent} is orange or red, which is reserved for ember`);
  return out;
}

function hueOf(hex: string): number | null {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d < 0.08) return null; // greys have no hue worth judging
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}
