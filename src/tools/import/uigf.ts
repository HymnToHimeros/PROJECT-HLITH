/**
 * Pull history from export files (CLAUDE.md Override 2: history comes only from
 * the in-game link and export files, never HoYoLAB).
 * Reads UIGF v4 (any game section) and SRGF v1 (Star Rail). Game-specific rules
 * come from the game record's historyMapping, so this file names no game.
 */
import type { GameId, HistoryMapping, PullRecord } from '../../core/contract';
import { isHlithFile, parseHlithFile } from './hlith';

export interface ImportedAccount {
  uid: string;
  records: PullRecord[];
  /** Rows from banner types HLITH doesn't know, by the game's gacha_type. */
  skipped: Record<string, number>;
  /** Rows that couldn't be read at all. */
  invalid: number;
}

export type ImportResult = { ok: true; format: 'uigf-v4' | 'srgf-v1' | 'hlith-v1'; accounts: ImportedAccount[] } | { ok: false; error: string };

interface RawPull {
  id?: unknown;
  gacha_type?: unknown;
  item_id?: unknown;
  name?: unknown;
  rank_type?: unknown;
  time?: unknown;
}

export function parseHistoryFile(text: string, mapping: HistoryMapping, gameId?: GameId): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file isn't valid JSON. Export it again from your history tool." };
  }
  if (isHlithFile(data)) {
    if (!gameId) return { ok: false, error: 'HLITH pull history files need a game context to import.' };
    const parsed = parseHlithFile(data, gameId);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    return { ok: true, format: 'hlith-v1', accounts: [readAccount('', parsed.list, parsed.timezone, mapping)] };
  }
  if (!isObject(data) || !isObject(data.info)) return { ok: false, error: "This doesn't look like a UIGF, SRGF or HLITH export." };

  // SRGF v1: { info: { srgf_version, uid, region_time_zone }, list: [...] }
  if (typeof data.info.srgf_version === 'string') {
    const tz = Number(data.info.region_time_zone ?? 8);
    return {
      ok: true,
      format: 'srgf-v1',
      accounts: [readAccount(String(data.info.uid ?? ''), Array.isArray(data.list) ? data.list : [], tz, mapping)],
    };
  }

  // UIGF v4: { info: { version: 'v4.x' }, hkrpg: [{ uid, timezone, list }], nap: [...], hk4e: [...] }
  const version = String(data.info.version ?? '');
  if (/^v4\./.test(version)) {
    const key = mapping.uigfKey;
    if (!key) return { ok: false, error: "This game can't read UIGF files yet." };
    const section = data[key];
    if (!Array.isArray(section) || section.length === 0) return { ok: false, error: 'This file has no history for this game.' };
    return {
      ok: true,
      format: 'uigf-v4',
      accounts: section.filter(isObject).map((acc) => readAccount(String(acc.uid ?? ''), Array.isArray(acc.list) ? acc.list : [], Number(acc.timezone ?? 8), mapping)),
    };
  }
  return { ok: false, error: `Unsupported file version "${version || 'unknown'}". HLITH reads UIGF v4 and SRGF v1.` };
}

/** Rows from any source (file or in-game link) → our pull records, using the game's mapping. */
export function readAccount(uid: string, list: unknown[], tz: number, mapping: HistoryMapping): ImportedAccount {
  const records: PullRecord[] = [];
  const skipped: Record<string, number> = {};
  let invalid = 0;
  const standard = new Set(mapping.standardTop ?? []);
  for (const raw of list as RawPull[]) {
    const id = str(raw.id);
    const type = str(raw.gacha_type);
    const time = str(raw.time);
    const rarity = mapping.rarity[str(raw.rank_type)];
    if (!id || !type || !rarity || !/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(time)) {
      invalid++;
      continue;
    }
    const bannerType = mapping.gachaTypes[type];
    if (!bannerType) {
      skipped[type] = (skipped[type] ?? 0) + 1;
      continue;
    }
    const itemId = str(raw.item_id);
    records.push({
      id,
      bannerType,
      itemId,
      name: str(raw.name),
      rarity,
      time: serverTimeToUtc(time, Number.isFinite(tz) ? tz : 8),
      // Only marked when the game lists its standard pool; otherwise unknown, never guessed.
      ...(rarity === 'top' && standard.size > 0 ? { featured: !standard.has(itemId) } : {}),
    });
  }
  records.sort((a, b) => a.time.localeCompare(b.time) || compareIds(a.id, b.id));
  return { uid, records, skipped, invalid };
}

/** "2026-10-01 12:00:00" at UTC+tz → ISO in UTC. */
export function serverTimeToUtc(time: string, tz: number): string {
  const ms = Date.parse(`${time.replace(' ', 'T')}Z`) - tz * 3_600_000;
  return new Date(ms).toISOString();
}

/**
 * Add imported pulls to what's already stored. Never removes or changes a stored
 * pull; only ids not seen before are added (re-imports are safe).
 */
export function mergePulls(existing: PullRecord[], incoming: PullRecord[]): { merged: PullRecord[]; added: number } {
  // A game's pull ids are unique across all its banners.
  const seen = new Set(existing.map((p) => p.id));
  const fresh = incoming.filter((p) => !seen.has(p.id));
  const merged = [...existing, ...fresh].sort((a, b) => a.time.localeCompare(b.time) || compareIds(a.id, b.id));
  return { merged, added: fresh.length };
}

// Game pull ids are long numbers that grow over time; compare them as numbers.
function compareIds(a: string, b: string): number {
  return a.length - b.length || a.localeCompare(b);
}

const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
