// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findDestructive } from './lib/migration-rules';

const DIR = resolve(__dirname, '../supabase/migrations');

describe('migrations never wipe user data', () => {
  it('no migration drops, deletes, truncates, renames or cascades', () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith('.sql'));
    const found = files.flatMap((f) =>
      findDestructive(readFileSync(join(DIR, f), 'utf8')).map((label) => `${f}: ${label}`),
    );
    expect(found).toEqual([]);
  });
});

describe('the migration checker itself', () => {
  it('flags destructive statements', () => {
    expect(findDestructive('DROP TABLE roster;')).toEqual(['DROP TABLE']);
    expect(findDestructive('alter table pulls drop column rarity;')).toEqual(['DROP COLUMN']);
    expect(findDestructive('delete from progress where 1=1;')).toEqual(['DELETE FROM']);
    expect(findDestructive('TRUNCATE bank_ledger;')).toEqual(['TRUNCATE']);
    expect(findDestructive('alter table roster rename to chars;')).toEqual(['RENAME (breaks existing data paths)']);
    expect(findDestructive('user_id uuid references auth.users on delete cascade')).toEqual(['ON DELETE CASCADE']);
  });

  it('allows additive statements and ignores comments', () => {
    expect(findDestructive('create table plans (id uuid primary key);')).toEqual([]);
    expect(findDestructive('alter table roster add column wanted boolean default false;')).toEqual([]);
    expect(findDestructive('-- never DROP TABLE here\n/* DELETE FROM x */ select 1;')).toEqual([]);
  });
});
