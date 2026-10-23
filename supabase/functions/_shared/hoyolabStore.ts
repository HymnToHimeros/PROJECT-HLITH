/**
 * The database side of saved HoYoLAB accounts, for the hoyolab and hoyolab-daily
 * server functions (service role). The tables and Vault functions are in
 * supabase/migrations/0003_hoyolab_links.sql.
 *
 * `Db` is the small part of the Supabase client used here, so this file needs no
 * package of its own and can be tested with a fake.
 */
import type { GameBiz } from './hoyolab.ts';
import { linkGames, runLinks, type LinkRow, type RedeemStatus, type RunDeps, type RunSummary, type Store, type Tried } from './hoyolabAuto.ts';
import { withoutBanned } from './moderation.ts';

type Answer = { data: unknown; error: { message: string } | null };
export interface Query extends PromiseLike<Answer> {
  select(columns: string): Query;
  insert(row: object): Query;
  upsert(rows: object[], options?: object): Query;
  eq(column: string, value: unknown): Query;
  in(column: string, values: unknown[]): Query;
  is(column: string, value: null): Query;
  gte(column: string, value: string): Query;
  or(filter: string): Query;
  order(column: string, options?: object): Query;
  limit(n: number): Query;
}
export interface Db {
  from(table: string): Query;
  rpc(fn: string, args?: object): PromiseLike<Answer>;
}

const rows = (a: Answer): Record<string, unknown>[] => (Array.isArray(a.data) ? (a.data as Record<string, unknown>[]) : []);

/** Links that are not forgotten and have at least one switch on (or all of one user's, for "Run now"). */
export async function activeLinks(db: Db, userId?: string): Promise<LinkRow[]> {
  let q = db.from('hoyolab_links').select('id,user_id,games,auto_checkin,auto_redeem').is('forgotten_at', null);
  q = userId ? q.eq('user_id', userId) : q.or('auto_checkin.eq.true,auto_redeem.eq.true');
  const a = await q.order('created_at');
  if (a.error) throw new Error(`Reading saved accounts failed: ${a.error.message}`);
  return rows(a).map((r) => ({ id: String(r.id), user_id: String(r.user_id), games: linkGames(r.games), auto_checkin: r.auto_checkin === true, auto_redeem: r.auto_redeem === true }));
}

export function dbStore(db: Db): Store {
  return {
    async secret(linkId) {
      const a = await db.rpc('hoyolab_link_secret', { p_link: linkId });
      if (a.error || !a.data || typeof a.data !== 'object') return null;
      const o = a.data as Record<string, unknown>;
      return { login: typeof o.login === 'string' ? o.login : null, redeem: typeof o.redeem === 'string' ? o.redeem : null };
    },
    async checkedIn(linkIds, since) {
      if (!linkIds.length) return new Set();
      const a = await db.from('hoyolab_checkins').select('link_id,game_biz,status').in('link_id', linkIds).gte('ran_at', since);
      return new Set(rows(a).filter((r) => r.status === 'claimed' || r.status === 'already').map((r) => `${String(r.link_id)}:${String(r.game_biz)}`));
    },
    async tried(linkIds) {
      if (!linkIds.length) return [];
      const a = await db.from('hoyolab_redemptions').select('link_id,game_uid,code,status').in('link_id', linkIds);
      return rows(a).map((r): Tried => ({ link_id: String(r.link_id), game_uid: String(r.game_uid), code: String(r.code), status: String(r.status) as RedeemStatus }));
    },
    async codesFor(userId, gameBiz: GameBiz) {
      // Only codes the public list still showed in the last 3 days: a code that dropped off it has usually expired.
      const recent = new Date(Date.now() - 3 * 86_400_000).toISOString();
      const pub = await db.from('hoyolab_codes').select('code').eq('game_biz', gameBiz).gte('last_seen', recent);
      const mine = await db.from('hoyolab_my_codes').select('code').eq('game_biz', gameBiz).eq('user_id', userId);
      return [...new Set([...rows(mine), ...rows(pub)].map((r) => String(r.code)))];
    },
    async recordCheckin(row) {
      const a = await db.from('hoyolab_checkins').insert(row);
      if (a.error) throw new Error(`Saving a check-in result failed: ${a.error.message}`);
    },
    async recordRedemption(row) {
      const a = await db.from('hoyolab_redemptions').insert(row);
      if (a.error) throw new Error(`Saving a code result failed: ${a.error.message}`);
    },
  };
}

/** Copy today's public list into hoyolab_codes (adds new codes, refreshes last_seen; never removes any). */
export async function saveCodeList(db: Db, gameBiz: GameBiz, list: { code: string; rewards: string | null }[], source: string, nowIso: string): Promise<{ total: number; fresh: number }> {
  if (!list.length) return { total: 0, fresh: 0 };
  const codes = list.map((c) => c.code);
  const existing = await db.from('hoyolab_codes').select('code').eq('game_biz', gameBiz).in('code', codes);
  const known = new Set((Array.isArray(existing.data) ? existing.data : []).map((r: Record<string, unknown>) => String(r.code)));
  const freshList = list.filter((c) => !known.has(c.code));
  const knownList = list.filter((c) => known.has(c.code));
  if (freshList.length > 0) {
    const a = await db.from('hoyolab_codes').upsert(
      freshList.map((c) => ({ game_biz: gameBiz, code: c.code, rewards: c.rewards, source, last_seen: nowIso })),
      { onConflict: 'game_biz,code' },
    );
    if (a.error) throw new Error(`Saving the code list failed: ${a.error.message}`);
  }
  if (knownList.length > 0) {
    const a = await db.from('hoyolab_codes').upsert(
      knownList.map((c) => ({ game_biz: gameBiz, code: c.code, last_seen: nowIso })),
      { onConflict: 'game_biz,code' },
    );
    if (a.error) throw new Error(`Refreshing known codes failed: ${a.error.message}`);
  }
  return { total: list.length, fresh: freshList.length };
}

/** Run redeem-only for all links with auto_redeem on. Call after saving fresh codes so they get tried right away. */
export async function redeemFreshCodes(db: Db, deps: RunDeps, deadline: number): Promise<RunSummary | null> {
  const links = await withoutBanned(db as unknown as { rpc: Db['rpc'] }, await activeLinks(db));
  const redeemLinks = links.filter((l) => l.auto_redeem);
  if (redeemLinks.length === 0) return null;
  return runLinks(redeemLinks, dbStore(db), deps, {
    startedBy: 'auto',
    deadline,
    maxRedemptions: 15,
    jobs: (l) => ({ checkin: false, redeem: l.auto_redeem }),
  });
}

