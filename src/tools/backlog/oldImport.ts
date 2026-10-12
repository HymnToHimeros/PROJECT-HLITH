/**
 * Import from the old app (T73): the Gacha Tracker backlog export
 * ({"format":"hlith-backlog-export","version":1,"backlog":[…]}). Only progress (`done`) comes in:
 * each row finds its built-in item by the old id (BacklogItem.oldId, or the id "<game>.<oldId>").
 * Progress is only ever raised, never lowered or wiped. Rows with no matching item can become
 * your own items (the Edit mode path) or be skipped. Pure logic, no React.
 */
import type { BacklogItem } from '../../core/contract';
import { restoreBacklogDone, saveOwnItem, setBacklogDone, setOwnItemHidden } from '../../core/data/userData';

export interface OldRow {
  id: string;
  game: string;
  category: string;
  label: string;
  total: number;
  done: number | null;
  rewardEach: number;
  rewardUnknown: boolean;
  unit: string;
  where: string;
  note: string;
}

export interface OldExport {
  rows: OldRow[];
  /** When the file says its data is from (ISO), if it says. */
  asOf: string | null;
  /** The file's own notes, shown as they are. */
  notes: string[];
}

export type Parsed = { ok: true; value: OldExport } | { ok: false; error: string };

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Is this text the old app's backlog export? (Cheap check for the Assistant's attachments.) */
export const looksLikeOldExport = (text: string) => /"format"\s*:\s*"hlith-backlog-export"/.test(text.slice(0, 2000));

export function parseOldExport(text: string): Parsed {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file isn’t readable JSON.' };
  }
  const d = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  if (d.format !== 'hlith-backlog-export') return { ok: false, error: 'This isn’t a backlog export from the old app (Gacha Tracker).' };
  if (d.version !== 1) return { ok: false, error: `This export is version ${String(d.version)}; HLITH reads version 1.` };
  if (!Array.isArray(d.backlog)) return { ok: false, error: 'This export has no backlog list.' };
  const rows: OldRow[] = [];
  for (const r of d.backlog) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const id = str(o.id, 120);
    const game = str(o.game, 32);
    const total = num(o.total);
    if (!id || !game || total === null || total < 0) continue;
    const done = num(o.done);
    rows.push({
      id,
      game,
      category: str(o.category, 60),
      label: str(o.label, 120) || id,
      total: Math.round(total),
      done: done === null || done < 0 ? null : Math.round(done),
      rewardEach: Math.max(0, num(o.rewardEach) ?? 0),
      rewardUnknown: o.rewardUnknown === true,
      unit: str(o.unit, 40),
      where: str(o.where, 80),
      note: str(o.note, 300),
    });
  }
  const asOf = typeof d.dataAsOf === 'string' && Number.isFinite(Date.parse(d.dataAsOf)) ? d.dataAsOf : null;
  const notes = Array.isArray(d.notes) ? d.notes.filter((n): n is string => typeof n === 'string').map((n) => n.slice(0, 300)) : typeof d.note === 'string' ? [d.note.slice(0, 300)] : [];
  return { ok: true, value: { rows, asOf, notes } };
}

export interface Change {
  game: string;
  itemId: string;
  title: string;
  from: number | undefined;
  to: number;
}

export interface ImportPlan {
  /** Items whose progress goes up (or gets its first number). */
  raise: Change[];
  /** Rows that would lower your progress: left as they are. */
  lowerSkipped: number;
  /** Rows with the same progress you already have. */
  same: number;
  /** Rows with no progress in the file. */
  noProgress: number;
  /** Rows with no matching built-in item in a game you have. */
  unmatched: OldRow[];
  /** Rows for a game that isn't in HLITH (or not switched on). */
  otherGame: number;
}

/** The old categories ("Side quests") as HLITH's ids ("side-quests"). */
export const categoryId = (c: string) => c.trim().toLowerCase().replace(/\s+/g, '-') || 'side-quests';

/**
 * What the import would do, without changing anything. `lists` is each game's backlog as you see
 * it (built-in items with your changes); `progress` is your saved done counts.
 */
export function planImport(rows: OldRow[], lists: Record<string, readonly BacklogItem[]>, progress: Record<string, Record<string, number>>): ImportPlan {
  const plan: ImportPlan = { raise: [], lowerSkipped: 0, same: 0, noProgress: 0, unmatched: [], otherGame: 0 };
  for (const r of rows) {
    const list = lists[r.game];
    if (!list) {
      plan.otherGame++;
      continue;
    }
    const item = list.find((i) => i.oldId === r.id) ?? list.find((i) => i.id === `${r.game}.${r.id}`);
    if (!item) {
      plan.unmatched.push(r);
      continue;
    }
    if (r.done === null) {
      plan.noProgress++;
      continue;
    }
    const to = Math.min(r.done, item.total);
    const from = progress[r.game]?.[item.id];
    if (from === undefined || to > from) plan.raise.push({ game: r.game, itemId: item.id, title: item.title, from, to });
    else if (to < from) plan.lowerSkipped++;
    else plan.same++;
  }
  return plan;
}

export interface ImportUndo {
  before: Record<string, Record<string, number | undefined>>;
  added: { game: string; id: string }[];
}

/** An unmatched row as one of your own items (like Edit mode's "Add item"). */
export function ownItemFor(r: OldRow, premium: string): Partial<BacklogItem> {
  const currencyUnit = r.unit && r.rewardEach === 1 && r.total > 1;
  return {
    title: r.label,
    category: categoryId(r.category),
    total: Math.max(1, r.total),
    reward: r.rewardUnknown ? null : Math.round(r.rewardEach * Math.max(1, r.total)),
    currency: premium,
    steps: [],
    group: r.where,
    unit: r.unit === '%' ? '%' : '',
    note: [r.note, currencyUnit ? '' : r.unit && r.unit !== '%' ? `Counted in ${r.unit}` : ''].filter(Boolean).join(' · ').slice(0, 300),
    oldId: r.id,
  };
}

/**
 * Apply a plan: raise progress, and (if asked) add unmatched rows as your own items with their
 * progress. Returns what Undo needs.
 */
export function applyImport(plan: ImportPlan, opts: { addUnmatched: boolean; premium: (game: string) => string; now?: Date }): ImportUndo {
  const at = (opts.now ?? new Date()).toISOString();
  const undo: ImportUndo = { before: {}, added: [] };
  for (const c of plan.raise) {
    (undo.before[c.game] ??= {})[c.itemId] = c.from;
    setBacklogDone(c.game, c.itemId, c.to);
  }
  if (opts.addUnmatched) {
    for (const r of plan.unmatched) {
      const id = `own-old-${r.game}-${r.id}`.replace(/[^A-Za-z0-9_.-]/g, '-').slice(0, 120);
      saveOwnItem(r.game, 'backlog', { id, mine: true, fields: ownItemFor(r, opts.premium(r.game)), hidden: false, at });
      undo.added.push({ game: r.game, id });
      if (r.done !== null) {
        (undo.before[r.game] ??= {})[id] = undefined;
        setBacklogDone(r.game, id, Math.min(r.done, Math.max(1, r.total)));
      }
    }
  }
  return undo;
}

/** Undo the whole import: progress back exactly as it was, added items hidden (never deleted). */
export function undoImport(undo: ImportUndo, now: Date = new Date()): void {
  for (const [game, before] of Object.entries(undo.before)) restoreBacklogDone(game, before);
  for (const a of undo.added) setOwnItemHidden(a.game, 'backlog', a.id, true, now.toISOString());
}
