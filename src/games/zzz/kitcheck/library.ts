/** The ZZZ kit check's three ingredients, built from the game data and the cheat sheet. */
import type { Kit } from '../../../core/contract';
import characters from '../data/characters.json';
import kits from '../data/kits.json';
import profiles from '../data/profiles.json';
import type { Library, Profile } from './check';
import { groupA } from './sheet/groupA';
import { groupB } from './sheet/groupB';
import type { CharacterSheet } from './types';

/** Every character read so far, group by group. */
export const SHEETS: CharacterSheet[] = [...groupA, ...groupB];

export function buildLibrary(sheets: CharacterSheet[] = SHEETS, kitList: Kit[] = kits as Kit[]): Library {
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
