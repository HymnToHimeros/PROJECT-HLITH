// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { USER_TABLES } from '../supabase/functions/_shared/accountPlan';
import { BACKUP_TABLES } from '../supabase/functions/_shared/backupPlan';
import { coversExport, duePurges, oldBackupFolders, PURGE_TABLES, purgeAccount, type PurgeClient } from '../supabase/functions/_shared/purgePlan';

const now = Date.parse('2026-11-20T12:00:00Z');

describe('finishing account deletions (T11)', () => {
  it('only requests past their grace period that were neither cancelled nor finished', () => {
    const rows = [
      { user_id: 'due', purge_after: '2026-11-20T11:00:00Z', cancelled_at: null, completed_at: null },
      { user_id: 'waiting', purge_after: '2026-11-21T00:00:00Z', cancelled_at: null, completed_at: null },
      { user_id: 'kept', purge_after: '2026-11-01T00:00:00Z', cancelled_at: '2026-10-20T00:00:00Z', completed_at: null },
      { user_id: 'done', purge_after: '2026-11-01T00:00:00Z', cancelled_at: null, completed_at: '2026-11-02T00:00:00Z' },
    ];
    expect(duePurges(rows, now)).toEqual(['due']);
  });

  it('covers every table an export covers, plus every user table the backup copies', () => {
    expect(coversExport()).toBe(true);
    const userTables = BACKUP_TABLES.filter((t) => !['catalog_items', 'hoyolab_codes', 'scheduler_jobs', 'scheduler_runs', 'scheduler_findings', 'announcements'].includes(t));
    expect(userTables.filter((t) => !(PURGE_TABLES as readonly string[]).includes(t))).toEqual([]);
    expect(USER_TABLES.length).toBeGreaterThan(10);
  });

  it('removes in a safe order: logins wiped first, rows pointing at links before links, the sign-in last', async () => {
    const calls: string[] = [];
    const c: PurgeClient = {
      wipeHoyolabLogins: async () => void calls.push('wipe'),
      deleteRows: async (t) => (calls.push(`rows:${t}`), 1),
      listFolder: async (b) => (b === 'avatars' ? ['avatar.jpg', 'banner.jpg'] : []),
      removeFiles: async (b, paths) => void calls.push(`files:${b}:${paths.join(',')}`),
      deleteSignIn: async () => void calls.push('signin'),
    };
    const out = await purgeAccount(c, 'u1');
    expect(calls[0]).toBe('wipe');
    expect(calls).toContain('files:avatars:u1/avatar.jpg,u1/banner.jpg');
    expect(calls.indexOf('rows:hoyolab_checkins')).toBeLessThan(calls.indexOf('rows:hoyolab_links'));
    expect(calls.indexOf('rows:hoyolab_redemptions')).toBeLessThan(calls.indexOf('rows:hoyolab_links'));
    expect(calls.at(-1)).toBe('signin');
    expect(out).toEqual({ rows: PURGE_TABLES.length, files: 2 });
  });

  it('stops at the first error so the request stays and is tried again next run', async () => {
    const calls: string[] = [];
    const c: PurgeClient = {
      wipeHoyolabLogins: async () => undefined,
      deleteRows: async (t) => {
        if (t === 'pulls') throw new Error('boom');
        calls.push(t);
        return 0;
      },
      listFolder: async () => [],
      removeFiles: async () => undefined,
      deleteSignIn: async () => void calls.push('signin'),
    };
    await expect(purgeAccount(c, 'u1')).rejects.toThrow('boom');
    expect(calls).not.toContain('signin');
    expect(calls).not.toContain('account_deletion_requests');
  });

  it('backups older than 30 days go; anything that isn’t a night folder stays', () => {
    expect(oldBackupFolders(['2026-10-20', '2026-10-21', '2026-11-19', 'notes', '2026-1-1'], now)).toEqual(['2026-10-20']);
  });
});
