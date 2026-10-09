// Supabase Edge Function: nightly backup (R24).
// Copies every table into the private "backups" storage bucket as JSON, one
// folder per night. Never changes or deletes any row; older backups are kept.
// Started by a nightly schedule that sends the project's service key (see docs/SETUP.md);
// anyone else gets 401.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { BACKUP_BUCKET, BACKUP_TABLES, backupPath, isScheduler, PAGE_SIZE } from '../_shared/backupPlan.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!isScheduler(req.headers.get('Authorization'), serviceKey) || !url || !serviceKey) return json({ error: 'Not allowed.' }, 401);

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const at = new Date();
  const done: Record<string, number> = {};
  for (const table of BACKUP_TABLES) {
    const rows: unknown[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await db.from(table).select('*').range(from, from + PAGE_SIZE - 1);
      if (error) return json({ error: `Reading ${table} failed: ${error.message}`, done }, 500);
      rows.push(...data);
      if (data.length < PAGE_SIZE) break;
    }
    const { error } = await db.storage
      .from(BACKUP_BUCKET)
      .upload(backupPath(at, table), JSON.stringify(rows), { contentType: 'application/json', upsert: false });
    if (error) return json({ error: `Saving ${table} failed: ${error.message}`, done }, 500);
    done[table] = rows.length;
  }
  return json({ ok: true, at: at.toISOString(), rows: done });
});
