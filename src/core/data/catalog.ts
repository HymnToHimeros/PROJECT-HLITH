/**
 * Built-in lists: each game's seed data (games/<id>/data) with the owner's updates
 * from public.catalog_items laid over it. Rules that keep progress safe:
 *  - an id that ever existed never disappears; the owner retires it instead
 *  - owner rows replace seed fields by id, or add new items at the end
 *  - your progress lives in other tables and is never touched here
 */
export type CatalogKind = 'character' | 'banner' | 'event' | 'backlog' | 'material' | 'team' | 'kit' | 'version' | 'leak' | 'income';

export interface CatalogRow {
  game_id: string;
  kind: CatalogKind;
  id: string;
  data: Record<string, unknown>;
  status: 'active' | 'retired';
  source: string;
  updated_at: string;
}

export type ListItem<T> = T & { retired: boolean; updatedBy: 'seed' | 'owner' };

export function mergeList<T extends { id: string }>(seed: T[], rows: CatalogRow[]): ListItem<T>[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const merged: ListItem<T>[] = seed.map((item) => {
    const row = byId.get(item.id);
    return row
      ? ({ ...item, ...(row.data as Partial<T>), id: item.id, retired: row.status === 'retired', updatedBy: 'owner' } as ListItem<T>)
      : { ...item, retired: false, updatedBy: 'seed' };
  });
  const seen = new Set(seed.map((i) => i.id));
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    merged.push({ ...(row.data as T), id: row.id, retired: row.status === 'retired', updatedBy: 'owner' });
  }
  return merged;
}

/** Ids that appear twice in a seed list: list ids must be unique and stable. */
export function duplicateIds(items: { id: string }[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const { id } of items) (seen.has(id) ? dupes : seen).add(id);
  return [...dupes];
}
