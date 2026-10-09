/**
 * Edit mode: your own items laid over a game's built-in list. Pure: no React.
 * Built-in lists can be updated by the owner at any time; your entries sit
 * beside them (by id) and are never touched by those updates.
 */
import type { OwnItemEdit, OwnItems, OwnItemTypes, OwnKind } from '../../core/data/userData';

export type Origin = 'built-in' | 'changed' | 'mine';

export interface MergedRow<T> {
  item: T;
  origin: Origin;
  hidden: boolean;
}

/** Fields an item of each kind needs before it can show in a list. */
const REQUIRED: { [K in OwnKind]: (keyof OwnItemTypes[K])[] } = {
  events: ['title', 'kind', 'start', 'end', 'currency'],
  banners: ['title', 'type', 'start', 'end'],
  backlog: ['title', 'category', 'total', 'currency'],
};

/** Defaults for optional-but-typed fields, so an own item is a full item. */
const DEFAULTS: { [K in OwnKind]: Partial<OwnItemTypes[K]> } = {
  events: { reward: null },
  banners: { featured: [] },
  backlog: { reward: null },
};

function complete<K extends OwnKind>(kind: K, id: string, fields: Partial<OwnItemTypes[K]>): OwnItemTypes[K] | null {
  const item = { ...DEFAULTS[kind], ...fields, id } as Partial<OwnItemTypes[K]>;
  for (const key of REQUIRED[kind]) {
    const v = item[key];
    if (v === undefined || v === null || v === '') return null;
  }
  return item as OwnItemTypes[K];
}

/** Every row: built-in items (with your changes), then your own items, each with its origin and hidden flag. */
export function mergeRows<K extends OwnKind>(kind: K, builtIn: readonly OwnItemTypes[K][], own: OwnItems[K] | undefined): MergedRow<OwnItemTypes[K]>[] {
  const edits: Record<string, OwnItemEdit<OwnItemTypes[K]>> = (own ?? {}) as Record<string, OwnItemEdit<OwnItemTypes[K]>>;
  const builtInIds = new Set(builtIn.map((b) => b.id));
  const rows: MergedRow<OwnItemTypes[K]>[] = builtIn.map((b) => {
    const e = edits[b.id];
    if (!e) return { item: b, origin: 'built-in', hidden: false };
    const changed = Object.keys(e.fields).length > 0;
    // Your change wins field by field; the id never changes.
    return { item: changed ? { ...b, ...e.fields, id: b.id } : b, origin: changed ? 'changed' : 'built-in', hidden: e.hidden };
  });
  for (const e of Object.values(edits)) {
    if (!e.mine || builtInIds.has(e.id)) continue;
    const item = complete(kind, e.id, e.fields);
    if (item) rows.push({ item, origin: 'mine', hidden: e.hidden });
  }
  return rows;
}

/** What a list screen shows: built-in items with your changes, plus your own items, minus anything you hid. */
export function mergeOwnItems<K extends OwnKind>(kind: K, builtIn: readonly OwnItemTypes[K][], own: OwnItems[K] | undefined): OwnItemTypes[K][] {
  return mergeRows(kind, builtIn, own)
    .filter((r) => !r.hidden)
    .map((r) => r.item);
}

/** A fresh id for an item you add (never clashes with built-in ids, which have no "own-" prefix). */
export const newOwnId = (now: number) => `own-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
