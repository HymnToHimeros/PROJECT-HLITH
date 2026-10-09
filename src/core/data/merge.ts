/**
 * Add-only merge, for restoring a backup on top of what is already here.
 * The rule is "user data is never wiped": nothing that exists locally is
 * removed or overwritten. Only what is missing is added.
 *  - Lists: items are added when not already present (same `id`, else same content).
 *  - Records: keys missing here are added; keys present on both sides merge deeper.
 *  - Single values: the local value stays; a backup value fills a gap only.
 * Pure: no storage, no React.
 */
export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const keyOf = (item: unknown): string => (isRecord(item) && (typeof item.id === 'string' || typeof item.id === 'number') ? `id:${String(item.id)}` : `json:${JSON.stringify(item)}`);

export interface MergeCount {
  /** How many list items or record keys were added. */
  added: number;
}

export function mergeAdd<T>(local: T, incoming: unknown, count: MergeCount = { added: 0 }): T {
  if (local === undefined || local === null) {
    if (incoming !== undefined && incoming !== null) count.added += 1;
    return (incoming ?? local) as T;
  }
  if (Array.isArray(local)) {
    if (!Array.isArray(incoming)) return local;
    const seen = new Set(local.map(keyOf));
    const extra = incoming.filter((item) => {
      const k = keyOf(item);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    count.added += extra.length;
    return (extra.length ? [...local, ...extra] : local) as T;
  }
  if (isRecord(local)) {
    if (!isRecord(incoming)) return local;
    let changed = false;
    const out: Record<string, unknown> = { ...local };
    for (const [k, v] of Object.entries(incoming)) {
      const next = k in local ? mergeAdd(local[k], v, count) : v;
      if (!(k in local)) count.added += 1;
      if (next !== local[k]) {
        out[k] = next;
        changed = true;
      }
    }
    return (changed ? out : local) as T;
  }
  return local; // a value is already here: keep it
}
