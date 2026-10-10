/**
 * Reading and writing the owner's rows in public.catalog_items (0001_init.sql).
 * Everyone signed in reads them; only an owner can add or change one (row-level
 * security checks public.is_owner() again on the server). Nothing is ever deleted:
 * an item is retired, and can be brought back.
 *
 * "This device only" (no server) or signed out: no rows, so every list is the seed list.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { backend } from './backend';
import type { CatalogKind, CatalogRow } from './catalog';

const COLUMNS = 'game_id,kind,id,data,status,source,updated_at';

let cache: { user: string; rows: Promise<CatalogRow[]> } | null = null;

/** Every owner row, read once per signed-in session. [] without a server, signed out, or when the read fails. */
export async function catalogRows(client: SupabaseClient | null = backend): Promise<CatalogRow[]> {
  if (!client) return [];
  const { data } = await client.auth.getSession();
  const user = data.session?.user.id;
  if (!user) return [];
  if (cache?.user !== user) cache = { user, rows: fetchCatalogRows(client).catch(() => []) };
  return cache.rows;
}

/** Forget the session's copy, so the next list load reads the server again. */
export function forgetCatalogRows(): void {
  cache = null;
}

/** Reads the rows (optionally one game and kind). Throws when the read fails. */
export async function fetchCatalogRows(client: SupabaseClient | null = backend, gameId?: string, kind?: CatalogKind): Promise<CatalogRow[]> {
  if (!client) return [];
  let q = client.from('catalog_items').select(COLUMNS);
  if (gameId) q = q.eq('game_id', gameId);
  if (kind) q = q.eq('kind', kind);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as CatalogRow[];
}

const noServer = () => new Error('This site runs without a server (this device only), so the lists can’t be changed for everyone here.');

/** Adds or replaces one owner row's fields (owner only). A retired item stays retired unless `status` says otherwise. */
export async function saveCatalogRow(row: { game_id: string; kind: CatalogKind; id: string; data: Record<string, unknown>; status?: 'active' | 'retired'; source?: string }): Promise<void> {
  if (!backend) throw noServer();
  const { error } = await backend.from('catalog_items').upsert({ source: 'owner', ...row }, { onConflict: 'game_id,kind,id' });
  if (error) throw new Error(error.message);
  forgetCatalogRows();
}

/**
 * Retire or bring back an item (owner only). An item with no owner row yet (a seed item)
 * gets one with no changed fields, so only its status differs from the seed.
 */
export async function setCatalogStatus(gameId: string, kind: CatalogKind, id: string, status: 'active' | 'retired'): Promise<void> {
  if (!backend) throw noServer();
  const { data, error } = await backend.from('catalog_items').update({ status }).match({ game_id: gameId, kind, id }).select('id');
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    const added = await backend.from('catalog_items').insert({ game_id: gameId, kind, id, data: {}, status, source: 'owner' });
    if (added.error) throw new Error(added.error.message);
  }
  forgetCatalogRows();
}
