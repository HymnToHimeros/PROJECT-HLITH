import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BACKUP_TABLES, backupPath, isScheduler } from '../supabase/functions/_shared/backupPlan.ts';

describe('nightly backup plan', () => {
  it('backs up every table the database creates', () => {
    const sql = readFileSync('supabase/migrations/0001_init.sql', 'utf8');
    const created = [...sql.matchAll(/create table public\.(\w+)/g)].map((m) => m[1]);
    expect([...BACKUP_TABLES].sort()).toEqual(created.sort());
  });

  it('writes one folder per night (UTC) and one file per table', () => {
    expect(backupPath(new Date('2026-10-09T23:30:00Z'), 'pulls')).toBe('2026-10-09/pulls.json');
  });

  it('only the scheduler with the service key may start it', () => {
    expect(isScheduler('Bearer secret', 'secret')).toBe(true);
    expect(isScheduler('Bearer guess', 'secret')).toBe(false);
    expect(isScheduler(null, 'secret')).toBe(false);
    expect(isScheduler('Bearer ', undefined)).toBe(false);
  });
});
