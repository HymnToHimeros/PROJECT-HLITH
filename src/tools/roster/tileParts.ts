/** What a Roster tile can show; Customise → Roster switches each off (T52c). */
export const TILE_PARTS = ['copies', 'element', 'rarity', 'role', 'tags'] as const;
export type TilePart = (typeof TILE_PARTS)[number];
