// Supabase Edge Function: automatic SKPort daily check-in for Arknights: Endfield.
// For every saved SKPort account whose owner switched auto_checkin on: claims the
// daily attendance reward. Every result goes into skport_checkins, where the player
// sees it. Started by the daily schedule that sends the project's service key
// (docs/SETUP.md); anyone else gets 401. Token values are never logged or returned.
import { createHash, createHmac } from 'node:crypto';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { isScheduler } from '../_shared/backupPlan.ts';
import { withoutBanned } from '../_shared/moderation.ts';
import { readSkport, type Deps } from '../_shared/skport.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

interface Db {
  from(table: string): DbQuery;
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}
interface DbQuery extends PromiseLike<{ data: unknown; error: { message: string } | null }> {
  select(columns: string): DbQuery;
  insert(row: object): DbQuery;
  eq(column: string, value: unknown): DbQuery;
  in(column: string, values: unknown[]): DbQuery;
  is(column: string, value: null): DbQuery;
  gte(column: string, value: string): DbQuery;
  order(column: string): DbQuery;
}

const deps: Deps = {
  fetch: (url, init) => fetch(url, { ...init, redirect: 'error' }),
  hmacSha256: async (key, data) => createHmac('sha256', key).update(data).digest('hex'),
  md5: (s) => createHash('md5').update(s).digest('hex'),
  now: () => Date.now(),
};

interface LinkRow {
  id: string;
  user_id: string;
  skport_uid: string;
  server: string;
}

type CheckinStatus = 'claimed' | 'already' | 'error';

const rows = (a: { data: unknown }): Record<string, unknown>[] => (Array.isArray(a.data) ? (a.data as Record<string, unknown>[]) : []);

async function activeLinks(db: Db): Promise<LinkRow[]> {
  const a = await db.from('skport_links').select('id,user_id,skport_uid,server').is('forgotten_at', null).eq('auto_checkin', true).order('created_at');
  if ((a as { error: unknown }).error) throw new Error('Reading saved SKPort accounts failed.');
  return rows(a).map((r) => ({ id: String(r.id), user_id: String(r.user_id), skport_uid: String(r.skport_uid), server: String(r.server) }));
}

async function alreadyCheckedToday(db: Db, linkIds: string[]): Promise<Set<string>> {
  if (!linkIds.length) return new Set();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const a = await db.from('skport_checkins').select('link_id,status').in('link_id', linkIds).gte('ran_at', today.toISOString());
  return new Set(rows(a).filter((r) => r.status === 'claimed' || r.status === 'already').map((r) => String(r.link_id)));
}

async function recordCheckin(db: Db, row: { user_id: string; link_id: string; started_by: 'auto' | 'manual'; status: CheckinStatus; message: string | null }): Promise<void> {
  const a = await db.from('skport_checkins').insert(row);
  if ((a as { error: unknown }).error) throw new Error('Saving a check-in result failed.');
}

Deno.serve(async (req) => {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!isScheduler(req.headers.get('Authorization'), serviceKey) || !url || !serviceKey) return json({ error: 'Not allowed.' }, 401);
  const started = Date.now();
  const db = createClient(url, serviceKey, { auth: { persistSession: false } }) as unknown as Db;

  try {
    const links = await withoutBanned(db, await activeLinks(db));
    if (links.length === 0) return json({ ok: true, at: new Date(started).toISOString(), accounts: 0, checkins: 0 });

    const done = await alreadyCheckedToday(db, links.map((l) => l.id));
    let checkins = 0;
    let stoppedEarly = false;

    for (const link of links) {
      if (done.has(link.id)) continue;
      if (Date.now() > started + 120_000) { stoppedEarly = true; break; }

      const secret = await db.rpc('skport_link_secret', { p_link: link.id });
      const o = secret.data && typeof secret.data === 'object' ? (secret.data as Record<string, unknown>) : null;
      const token = typeof o?.token === 'string' ? o.token : null;

      if (!token) {
        await recordCheckin(db, { user_id: link.user_id, link_id: link.id, started_by: 'auto', status: 'error', message: 'The saved token can\'t be read. Add the token again.' });
        checkins++;
        continue;
      }

      const result = await readSkport({ accountToken: token, uid: link.skport_uid, want: ['checkin'], claim: true }, deps);
      let status: CheckinStatus;
      let message: string | null = null;

      if (!result.ok) {
        status = 'error';
        message = result.error === 'expired' ? 'The saved token has expired. Log in to SKPort again and save a fresh one.'
          : result.error === 'busy' ? 'SKPort is limiting requests. Will try again next run.'
          : 'SKPort returned an error. Will try again next run.';
      } else {
        const c = result.answer.checkin;
        const problem = result.answer.problems.checkin;
        if (c?.claimedNow) {
          status = 'claimed';
        } else if (problem) {
          status = 'error';
          message = problem.text;
        } else if (c?.checkedInToday) {
          status = 'already';
          message = 'Already checked in today (on SKPort or by another app).';
        } else {
          status = 'error';
          message = 'SKPort didn\'t confirm the check-in.';
        }
      }

      await recordCheckin(db, { user_id: link.user_id, link_id: link.id, started_by: 'auto', status, message });
      checkins++;
    }

    return json({ ok: true, at: new Date(started).toISOString(), accounts: links.length, checkins, stoppedEarly });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Run failed.' }, 500);
  }
});
