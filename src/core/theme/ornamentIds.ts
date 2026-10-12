/** Ids of the generic background layers (ornaments.tsx) and menu accent shapes (shell.module.css). */
export const MOTIF_LAYERS = ['orbit-light', 'corona-ring', 'phase-band', 'ember-rise', 'frost-trail', 'storm-streaks', 'aurora-veil', 'knot-band', 'shield-row', 'sound-rings'] as const;
export const TEXTURE_LAYERS = ['starfield', 'grain', 'hex-mesh', 'rune-rows'] as const;
/** Accent shapes mark the active item in the menu (shell.module.css). */
export const ACCENT_SHAPES = ['accent-diamond', 'accent-crescent', 'accent-ring', 'accent-rune'] as const;
export type Layer = (typeof MOTIF_LAYERS)[number] | (typeof TEXTURE_LAYERS)[number];
