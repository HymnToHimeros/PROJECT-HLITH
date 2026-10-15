/** The Endfield kit check's ingredients, built from the game data and the cheat sheet. */
import type { Kit } from '../../../core/contract';
import characters from '../data/characters.json';
import kitsJson from '../data/kits.json';
import type { Library, Profile } from './check';
import { groupA } from './sheet/groupA';
import { groupB } from './sheet/groupB';
import { groupC } from './sheet/groupC';
import { groupD } from './sheet/groupD';
import { groupE } from './sheet/groupE';
import type { CharacterSheet, Element, OpClass } from './types';

export const KITS = kitsJson as Kit[];

/** Every operator read so far, group by group. */
export const SHEETS: CharacterSheet[] = [...groupA, ...groupB, ...groupC, ...groupD, ...groupE];

/** Profiles for everyone, read or not: element and class from characters.json. */
export const PROFILES: Profile[] = (characters as { id: string; element: string; role: string }[]).map((c) => ({ characterId: c.id, element: c.element as Element, opClass: c.role as OpClass }));

/** The player character, male or female: one operator on two ids. */
export const SAME_OPERATOR = [['chr_0002_endminm', 'chr_0003_endminf']];

export function buildLibrary(sheets: CharacterSheet[] = SHEETS, kitList: Kit[] = KITS): Library {
  return {
    profiles: new Map(PROFILES.map((p) => [p.characterId, p])),
    sheets: new Map(sheets.map((s) => [s.characterId, s])),
    unlocks: new Map(kitList.map((k) => [k.characterId, new Map(k.skills.flatMap((s) => (s.unlock?.potential ? [[s.id, { potential: s.unlock.potential }] as const] : [])))])),
    pieceLabels: new Map(kitList.map((k) => [k.characterId, new Map(k.skills.map((s) => [s.id, s.label] as const))])),
    names: new Map(characters.map((c) => [c.id, c.name])),
    releasedAt: new Map((characters as { id: string; releasedAt?: string }[]).flatMap((c) => (c.releasedAt ? [[c.id, c.releasedAt] as const] : []))),
    sameOperator: SAME_OPERATOR,
  };
}

let cached: Library | undefined;
export const library = () => (cached ??= buildLibrary());
