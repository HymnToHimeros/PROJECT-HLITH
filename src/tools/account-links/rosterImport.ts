/**
 * Roster import from HoYoLAB: compare what HoYoLAB lists with your roster, then
 * add or raise. It only ever ADDS: characters become owned and their dupes go
 * up (never down, since dupes can't be lost in the game). Nothing is removed,
 * or un-owned (a character that becomes owned leaves your wanted list), and characters
 * HoYoLAB doesn't list are left alone.
 */
import type { Character, GameContract } from '../../core/contract';
import { setRosterEntry, type RosterEntry } from '../../core/data/userData';
import type { HoyoCharacter } from './hoyolab';

export type ImportStatus = 'new' | 'update' | 'same' | 'unknown';

export interface ImportRow {
  /** HLITH character id, or null when HLITH's list doesn't have them. */
  id: string | null;
  name: string;
  status: ImportStatus;
  dupesBefore: number | null;
  dupesAfter: number;
  level: number | null;
  weapon: string | null;
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

export function planImport(game: GameContract, imported: HoyoCharacter[], characters: Character[], roster: Record<string, RosterEntry>): ImportRow[] {
  const byId = new Map(characters.map((c) => [c.id, c]));
  const byName = new Map(characters.map((c) => [norm(c.name), c]));
  const max = game.dupes?.max ?? 0;
  const rows: ImportRow[] = [];
  const seen = new Set<string>();
  for (const h of imported) {
    const match = byId.get(h.id) ?? byName.get(norm(h.name));
    const dupes = Math.min(max, Math.max(0, Math.floor(h.dupes)));
    const base = { name: match?.name ?? h.name, level: h.level, weapon: h.weapon?.name ?? null };
    if (!match) {
      rows.push({ ...base, id: null, status: 'unknown', dupesBefore: null, dupesAfter: dupes });
      continue;
    }
    if (seen.has(match.id)) continue;
    seen.add(match.id);
    const before = roster[match.id];
    const after = Math.max(before?.dupes ?? 0, dupes);
    const status: ImportStatus = !before?.owned ? 'new' : after > before.dupes ? 'update' : 'same';
    rows.push({ ...base, id: match.id, status, dupesBefore: before?.owned ? before.dupes : null, dupesAfter: after });
  }
  const order: Record<ImportStatus, number> = { new: 0, update: 1, same: 2, unknown: 3 };
  return rows.sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name));
}

/** Write the plan: owned = true (so no longer wanted), dupes raised. Returns counts. */
export function applyImport(gameId: string, rows: ImportRow[], roster: Record<string, RosterEntry>): { added: number; updated: number } {
  let added = 0;
  let updated = 0;
  for (const r of rows) {
    if (!r.id || (r.status !== 'new' && r.status !== 'update')) continue;
    const before = roster[r.id];
    setRosterEntry(gameId, r.id, { owned: true, wanted: before?.owned ? before.wanted : false, dupes: Math.max(before?.dupes ?? 0, r.dupesAfter) });
    if (r.status === 'new') added++;
    else updated++;
  }
  return { added, updated };
}
