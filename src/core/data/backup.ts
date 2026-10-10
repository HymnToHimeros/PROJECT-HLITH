/**
 * Export my data and Restore from a backup file (Account → Backup).
 * A backup holds your settings, your game data and any other HLITH notes kept in
 * this browser. Restoring only ADDS what is missing: nothing already here is
 * removed or overwritten ("user data is never wiped").
 */
import type { GameId } from '../contract';
import { mergeAdd } from './merge';
import { getPrefs, updatePrefs, type Prefs } from './prefs';
import { allUserData, mergeIntoUserData } from './userData';

const PREFS_KEY = 'hlith.prefs';
const DATA_KEY = 'hlith.userdata';

export interface Backup {
  app: 'PROJECT-HLITH';
  kind: 'backup';
  version: 1;
  exportedAt: string;
  prefs: Prefs;
  userData: { version: 1; games: Record<GameId, unknown> };
  /** Other HLITH keys in this browser (e.g. a tool's own notes), as saved text. */
  extra: Record<string, string>;
}

function otherKeys(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      // hlith.secret.* (logins remembered on this device) never go into a backup file;
      // hlith.cache.* (e.g. the last live stamina read) is only a short-lived copy.
      if (!k || !k.startsWith('hlith.') || k.startsWith('hlith.secret.') || k.startsWith('hlith.cache.') || k === PREFS_KEY || k === DATA_KEY) continue;
      const v = localStorage.getItem(k);
      if (v !== null) out[k] = v;
    }
  } catch {
    /* storage unavailable */
  }
  return out;
}

export function buildBackup(now = Date.now()): Backup {
  return { app: 'PROJECT-HLITH', kind: 'backup', version: 1, exportedAt: new Date(now).toISOString(), prefs: getPrefs(), userData: allUserData(), extra: otherKeys() };
}

/** Starts a download of the backup file and remembers when (for the backup reminder). */
export function downloadBackup(now = Date.now()): string {
  const backup = buildBackup(now);
  const name = `HLITH-backup-${backup.exportedAt.slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
  updatePrefs((p) => ({ ...p, lastBackupAt: now }));
  return name;
}

export type ParseResult = { ok: true; backup: Backup } | { ok: false; error: string };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Checks a file really is an HLITH backup before anything is touched. */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file isn’t readable JSON. Choose the .json file HLITH downloaded for you.' };
  }
  if (!isRecord(raw) || raw.app !== 'PROJECT-HLITH' || raw.kind !== 'backup') {
    return { ok: false, error: 'This isn’t an HLITH backup. (Pull history exports go in Pulls → History.)' };
  }
  if (raw.version !== 1) return { ok: false, error: 'This backup comes from a newer HLITH. Reload the page and try again.' };
  if (!isRecord(raw.prefs) || !isRecord(raw.userData) || !isRecord(raw.userData.games)) {
    return { ok: false, error: 'This backup is incomplete: its settings or game data are missing.' };
  }
  const extra = isRecord(raw.extra) ? Object.fromEntries(Object.entries(raw.extra).filter(([k, v]) => k.startsWith('hlith.') && !k.startsWith('hlith.secret.') && typeof v === 'string')) : {};
  return { ok: true, backup: { ...(raw as unknown as Backup), extra: extra as Record<string, string> } };
}

export interface BackupSummary {
  exportedAt: string;
  games: { id: GameId; bank: number; pulls: number; roster: number; teams: number; ticks: number }[];
}

const len = (v: unknown) => (Array.isArray(v) ? v.length : isRecord(v) ? Object.keys(v).length : 0);

export function summarize(backup: Backup): BackupSummary {
  return {
    exportedAt: backup.exportedAt,
    games: Object.entries(backup.userData.games).map(([id, g]) => {
      const d = isRecord(g) ? g : {};
      return { id, bank: len(d.ledger), pulls: len(d.pulls), roster: len(d.roster), teams: len(d.teams), ticks: len(d.ticks) };
    }),
  };
}

/** Adds the backup's data to what's here. Returns how many items were added. */
export function restoreBackup(backup: Backup): number {
  let added = mergeIntoUserData(backup.userData.games);
  const count = { added: 0 };
  const current = getPrefs();
  const merged = mergeAdd(current, backup.prefs, count);
  if (merged !== current) updatePrefs(() => merged);
  added += count.added;
  try {
    for (const [k, v] of Object.entries(backup.extra)) {
      if (localStorage.getItem(k) === null) {
        localStorage.setItem(k, v);
        added += 1;
      }
    }
  } catch {
    /* storage unavailable */
  }
  return added;
}

/** Days since the last download, or null if never. */
export function daysSinceBackup(now = Date.now()): number | null {
  const at = getPrefs().lastBackupAt;
  return at ? Math.floor((now - at) / 86_400_000) : null;
}

/** The reminder shows after this many days (V1: "Time for a backup"). */
export const BACKUP_EVERY_DAYS = 14;
