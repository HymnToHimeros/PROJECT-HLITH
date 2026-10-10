/** The HSR kit check's ingredients, built from the game data and the cheat sheet. */
import type { Kit, TeamPreset, Weapon } from '../../../core/contract';
import characters from '../data/characters.json';
import kitsJson from '../data/kits.json';
import weapons from '../data/weapons.json';
import { withSignatureWeapons } from '../../../core/rules/signatureWeapons';
import { staleReason, type SheetQuote } from '../../../core/rules/leaks';
import gameTeams from '../data/teams.json';
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
import type { CharacterSheet, Element, Path, WeaponSheet } from './types';
import { WEAPON_SHEETS } from './weapons';
import { weaponPiece } from './check';

/** Every kit, with each character's signature Light Cone as one more piece (counted only when equipped). */
export const KITS: Kit[] = withSignatureWeapons(kitsJson as Kit[], weapons as Weapon[], 'Light Cone');

/** Every character read so far, group by group. */
export const SHEETS: CharacterSheet[] = [...groupA, ...groupB, ...groupC, ...groupD, ...groupE, ...groupF, ...groupG, ...groupH, ...groupI];

/** The page's character of a game team (`game-<id>-<n>`). */
export const pageOf = (team: TeamPreset) => /^game-(\d+)-/.exec(team.id)?.[1];

/**
 * Who a game team is built around: its first member when they can carry, else the page's character when they can.
 * The game lists a support's or partner's team with its real carry first (March 7th (Hunt): Feixiao, March 7th, …).
 */
export function centreOf(team: TeamPreset, carries: Set<string>): string | undefined {
  const first = team.slots[0]?.characters[0];
  const page = pageOf(team);
  return first && carries.has(first) ? first : page && carries.has(page) ? page : undefined;
}

/**
 * A carry's OWN game team: one shown on that carry's page and built around them (owner's report, 2026-10-10). Other
 * pages' teams are starter line-ups that force that page's character in beside today's top carry ("Phainon with
 * March 7th"): they are not teams anyone plays, so they are never used (hsr-decisions.md 30).
 */
export const isOwnTeam = (team: TeamPreset, carries: Set<string>) => {
  const page = pageOf(team);
  if (!page || !carries.has(page) || !team.slots.some((s) => s.characters.includes(page))) return false;
  // A partner's page leads with the real carry alone in the first slot (Topaz's page: "Feixiao" | Topaz | …); a
  // carry's own page lists other carries as options (The Herta's: "Anaxa, Jade, Herta, Serval" | The Herta | …) or
  // further along (Aventurine • Waveflair's: "Mortenax Blade, Ashveil" | him | "Ashveil" | sustain).
  const first = team.slots[0]?.characters ?? [];
  return !(first.length === 1 && first[0] !== page && carries.has(first[0] ?? ''));
};

/** Who each carry's own game teams list, in any slot: the only teammates the check tries for them. */
function allowedFor(teams: TeamPreset[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const t of teams) {
    const page = pageOf(t);
    if (page) out.set(page, new Set([...(out.get(page) ?? []), ...t.slots.flatMap((s) => s.characters).filter((id) => id !== page)]));
  }
  return out;
}

function ownTeamsOf(teams: TeamPreset[]): Library['ownTeams'] {
  const out: Library['ownTeams'] = new Map();
  for (const t of teams) {
    const page = pageOf(t);
    if (page) out.set(page, [...(out.get(page) ?? []), { id: t.id, slots: t.slots.map((s) => s.characters) }]);
  }
  return out;
}

function pairs(teams: TeamPreset[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const t of teams) {
    const all = t.slots.flatMap((s) => s.characters);
    for (const a of all) for (const b of all) if (a !== b) out.set(a, (out.get(a) ?? new Set()).add(b));
  }
  return out;
}

/**
 * Every Light Cone the check can read (T18 step 4). A signature's entries come from its character's sheet (piece
 * `signature-weapon`); the rest from the weapon sheets. Entry ids get the weapon's id in front, so a Light Cone never
 * clashes with the wearer's own entries.
 */
export function weaponLibrary(sheets: CharacterSheet[], weaponSheets: WeaponSheet[] = WEAPON_SHEETS, list: Weapon[] = weapons as Weapon[]): Library['weapons'] {
  const out: Library['weapons'] = new Map();
  for (const w of list) {
    if (!w.role) continue;
    const read = w.madeFor ? sheets.find((s) => s.characterId === w.madeFor)?.entries.filter((e) => e.piece === 'signature-weapon') : weaponSheets.find((s) => s.weaponId === w.id)?.entries;
    if (!read) continue;
    const entries = read.map((e) => ({ ...e, id: `w${w.id}-${e.id}`, piece: weaponPiece(w.id) }));
    out.set(w.id, { name: w.name, role: w.role, ...(w.madeFor ? { madeFor: w.madeFor } : {}), label: `Light Cone: ${w.name}`, entries });
  }
  return out;
}

/** Every quote an HSR sheet relies on: entries and their scaling, damage notes, the alone part (T43). */
export const sheetQuotes = (s: CharacterSheet): SheetQuote[] => [
  ...s.entries.flatMap((e) => [{ piece: e.piece, quote: e.quote }, ...(e.scales ? [{ piece: e.piece, quote: e.scales.quote }] : [])]),
  ...(s.damage?.quotes ?? []),
  ...(s.damage?.alone ? [{ piece: s.damage.alone.piece, quote: s.damage.alone.quote }, ...(s.damage.alone.turns ? [{ piece: s.damage.alone.piece, quote: s.damage.alone.turns.quote }] : [])] : []),
];
/** The kit pieces a sheet reads: an entry or a "nothing" reason. */
const readPieces = (s: CharacterSheet) => new Set([...s.entries.map((e) => e.piece), ...Object.keys(s.nothing)]);

export function buildLibrary(sheets: CharacterSheet[] = SHEETS, kitList: Kit[] = KITS, teams: TeamPreset[] = gameTeams as TeamPreset[]): Library {
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
  const carries = new Set(sheets.filter((s) => s.damage).map((s) => s.characterId));
  const own = teams.filter((t) => isOwnTeam(t, carries));
  return {
    centres: new Set(own.map((t) => pageOf(t)).filter((x): x is string => !!x)),
    pairedWith: pairs(own),
    allowed: allowedFor(own),
    ownTeams: ownTeamsOf(own),
    profiles: new Map(characters.map((c) => [c.id, { characterId: c.id, path: c.role as Path, element: c.element as Element } satisfies Profile])),
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
