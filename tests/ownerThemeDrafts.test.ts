// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findDestructive } from './lib/migration-rules';

const sql = readFileSync(join(resolve(__dirname, '../supabase/migrations'), '0020_owner_theme_drafts.sql'), 'utf8');

describe('owner theme drafts (0020, T74)', () => {
  it('only adds, holds no rows, and only owners can read; nobody can write through the API', () => {
    expect(findDestructive(sql)).toEqual([]);
    expect(sql).not.toMatch(/\binsert\s+into\b/i);
    expect(sql).toContain('alter table public.owner_theme_drafts enable row level security;');
    expect(sql).toMatch(/"owner theme drafts: owner reads" on public\.owner_theme_drafts for select to authenticated\s+using \(public\.is_owner\(\)\);/);
    expect(sql).not.toMatch(/on public\.owner_theme_drafts for (insert|update|delete|all)\b/i);
    expect(sql).toMatch(/if not public\.is_owner\(\) then\s+raise exception 'owner only'/);
  });
});
