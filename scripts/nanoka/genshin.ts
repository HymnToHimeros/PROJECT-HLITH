/**
 * Genshin Impact from nanoka.cc ("gi"): characters and weapons. Pure (tests/genshinNanoka.test.ts);
 * scripts/import-nanoka.ts fetches and writes src/games/genshin/data.
 */
import { stripTags } from '../../src/core/text/markup.ts';

const STATIC = 'https://static.nanoka.cc';
const plain = (v: unknown) => stripTags(String(v));
const need = <T>(table: Record<string, T>, code: string, what: string, who: string): T => {
  const v = table[code];
  if (v === undefined) throw new Error(`Unknown ${what} code "${code}" for ${who}. Add it to the table in scripts/nanoka/genshin.ts.`);
  return v;
};

export interface GenshinCharacter {
  id: string;
  name: string;
  rarity: 'top' | 'mid';
  element: string;
  role: string;
  releasedAt?: string;
  art?: string;
  portrait?: string;
  source: string;
  leak?: { source: string };
}

// Genshin: weapon types → roles (the game has no classes; the weapon a character uses is how it groups them).
export const GI_WEAPON: Record<string, string> = {
  WEAPON_SWORD_ONE_HAND: 'sword',
  WEAPON_CLAYMORE: 'claymore',
  WEAPON_POLE: 'polearm',
  WEAPON_BOW: 'bow',
  WEAPON_CATALYST: 'catalyst',
};
export const GI_ELEMENT: Record<string, string> = { Pyro: 'pyro', Hydro: 'hydro', Anemo: 'anemo', Electro: 'electro', Dendro: 'dendro', Cryo: 'cryo', Geo: 'geo' };

/**
 * Genshin (nanoka "gi"). Left out: Miliastra Wonderland's mannequins (Manekin/Manekina, a separate
 * mode) and entries without an element (placeholders, e.g. the crossbow Travelers). The Traveler
 * is one entry per element, like HSR's Trailblazer: "Traveler · Pyro (Aether)". Release dates are
 * nanoka's (a calendar day; 1970 = none), at noon UTC+8.
 */
export function genshin(data: Record<string, Record<string, unknown>>): GenshinCharacter[] {
  const out: GenshinCharacter[] = [];
  for (const [id, c] of Object.entries(data)) {
    const icon = String(c.icon ?? '');
    if (/Mannequin/i.test(icon) || c.element === 'None') continue;
    const element = need(GI_ELEMENT, String(c.element), 'element', id);
    let name = plain(c.en);
    if (/^1000000[57]-\d$/.test(id)) name = `Traveler · ${String(c.element)} (${id.startsWith('10000005') ? 'Aether' : 'Lumine'})`;
    const day = /^(\d{4}-\d{2}-\d{2})/.exec(String(c.release ?? ''))?.[1];
    const short = icon.replace(/^UI_AvatarIcon_/, '');
    out.push({
      id,
      name,
      rarity: String(c.rank).startsWith('QUALITY_ORANGE') ? 'top' : 'mid',
      element,
      role: need(GI_WEAPON, String(c.weapon), 'weapon type', id),
      ...(day && !day.startsWith('1970') ? { releasedAt: `${day}T04:00:00.000Z` } : {}),
      art: `${STATIC}/assets/gi/UI_Gacha_AvatarImg_${short}.webp`,
      portrait: `${STATIC}/assets/gi/${icon}.webp`,
      source: 'nanoka.cc',
    });
  }
  return out;
}

/**
 * Genshin weapons (nanoka "gi"): 5★ top, 4★ mid, 3★ low. Left out: appearance skins, 1–2★, a special
 * mode's items (type ITEM_TPS_WEAPON) and weapons of an unreleased build (`unreleased`, nanoka's new list).
 */
export function genshinWeapons(
  data: Record<string, Record<string, unknown>>,
  unreleased: Set<string> = new Set(),
): { id: string; name: string; rarity: 'top' | 'mid' | 'low'; icon: string; type: string; source: string }[] {
  const tier: Record<number, 'top' | 'mid' | 'low'> = { 5: 'top', 4: 'mid', 3: 'low' };
  return Object.entries(data)
    .filter(([id, w]) => !w.skin && tier[Number(w.rank)] && w.type !== 'ITEM_TPS_WEAPON' && !unreleased.has(id))
    .map(([id, w]) => ({
      id,
      name: plain(w.en),
      rarity: tier[Number(w.rank)] as 'top' | 'mid' | 'low',
      icon: `${STATIC}/assets/gi/${String(w.icon)}.webp`,
      type: need(GI_WEAPON, String(w.type), 'weapon type', id),
      source: 'nanoka.cc',
    }))
    .sort((a, b) => Number(a.id) - Number(b.id));
}

