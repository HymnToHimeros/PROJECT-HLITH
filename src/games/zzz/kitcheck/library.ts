/** The ZZZ kit check's three ingredients, built from the game data and the cheat sheet. */
import type { Kit, Weapon } from '../../../core/contract';
import characters from '../data/characters.json';
import kitsJson from '../data/kits.json';
import weapons from '../data/weapons.json';
import { withSignatureWeapons } from '../../../core/rules/signatureWeapons';
import profiles from '../data/profiles.json';
import type { Library, Profile } from './check';
import { groupA } from './sheet/groupA';
import { groupB } from './sheet/groupB';
import { groupC } from './sheet/groupC';
import { groupD } from './sheet/groupD';
import { groupE } from './sheet/groupE';
import { groupF } from './sheet/groupF';
import { groupG } from './sheet/groupG';
import { groupH } from './sheet/groupH';
import { groupI } from './sheet/groupI';
import type { CharacterSheet, WeaponSheet } from './types';
import { WEAPON_SHEETS } from './weapons';
import { weaponPiece } from './check';

/** Every kit, with each character's signature W-Engine as one more piece (counted only when equipped). */
export const KITS: Kit[] = withSignatureWeapons(kitsJson as Kit[], weapons as Weapon[], 'W-Engine');

/** Every character read so far, group by group. */
export const SHEETS: CharacterSheet[] = [...groupA, ...groupB, ...groupC, ...groupD, ...groupE, ...groupF, ...groupG, ...groupH, ...groupI];

/**
 * Every W-Engine the check can read (T18 step 4). A signature's entries come from its agent's sheet (piece
 * `signature-weapon`); the rest from the weapon sheets. Entry ids get the weapon's id in front, so a W-Engine never
 * clashes with the wearer's own entries.
 */
export function weaponLibrary(sheets: CharacterSheet[], weaponSheets: WeaponSheet[] = WEAPON_SHEETS, list: Weapon[] = weapons as Weapon[]): Library['weapons'] {
  const out: Library['weapons'] = new Map();
  for (const w of list) {
    if (!w.role) continue;
    const read = w.madeFor ? sheets.find((s) => s.characterId === w.madeFor)?.entries.filter((e) => e.piece === 'signature-weapon') : weaponSheets.find((s) => s.weaponId === w.id)?.entries;
    if (!read) continue;
    const entries = read.map((e) => ({ ...e, id: `w${w.id}-${e.id}`, piece: weaponPiece(w.id) }));
    out.set(w.id, { name: w.name, role: w.role, ...(w.madeFor ? { madeFor: w.madeFor } : {}), label: `W-Engine: ${w.name}`, entries });
  }
  return out;
}

export function buildLibrary(sheets: CharacterSheet[] = SHEETS, kitList: Kit[] = KITS): Library {
  return {
    profiles: new Map((profiles as Profile[]).map((p) => [p.characterId, p])),
    sheets: new Map(sheets.map((s) => [s.characterId, s])),
    unlocks: new Map(
      kitList.map((k) => [
        k.characterId,
        new Map(k.skills.flatMap((s) => (s.unlock || s.replacedAt ? [[s.id, { ...s.unlock, ...(s.replacedAt ? { replacedAt: s.replacedAt.potential } : {}) }] as const] : []))),
      ]),
    ),
    pieceLabels: new Map(kitList.map((k) => [k.characterId, new Map(k.skills.map((s) => [s.id, s.label] as const))])),
    names: new Map(characters.map((c) => [c.id, c.name])),
    weapons: weaponLibrary(sheets),
  };
}

let cached: Library | undefined;
export const library = () => (cached ??= buildLibrary());
