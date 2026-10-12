/**
 * The owner's look (T64): which owner badge, picture frame and name style the owner wears.
 * The owner picked all of them from the option sheets (docs/owner-reports/2026-10-11/) and
 * keeps every one as a choice. Only the owner ever sees a choice here, and the server shows
 * them on a card only for the owner (public.profile_card, 0017). No React, no drawings here:
 * the drawings load only for the owner (OwnerArt.tsx).
 */

/** Badge 0 is the original (BadgeMark.tsx); 1–8 are the round-3 badges. */
export const OWNER_BADGES = 9;
export const OWNER_FRAMES = 20;
export const OWNER_NAMES = 20;

export interface OwnerStyle {
  badge: number;
  /** null = the normal frame choice. */
  frame: number | null;
  /** null = the normal name colour. */
  name: number | null;
}
export const DEFAULT_OWNER_STYLE: OwnerStyle = { badge: 0, frame: null, name: null };

/** A badge with the frame and name style made to match it (owner: "it's cool when they match"). */
export interface OwnerSet {
  id: number;
  name: string;
  badge: number;
  frame: number;
  nameStyle: number;
}
export const OWNER_SETS: readonly OwnerSet[] = ['Draupnir', 'Geri & Freki', 'Gungnir', 'Sól & Máni', 'Nine Realms', 'Urnes Serpent', 'Valhalla', 'Gjallarhorn'].map((name, i) => ({
  id: i + 1,
  name,
  badge: i + 1,
  frame: i + 13,
  nameStyle: i + 13,
}));

const inRange = (v: unknown, lo: number, hi: number): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : null);

export function cleanOwnerStyle(raw: unknown): OwnerStyle {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return { badge: inRange(r.badge, 0, OWNER_BADGES - 1) ?? 0, frame: inRange(r.frame, 1, OWNER_FRAMES), name: inRange(r.name, 1, OWNER_NAMES) };
}

export const wearSet = (s: OwnerSet): OwnerStyle => ({ badge: s.badge, frame: s.frame, name: s.nameStyle });

/** The set being worn in full, if any. */
export const wornSet = (st: OwnerStyle): OwnerSet | undefined => OWNER_SETS.find((s) => s.badge === st.badge && s.frame === st.frame && s.nameStyle === st.name);

export const isDefaultOwnerStyle = (st: OwnerStyle) => st.badge === 0 && st.frame === null && st.name === null;
