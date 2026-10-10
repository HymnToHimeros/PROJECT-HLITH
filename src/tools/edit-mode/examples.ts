/**
 * Examples mixed into a list, one item at a time. While a game's built-in list is empty,
 * its examples show next to your own items. Each example stays until you hide it or
 * change it (then it is your own item, same id, so anything you entered on it stays).
 * Pure: no React, no storage.
 */
import type { OwnItems, OwnItemTypes, OwnKind } from '../../core/data/userData';
import { mergeRows, type MergedRow } from './merge';

export interface Mixed<T> {
  /** What a screen shows: examples (if any) then the real list with your changes and own items. */
  list: T[];
  /** Only the real items (built-in + yours). What budgets and tasks use; never examples. */
  real: T[];
  /** Ids of the items in `list` that are examples. */
  exampleIds: ReadonlySet<string>;
  /** Any example in `list`. */
  example: boolean;
  /** Every row for Edit mode, hidden ones included. */
  rows: MergedRow<T>[];
}

const NONE: ReadonlySet<string> = new Set();

export function mixExamples<K extends OwnKind>(
  kind: K,
  builtIn: readonly OwnItemTypes[K][],
  own: OwnItems[K] | undefined,
  examples: readonly OwnItemTypes[K][],
  showExamples: boolean,
): Mixed<OwnItemTypes[K]> {
  const edits: Record<string, { mine: boolean; hidden: boolean } | undefined> = own ?? {};
  const merged = mergeRows(kind, builtIn, own);
  const real = merged.filter((r) => !r.hidden).map((r) => r.item);
  const use = builtIn.length === 0 && showExamples;
  if (!use) return { list: real, real, exampleIds: NONE, example: false, rows: merged };
  // An example you changed (now your own item) or hid is no longer shown as an example.
  const taken = (id: string) => Boolean(edits[id]?.mine || edits[id]?.hidden);
  const shown = examples.filter((e) => !taken(e.id));
  const hidden = examples.filter((e) => edits[e.id]?.hidden && !edits[e.id]?.mine);
  const rows: MergedRow<OwnItemTypes[K]>[] = [
    ...shown.map((item) => ({ item, origin: 'example' as const, hidden: false })),
    ...hidden.map((item) => ({ item, origin: 'example' as const, hidden: true })),
    ...merged,
  ];
  return { list: [...shown, ...real], real, exampleIds: new Set(shown.map((e) => e.id)), example: shown.length > 0, rows };
}
