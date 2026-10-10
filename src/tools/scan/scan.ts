/**
 * Screenshot scan of a character screen (R50): which fields the game's record
 * asks for (`scan.fields`), what each means, and how a confirmed reading is saved.
 *
 * Saved: owned + dupes (the roster), and level and weapon into the character's saved
 * build when the game has builds (`GameContract.build`). Gear and skills are read and
 * confirmed but entered in the build form, piece by piece.
 */
import type { GameContract } from '../../core/contract';
import { gameData, setBuild, setRosterEntry, type RosterEntry } from '../../core/data/userData';

export type FieldKind = 'level' | 'dupes' | 'text';
export interface ScanField {
  id: string;
  label: string;
  kind: FieldKind;
  /** True when HLITH saves this field today. */
  saved: boolean;
  max?: number;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/s$/, '');

export function fieldsFor(game: GameContract): ScanField[] {
  const terms = game.terms;
  return (game.scan?.fields ?? []).map((id): ScanField => {
    const n = norm(id);
    if (n === 'level') return { id, label: 'Level', kind: 'level', saved: Boolean(game.build), max: game.build?.levelMax ?? 100 };
    if (game.dupes && n === norm(game.dupes.name)) return { id, label: game.dupes.name, kind: 'dupes', saved: true, max: game.dupes.max };
    if (n === norm(terms.weapon)) return { id, label: terms.weapon, kind: 'text', saved: Boolean(game.build) };
    if (n === norm(terms.gear)) return { id, label: terms.gear, kind: 'text', saved: false };
    if (n === norm(terms.skill)) return { id, label: terms.skill, kind: 'text', saved: false };
    const words = id.replace(/[-_]+/g, ' ');
    return { id, label: words.charAt(0).toUpperCase() + words.slice(1), kind: 'text', saved: false };
  });
}

export type ScanValues = Record<string, string>;

/** Check the form: numbers in range; empty = "leave as it was". Returns problems by field id. */
export function checkValues(fields: ScanField[], values: ScanValues): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    const v = (values[f.id] ?? '').trim();
    if (!v || f.kind === 'text') continue;
    const n = Number(v);
    const min = f.kind === 'level' ? 1 : 0;
    if (!Number.isInteger(n) || n < min || (f.max !== undefined && n > f.max)) out[f.id] = `${f.label} must be a whole number from ${min} to ${f.max ?? '…'}.`;
  }
  return out;
}

/**
 * Save a confirmed reading: the character becomes owned; dupes are set to what
 * you confirmed (empty leaves them as they were). Newly owned means no longer wanted.
 */
export function saveScan(game: GameContract, characterId: string, values: ScanValues, roster: Record<string, RosterEntry>): RosterEntry {
  const before = roster[characterId];
  const dupesField = fieldsFor(game).find((f) => f.kind === 'dupes');
  const typed = dupesField ? (values[dupesField.id] ?? '').trim() : '';
  const entry: RosterEntry = { owned: true, wanted: before?.owned ? before.wanted : false, dupes: typed ? Number(typed) : (before?.dupes ?? 0) };
  setRosterEntry(game.id, characterId, entry);
  saveBuildFields(game, characterId, values);
  return entry;
}

/** Level and weapon from a scan go into the saved build; everything else in it stays. */
function saveBuildFields(game: GameContract, characterId: string, values: ScanValues): void {
  if (!game.build) return;
  const fields = fieldsFor(game);
  const typed = (kind: FieldKind, weapon = false) => {
    const f = fields.find((x) => x.kind === kind && (!weapon || norm(x.id) === norm(game.terms.weapon)));
    return f ? (values[f.id] ?? '').trim() : '';
  };
  const level = typed('level');
  const weapon = typed('text', true);
  if (!level && !weapon) return;
  const before = gameData(game.id).builds?.[characterId];
  const sameWeapon = before?.weapon && before.weapon.name.toLowerCase() === weapon.toLowerCase();
  setBuild(game.id, characterId, {
    ...(before ?? { gear: [] }),
    ...(level ? { level: Number(level) } : {}),
    ...(weapon ? { weapon: sameWeapon && before.weapon ? before.weapon : { name: weapon } } : {}),
    source: 'scan',
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Reading the image automatically is done by the Assistant with the player's own
 * key (another workstream). It plugs in here; until then it's absent and the
 * button says so.
 */
export type ScanReader = (image: Blob, fields: ScanField[]) => Promise<{ character?: string; values: ScanValues }>;
