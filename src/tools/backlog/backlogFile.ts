/**
 * Backlog files (T73): the "hlith-backlog-export" v1 format, HLITH's documented way to bring
 * backlog items in and take them out. The old app (Gacha Tracker) exports it too.
 *
 * Importing adds every row, in full, as one of YOUR OWN backlog items (the Edit mode path) in
 * the account that imports it, with its progress. Nothing goes into the built-in lists. A row's id
 * is kept in the item's id (own-old-<game>-<id>), so importing the same file again finds the items
 * it made and only raises their progress: no duplicates, nothing lowered or wiped. Undo hides what
 * the import added (nothing is deleted) and puts progress back. Pure logic, no React.
 */
import type { BacklogItem } from '../../core/contract';
import { restoreBacklogDone, saveOwnItem, setBacklogDone, setOwnItemHidden, type OwnItemEdit } from '../../core/data/userData';
import { categoryLabel } from './backlog';

export const FORMAT = 'hlith-backlog-export';
export const VERSION = 1;

/** One row of the file. Every field lands in the item. */
export interface FileRow {
  id: string;
  game: string;
  category: string;
  label: string;
  total: number;
  /** Progress; null = not entered ("No data yet"). */
  done: number | null;
  /** Premium currency per unit (reward = rewardEach × total). */
  rewardEach: number;
  /** The reward isn't known yet ("No data yet"). */
  rewardUnknown: boolean;
  unit: string;
  /** How much one − / + changes it. */
  step: number | null;
  where: string;
  note: string;
}

export interface BacklogFile {
  rows: FileRow[];
  /** When the file says its data is from (ISO), if it says. */
  asOf: string | null;
  notes: string[];
}

export type Parsed = { ok: true; value: BacklogFile } | { ok: false; error: string };

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Cheap check for files attached in the Assistant chat. */
export const looksLikeBacklogFile = (text: string) => /"format"\s*:\s*"hlith-backlog-export"/.test(text.slice(0, 2000));

export function parseBacklogFile(text: string): Parsed {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file isn’t readable JSON.' };
  }
  const d = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  if (d.format !== FORMAT) return { ok: false, error: `This isn’t a backlog file (its "format" must be "${FORMAT}").` };
  if (d.version !== VERSION) return { ok: false, error: `This backlog file is version ${String(d.version)}; HLITH reads version ${VERSION}.` };
  if (!Array.isArray(d.backlog)) return { ok: false, error: 'This backlog file has no "backlog" list.' };
  const rows: FileRow[] = [];
  for (const r of d.backlog) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const id = str(o.id, 100);
    const game = str(o.game, 32);
    const total = num(o.total);
    const label = str(o.label, 120);
    if (!id || !game || !label || total === null || total < 1) continue;
    const done = num(o.done);
    const step = num(o.step);
    rows.push({
      id,
      game,
      category: str(o.category, 60),
      label,
      total: Math.round(total),
      done: done === null || done < 0 ? null : Math.round(done),
      rewardEach: Math.max(0, num(o.rewardEach) ?? 0),
      rewardUnknown: o.rewardUnknown === true,
      unit: str(o.unit, 40),
      step: step !== null && step >= 1 ? Math.round(step) : null,
      where: str(o.where, 80),
      note: str(o.note, 300),
    });
  }
  const asOf = typeof d.dataAsOf === 'string' && Number.isFinite(Date.parse(d.dataAsOf)) ? d.dataAsOf : null;
  const notes = (Array.isArray(d.notes) ? d.notes : typeof d.note === 'string' ? [d.note] : []).filter((n): n is string => typeof n === 'string').map((n) => n.slice(0, 300));
  return { ok: true, value: { rows, asOf, notes } };
}

const LABEL_TO_ID: Record<string, string> = { story: 'story', 'main story': 'story' };
/** "Side quests" → "side-quests"; a new name becomes a new category. */
export const categoryId = (c: string) => {
  const k = c.trim().toLowerCase();
  return LABEL_TO_ID[k] ?? (k.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'side-quests');
};

/** The own item a row becomes (and the id that finds it again on the next import). */
export const ownIdFor = (r: Pick<FileRow, 'game' | 'id'>) => `own-old-${r.game}-${r.id.replace(/[^A-Za-z0-9_.-]/g, '-')}`.slice(0, 140);

export function itemFields(r: FileRow, currency: string): Partial<BacklogItem> {
  return {
    title: r.label,
    category: categoryId(r.category),
    total: r.total,
    reward: r.rewardUnknown ? null : Math.round(r.rewardEach * r.total),
    currency,
    steps: [],
    group: r.where,
    unit: r.unit,
    note: r.note,
    ...(r.step !== null ? { step: r.step } : {}),
  };
}

export interface Raise {
  game: string;
  itemId: string;
  from: number | undefined;
  to: number;
}

export interface ImportPlan {
  /** Rows that become new own items. */
  add: FileRow[];
  /** Of those, how many bring progress. */
  addWithProgress: number;
  /** Rows already imported before: progress goes up. */
  raise: Raise[];
  /** Rows already imported before: left as they are (same or less progress in the file). */
  unchanged: number;
  /** Items imported before and hidden (e.g. by Undo): shown again. */
  showAgain: string[];
  /** Rows for a game that isn't switched on here. */
  otherGame: number;
  /** Rows for HLITH's own built-in items (from an Export): progress only, never added again. */
  builtIn: number;
}

type OwnBacklog = Record<string, OwnItemEdit<BacklogItem>>;

/**
 * What importing would do, without changing anything. `builtIn` is the game's built-in list (with
 * your changes): a row for a built-in item (its id, as Export writes it) only raises that item's
 * progress and is never added as your own item, so export → import gives no duplicates.
 */
export function planImport(rows: FileRow[], games: Record<string, { own: OwnBacklog; progress: Record<string, number>; builtIn?: readonly BacklogItem[] }>): ImportPlan {
  const plan: ImportPlan = { add: [], addWithProgress: 0, raise: [], unchanged: 0, showAgain: [], otherGame: 0, builtIn: 0 };
  const seen = new Set<string>();
  for (const r of rows) {
    const g = games[r.game];
    if (!g) {
      plan.otherGame++;
      continue;
    }
    const builtIn = g.builtIn?.find((i) => i.id === r.id || i.id === `${r.game}.${r.id}`);
    const id = builtIn ? builtIn.id : ownIdFor(r);
    if (seen.has(`${r.game}:${id}`)) continue; // the same row twice in one file
    seen.add(`${r.game}:${id}`);
    if (builtIn) {
      const from = g.progress[id];
      const to = r.done === null ? null : Math.min(r.done, builtIn.total);
      if (to !== null && (from === undefined || to > from)) plan.raise.push({ game: r.game, itemId: id, from, to });
      else plan.unchanged++;
      plan.builtIn++;
      continue;
    }
    const existing = g.own[id];
    if (!existing) {
      plan.add.push(r);
      if (r.done !== null) plan.addWithProgress++;
      continue;
    }
    if (existing.hidden) plan.showAgain.push(`${r.game}:${id}`);
    const total = existing.fields.total ?? r.total;
    const from = g.progress[id];
    const to = r.done === null ? null : Math.min(r.done, total);
    if (to !== null && (from === undefined || to > from)) plan.raise.push({ game: r.game, itemId: id, from, to });
    else if (!existing.hidden) plan.unchanged++;
  }
  return plan;
}

export interface ImportUndo {
  before: Record<string, Record<string, number | undefined>>;
  added: { game: string; id: string }[];
  shown: { game: string; id: string }[];
}

/** Apply a plan. Returns what Undo needs. */
export function applyImport(plan: ImportPlan, currency: (game: string) => string, now: Date = new Date()): ImportUndo {
  const at = now.toISOString();
  const undo: ImportUndo = { before: {}, added: [], shown: [] };
  for (const r of plan.add) {
    const id = ownIdFor(r);
    saveOwnItem(r.game, 'backlog', { id, mine: true, fields: itemFields(r, currency(r.game)), hidden: false, at });
    undo.added.push({ game: r.game, id });
    if (r.done !== null) {
      (undo.before[r.game] ??= {})[id] = undefined;
      setBacklogDone(r.game, id, Math.min(r.done, r.total));
    }
  }
  for (const key of plan.showAgain) {
    const [game = '', id = ''] = key.split(/:(.*)/s);
    setOwnItemHidden(game, 'backlog', id, false, at);
    undo.shown.push({ game, id });
  }
  for (const c of plan.raise) {
    (undo.before[c.game] ??= {})[c.itemId] = c.from;
    setBacklogDone(c.game, c.itemId, c.to);
  }
  return undo;
}

/** Undo the whole import: progress back as it was; what it added or showed is hidden (never deleted). */
export function undoImport(undo: ImportUndo, now: Date = new Date()): void {
  for (const [game, before] of Object.entries(undo.before)) restoreBacklogDone(game, before);
  for (const a of [...undo.added, ...undo.shown]) setOwnItemHidden(a.game, 'backlog', a.id, true, now.toISOString());
}

/** A row from one item, the way the file writes it (so export → import gives the same item back). */
export function rowFor(game: string, item: BacklogItem, done: number | undefined): Record<string, unknown> {
  const prefix = `own-old-${game}-`;
  return {
    id: item.id.startsWith(prefix) ? item.id.slice(prefix.length) : item.id,
    game,
    category: categoryLabel(item.category),
    label: item.title,
    total: item.total,
    ...(done !== undefined ? { done } : {}),
    rewardEach: item.reward === null || item.total === 0 ? 0 : item.reward / item.total,
    ...(item.reward === null ? { rewardUnknown: true } : {}),
    unit: item.unit ?? '',
    ...(item.step ? { step: item.step } : {}),
    ...(item.group ? { where: item.group } : {}),
    ...(item.note ? { note: item.note } : {}),
  };
}

/** "Export my backlog": every item you see (built-in with your changes, and your own), with your progress. */
export function exportBacklog(games: { id: string; items: readonly BacklogItem[]; progress: Record<string, number> }[], now: Date = new Date()): string {
  const backlog = games.flatMap((g) => g.items.map((i) => rowFor(g.id, i, g.progress[i.id])));
  return JSON.stringify({ format: FORMAT, version: VERSION, source: 'HLIÐSKJÁLF', dataAsOf: now.toISOString(), backlog }, null, 2);
}

/** A small file to start from (Download a template). */
export const TEMPLATE = JSON.stringify(
  {
    format: FORMAT,
    version: VERSION,
    dataAsOf: '2026-10-12T00:00:00.000Z',
    notes: ['One row per item. Only id, game, label and total are required.'],
    backlog: [
      { id: 'my_quest_1', game: 'hsr', category: 'Side quests', label: 'A quest I still have to do', total: 1, done: 0, rewardEach: 60, unit: 'mission', where: 'Penacony' },
      { id: 'my_chests', game: 'zzz', category: 'Exploration', label: 'Chests in a new area', total: 40, done: 12, rewardEach: 5, unit: 'chest', step: 1 },
      { id: 'my_mode', game: 'hsr', category: 'Modes', label: 'A mode with points', total: 4000, rewardEach: 1, rewardUnknown: false, unit: 'points', step: 100, note: 'From the in-game total' },
    ],
  },
  null,
  2,
);
