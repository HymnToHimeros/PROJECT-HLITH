/** The ZZZ kit check's three ingredients, built from the game data and the cheat sheet. */
import type { Kit, Weapon } from '../../../core/contract';
import characters from '../data/characters.json';
import kitsJson from '../data/kits.json';
import weapons from '../data/weapons.json';
import { withSignatureWeapons } from '../../../core/rules/signatureWeapons';
import { staleReason, type SheetQuote } from '../../../core/rules/leaks';
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

/** Every quote a ZZZ sheet relies on: entries and their scaling, damage notes (T43, mirrors HSR). */
export const sheetQuotes = (s: CharacterSheet): SheetQuote[] => [
  ...s.entries.flatMap((e) => [{ piece: e.piece, quote: e.quote }, ...(e.scales ? [{ piece: e.piece, quote: e.scales.quote }] : [])]),
  ...(s.damage?.quotes ?? []),
];
const readPieces = (s: CharacterSheet) => new Set([...s.entries.map((e) => e.piece), ...Object.keys(s.nothing)]);

export function buildLibrary(sheets: CharacterSheet[] = SHEETS, kitList: Kit[] = KITS): Library {
  const leaks = new Map((characters as { id: string; leak?: { source: string } }[]).flatMap((c) => (c.leak ? [[c.id, c.leak.source] as const] : [])));
  // T43: a leak's sheet whose beta text changed is not used until it is read again.
  const stale = new Map(
    sheets.flatMap((s) => {
      if (!leaks.has(s.characterId)) return [];
      const why = staleReason(sheetQuotes(s), readPieces(s), kitList.find((k) => k.characterId === s.characterId)?.skills);
      return why ? [[s.characterId, why] as const] : [];
    }),
  );
  sheets = sheets.filter((s) => !stale.has(s.characterId));
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
    leaks,
    ...(stale.size ? { stale } : {}),
    weapons: weaponLibrary(sheets),
  };
}

let cached: Library | undefined;
export const library = () => (cached ??= buildLibrary());
