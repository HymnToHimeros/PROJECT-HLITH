/**
 * Screenshot scan of a character screen (R50): which fields the game's record
 * asks for (`scan.fields`), what each means, and how a confirmed reading is saved.
 *
 * Saved today: owned + dupes (the roster holds those). Level, weapon, gear and
 * skills are read and confirmed but not stored yet: HLITH has no build store
 * (ROSTER-LOGIC adds it and fills `saveBuild` here).
 */
import type { GameContract } from '../../core/contract';
import { setRosterEntry, type RosterEntry } from '../../core/data/userData';

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
    if (n === 'level') return { id, label: 'Level', kind: 'level', saved: false, max: 100 };
    if (game.dupes && n === norm(game.dupes.name)) return { id, label: game.dupes.name, kind: 'dupes', saved: true, max: game.dupes.max };
    if (n === norm(terms.weapon)) return { id, label: terms.weapon, kind: 'text', saved: false };
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
 * you confirmed (empty leaves them as they were). `wanted` is kept.
 */
export function saveScan(game: GameContract, characterId: string, values: ScanValues, roster: Record<string, RosterEntry>): RosterEntry {
  const before = roster[characterId];
  const dupesField = fieldsFor(game).find((f) => f.kind === 'dupes');
  const typed = dupesField ? (values[dupesField.id] ?? '').trim() : '';
  const entry: RosterEntry = { owned: true, wanted: before?.wanted ?? false, dupes: typed ? Number(typed) : (before?.dupes ?? 0) };
  setRosterEntry(game.id, characterId, entry);
  return entry;
}

/**
 * Reading the image automatically is done by the Assistant with the player's own
 * key (another workstream). It plugs in here; until then it's absent and the
 * button says so.
 */
export type ScanReader = (image: Blob, fields: ScanField[]) => Promise<{ character?: string; values: ScanValues }>;
