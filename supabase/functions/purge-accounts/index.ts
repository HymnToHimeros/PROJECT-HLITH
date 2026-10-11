// Supabase Edge Function: finish account deletions (T11, owner's T55).
// "Delete my account" starts a 30-day grace period (delete-account). This job, run daily by the
// scheduler with the project's service key, finishes every request whose grace period is over and
// that wasn't cancelled: the saved HoYoLAB logins are overwritten in Vault, the account's pictures
// (avatars, backgrounds) and every row of it are removed, then the sign-in account itself.
// It also removes nightly backups older than 30 days, so a deleted account leaves every copy too.
// Anyone else gets 401. It reports counts only, never who.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { BACKUP_BUCKET, isScheduler } from '../_shared/backupPlan.ts';
import { duePurges, oldBackupFolders, purgeAccount, type PurgeClient } from '../_shared/purgePlan.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!isScheduler(req.headers.get('Authorization'), serviceKey) || !url || !serviceKey) return json({ error: 'Not allowed.' }, 401);
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  const client: PurgeClient = {
    async wipeHoyolabLogins(userId) {
      const { error } = await db.rpc('hoyolab_links_purge', { p_user: userId });
      if (error) throw new Error(`Wiping saved logins failed: ${error.message}`);
    },
    async deleteRows(table, userId, column = 'user_id') {
      const { error, count } = await db.from(table).delete({ count: 'exact' }).eq(column, userId);
      if (error) throw new Error(`Removing ${table} failed: ${error.message}`);
      return count ?? 0;
    },
    async listFolder(bucket, userId) {
      const { data, error } = await db.storage.from(bucket).list(userId, { limit: 1000 });
      if (error) throw new Error(`Listing ${bucket} failed: ${error.message}`);
      return (data ?? []).map((f) => f.name);
    },
    async removeFiles(bucket, paths) {
      const { error } = await db.storage.from(bucket).remove(paths);
      if (error) throw new Error(`Removing ${bucket} files failed: ${error.message}`);
    },
    async deleteSignIn(userId) {
      const { error } = await db.auth.admin.deleteUser(userId);
      if (error) throw new Error(`Removing the sign-in failed: ${error.message}`);
    },
  };

  const now = Date.now();
  const { data: requests, error } = await db.from('account_deletion_requests').select('user_id, purge_after, cancelled_at, completed_at');
  if (error) return json({ error: `Reading deletion requests failed: ${error.message}` }, 500);
  let accounts = 0;
  let rows = 0;
  let files = 0;
  const failed: string[] = [];
  for (const userId of duePurges(requests ?? [], now)) {
    try {
      const done = await purgeAccount(client, userId);
      accounts++;
      rows += done.rows;
      files += done.files;
    } catch (e) {
      failed.push(e instanceof Error ? e.message : 'unknown error');
    }
  }

  // Backups older than 30 days: their folders and files.
  let backupFolders = 0;
  const { data: top, error: listError } = await db.storage.from(BACKUP_BUCKET).list('', { limit: 1000 });
  if (listError) failed.push(`Listing backups failed: ${listError.message}`);
  for (const folder of oldBackupFolders((top ?? []).map((f) => f.name), now)) {
    const { data: inside } = await db.storage.from(BACKUP_BUCKET).list(folder, { limit: 1000 });
    const paths = (inside ?? []).map((f) => `${folder}/${f.name}`);
    if (paths.length) {
      const { error: rmError } = await db.storage.from(BACKUP_BUCKET).remove(paths);
      if (rmError) {
        failed.push(`Removing backup ${folder} failed: ${rmError.message}`);
        continue;
      }
    }
    backupFolders++;
  }

  const body = { ok: failed.length === 0, accounts, rows, files, backupFolders, failed };
  return json(body, failed.length ? 500 : 200);
});
