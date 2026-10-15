/**
 * HLITH's own pull history file format: for games that have no UIGF/SRGF
 * standard (Endfield), and as a portable backup of pull data between devices.
 *
 * Shape: { app: 'PROJECT-HLITH', kind: 'pull-history', version: 1,
 *          game, exportedAt, timezone, list[] }
 *
 * The list uses the raw API shape (gacha_type, rank_type) rather than HLITH's
 * internal PullRecord, so the file stays useful if the mapping changes.
 */
import type { GameId, HistoryMapping, PullRecord } from '../../core/contract';

export interface HlithPullFile {
  app: 'PROJECT-HLITH';
  kind: 'pull-history';
  version: 1;
  game: string;
  exportedAt: string;
  timezone: number;
  list: HlithRawPull[];
}

interface HlithRawPull {
  id: string;
  gacha_type: string;
  item_id: string;
  name: string;
  rank_type: string;
  time: string;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function isHlithFile(data: unknown): data is HlithPullFile {
  return isObject(data) && data.app === 'PROJECT-HLITH' && data.kind === 'pull-history' && typeof data.version === 'number';
}

export function parseHlithFile(data: HlithPullFile, gameId: GameId): { ok: true; list: unknown[]; timezone: number } | { ok: false; error: string } {
  if (data.version !== 1) return { ok: false, error: `This file uses version ${data.version}, but HLITH only reads version 1. Update the app and try again.` };
  if (data.game !== gameId) return { ok: false, error: `This file is for ${data.game}, not the game you're importing into.` };
  if (!Array.isArray(data.list)) return { ok: false, error: 'This file has no pull list.' };
  return { ok: true, list: data.list, timezone: data.timezone ?? 0 };
}

export function buildHlithFile(gameId: GameId, pulls: PullRecord[], mapping: HistoryMapping): HlithPullFile {
  const reverseGacha: Record<string, string> = {};
  for (const [raw, mapped] of Object.entries(mapping.gachaTypes)) {
    if (!reverseGacha[mapped]) reverseGacha[mapped] = raw;
  }
  const reverseRarity: Record<string, string> = {};
  for (const [raw, mapped] of Object.entries(mapping.rarity)) {
    if (!reverseRarity[mapped]) reverseRarity[mapped] = raw;
  }
  return {
    app: 'PROJECT-HLITH',
    kind: 'pull-history',
    version: 1,
    game: gameId,
    exportedAt: new Date().toISOString(),
    timezone: 0,
    list: pulls.map((p) => ({
      id: p.id,
      gacha_type: reverseGacha[p.bannerType] ?? p.bannerType,
      item_id: p.itemId,
      name: p.name,
      rank_type: reverseRarity[p.rarity] ?? p.rarity,
      time: p.time,
    })),
  };
}
