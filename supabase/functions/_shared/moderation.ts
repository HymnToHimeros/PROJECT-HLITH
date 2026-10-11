/**
 * Scheduled jobs that act for people (T60b): skip banned accounts. A banned account is also
 * refused by the database's own rules and by requireUser; these jobs run with the service
 * key, which passes those rules, so they ask public.banned_among (migration 0015) first.
 * If the answer can't be read the job stops rather than act for someone it shouldn't.
 */
type Answer = { data: unknown; error: { message: string } | null };
export interface RpcDb {
  rpc(fn: string, args?: object): PromiseLike<Answer>;
}

export async function bannedAmong(db: RpcDb, userIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(userIds)];
  if (!ids.length) return new Set();
  const a = await db.rpc('banned_among', { p_users: ids });
  if (a.error) throw new Error(`Checking for suspended accounts failed: ${a.error.message}`);
  return new Set(Array.isArray(a.data) ? a.data.map(String) : []);
}

/** Only what the job may still do: the items whose account isn't banned. */
export async function withoutBanned<T extends { user_id: string }>(db: RpcDb, items: T[]): Promise<T[]> {
  const banned = await bannedAmong(db, items.map((i) => i.user_id));
  return items.filter((i) => !banned.has(i.user_id));
}
