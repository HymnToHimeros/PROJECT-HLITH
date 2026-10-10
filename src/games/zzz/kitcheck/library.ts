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
import type { CharacterSheet } from './types';

/** Every kit, with each character's signature W-Engine as one more piece (counted only when equipped). */
export const KITS: Kit[] = withSignatureWeapons(kitsJson as Kit[], weapons as Weapon[], 'W-Engine');

/** Every character read so far, group by group. */
export const SHEETS: CharacterSheet[] = [...groupA, ...groupB, ...groupC, ...groupD, ...groupE, ...groupF, ...groupG, ...groupH, ...groupI];

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
  };
}

let cached: Library | undefined;
export const library = () => (cached ??= buildLibrary());
