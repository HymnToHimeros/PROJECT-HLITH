/**
 * Built-in lists: each game's seed data (games/<id>/data) with the owner's updates
 * from public.catalog_items laid over it. Rules that keep progress safe:
 *  - an id that ever existed never disappears; the owner retires it instead
 *  - owner rows replace seed fields by id, or add new items at the end
 *  - your progress lives in other tables and is never touched here
 */
import type { GameContract, GameDataLoaders } from '../contract';

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

// ── The lists every screen reads ────────────────────────────────────

/** The built-in lists the owner can update from Owner console → Lists, and the catalog kind each is stored as. */
export const LIST_KINDS = {
  events: 'event',
  banners: 'banner',
  backlog: 'backlog',
  characters: 'character',
  versions: 'version',
} as const satisfies Record<string, CatalogKind>;
export type ListKind = keyof typeof LIST_KINDS;

/**
 * A seed list with the owner's rows laid over it, as screens use it: retired items drop
 * out (their ids stay reserved, and anyone's progress on them stays saved and comes back
 * if the owner brings the item back). The bookkeeping fields are left off.
 */
export function applyCatalog<T extends { id: string }>(seed: T[], rows: CatalogRow[]): T[] {
  return mergeList(seed, rows)
    .filter((i) => !i.retired)
    .map((i) => {
      const { retired, updatedBy, ...item } = i;
      void retired;
      void updatedBy;
      return item as unknown as T;
    });
}

/** Where the owner's rows come from (once per session; [] when signed out or without a server). */
export type CatalogSource = () => Promise<CatalogRow[]>;

const seeds = new WeakMap<GameContract, GameDataLoaders>();

/** The game's own seed loaders, before the owner's updates (for Owner console → Lists). */
export function seedLoaders(game: GameContract): GameDataLoaders {
  return seeds.get(game) ?? game.data;
}

/**
 * The same game, with its list loaders (events, banners, backlog, characters, versions)
 * returning the seed lists with the owner's catalog rows laid over them. Wrapped once,
 * where games are registered, so every screen gets the same lists. A failing source
 * gives the seed list unchanged. Your own changes and hides still apply on top, in the
 * screens, exactly as before.
 */
export function withCatalog(game: GameContract, source: CatalogSource): GameContract {
  const data: GameDataLoaders = { ...game.data };
  const slots = data as unknown as Record<ListKind, () => Promise<{ id: string }[]>>;
  for (const [list, kind] of Object.entries(LIST_KINDS) as [ListKind, CatalogKind][]) {
    const load = game.data[list] as () => Promise<{ id: string }[]>;
    slots[list] = async () => {
      const [seed, rows] = await Promise.all([load(), source().catch(() => [] as CatalogRow[])]);
      const mine = rows.filter((r) => r.game_id === game.id && r.kind === kind);
      return mine.length ? applyCatalog(seed, mine) : seed;
    };
  }
  const wrapped: GameContract = { ...game, data };
  seeds.set(wrapped, seedLoaders(game));
  return wrapped;
}
