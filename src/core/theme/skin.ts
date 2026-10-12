/**
 * Skins (T74): how a theme dresses the app beyond colours. Cards, sidebar, header, headings,
 * buttons, chips, progress bars and spacing each pick one style from a fixed list below, and the
 * generic CSS in skins.css draws it. Pictures a style uses (a card frame, corner ornaments, a
 * divider, sidebar and header art, and the background scene) come from the theme's own pack file
 * in its private store, loaded only while the theme is worn (skinPack.ts).
 *
 * Nothing here belongs to a theme: names are neutral and colours come from the theme's tokens.
 */

export const CARD_SHAPES = ['soft', 'sharp', 'notched', 'bevel', 'arched', 'folded', 'lozenge'] as const;
export const CARD_INNERS = ['none', 'line', 'double', 'dashed', 'glow', 'inset'] as const;
export const CARD_SURFACES = ['flat', 'rise', 'vignette', 'grain', 'glass', 'sheen'] as const;
export const SIDE_STYLES = ['plain', 'panel', 'rail', 'carved', 'banner', 'glass'] as const;
export const HEAD_STYLES = ['plain', 'band', 'ribbon', 'horizon', 'plaque'] as const;
export const TITLE_STYLES = ['plain', 'warm', 'cool', 'tri', 'engraved', 'glow-warm', 'glow-cool', 'molten', 'storm'] as const;
export const TITLE_FONTS = [
  'default',
  'cinzel',
  'cinzel-decorative',
  'cormorant-sc',
  'marcellus-sc',
  'im-fell-english-sc',
  'metamorphous',
  'uncial-antiqua',
  'almendra-sc',
  'pirata-one',
  'grenze-gotisch',
] as const;
export const BUTTON_STYLES = ['default', 'pill', 'plate', 'blade', 'bevel', 'ghost', 'shield', 'lozenge'] as const;
export const CHIP_STYLES = ['default', 'pill', 'tag', 'orb', 'plate', 'rune'] as const;
export const PROGRESS_STYLES = ['default', 'segmented', 'glow', 'beads', 'stripes', 'notched', 'rope', 'shields'] as const;
export const LAYOUTS = ['standard', 'airy', 'compact', 'centered', 'framed'] as const;

export interface Skin {
  card: (typeof CARD_SHAPES)[number];
  inner: (typeof CARD_INNERS)[number];
  surface: (typeof CARD_SURFACES)[number];
  side: (typeof SIDE_STYLES)[number];
  head: (typeof HEAD_STYLES)[number];
  title: (typeof TITLE_STYLES)[number];
  font: (typeof TITLE_FONTS)[number];
  button: (typeof BUTTON_STYLES)[number];
  chip: (typeof CHIP_STYLES)[number];
  progress: (typeof PROGRESS_STYLES)[number];
  layout: (typeof LAYOUTS)[number];
  /** The theme's pack file (pictures for the styles above and the background scene), a path in the private store. */
  pack?: string;
}

const pick = <T extends readonly string[]>(list: T, v: unknown, fallback: T[number]): T[number] => ((list as readonly unknown[]).includes(v) ? (v as T[number]) : fallback);

/** Reads a manifest's `look`: every choice from its list (anything else falls back to the plain one). The pack path is checked by the caller. */
export function readSkin(raw: unknown): Omit<Skin, 'pack'> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  return {
    card: pick(CARD_SHAPES, r.card, 'soft'),
    inner: pick(CARD_INNERS, r.inner, 'none'),
    surface: pick(CARD_SURFACES, r.surface, 'flat'),
    side: pick(SIDE_STYLES, r.side, 'plain'),
    head: pick(HEAD_STYLES, r.head, 'plain'),
    title: pick(TITLE_STYLES, r.title, 'plain'),
    font: pick(TITLE_FONTS, r.font, 'default'),
    button: pick(BUTTON_STYLES, r.button, 'default'),
    chip: pick(CHIP_STYLES, r.chip, 'default'),
    progress: pick(PROGRESS_STYLES, r.progress, 'default'),
    layout: pick(LAYOUTS, r.layout, 'standard'),
  };
}

const KEYS = ['card', 'inner', 'surface', 'side', 'head', 'title', 'font', 'button', 'chip', 'progress', 'layout'] as const;

/** Puts the skin's choices on <html> as data-skin-* (skins.css reads them); none = all taken off. */
export function applySkin(skin: Skin | undefined, root: HTMLElement = document.documentElement): void {
  for (const k of KEYS) {
    if (skin) root.setAttribute(`data-skin-${k}`, skin[k]);
    else root.removeAttribute(`data-skin-${k}`);
  }
  if (skin) {
    root.dataset.skin = 'on';
    void loadFont(skin.font);
  } else delete root.dataset.skin;
}

/** Heading fonts load only when a worn skin asks for one (each is its own small file). */
const FONTS: Record<Exclude<Skin['font'], 'default'>, () => Promise<unknown>> = {
  cinzel: () => import('@fontsource/cinzel/600.css'),
  'cinzel-decorative': () => import('@fontsource/cinzel-decorative/700.css'),
  'cormorant-sc': () => import('@fontsource/cormorant-sc/600.css'),
  'marcellus-sc': () => import('@fontsource/marcellus-sc/400.css'),
  'im-fell-english-sc': () => import('@fontsource/im-fell-english-sc/400.css'),
  metamorphous: () => import('@fontsource/metamorphous/400.css'),
  'uncial-antiqua': () => import('@fontsource/uncial-antiqua/400.css'),
  'almendra-sc': () => import('@fontsource/almendra-sc/400.css'),
  'pirata-one': () => import('@fontsource/pirata-one/400.css'),
  'grenze-gotisch': () => import('@fontsource/grenze-gotisch/600.css'),
};
export async function loadFont(font: Skin['font']): Promise<void> {
  if (font === 'default') return;
  try {
    await FONTS[font]();
  } catch {
    /* offline: the heading keeps the app's own font */
  }
}
