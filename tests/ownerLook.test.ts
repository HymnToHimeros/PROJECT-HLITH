// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findDestructive } from './lib/migration-rules';

const DIR = resolve(__dirname, '../supabase/migrations');
const sql = readFileSync(join(DIR, '0017_owner_look.sql'), 'utf8');
const body = (src: string, fn: string) => src.match(new RegExp(`create or replace function public\\.${fn}\\([\\s\\S]*?end \\$\\$;`))?.[0] ?? '';

describe('the owner’s look on the profile card (0017, T64)', () => {
  it('only adds', () => {
    expect(findDestructive(sql)).toEqual([]);
  });

  it('the card is 0016’s plus the owner’s look, and nothing else changed', () => {
    const before = body(readFileSync(join(DIR, '0016_first_run.sql'), 'utf8'), 'profile_card');
    const now = body(sql, 'profile_card');
    const added = [
      '\n  os jsonb;',
      "\n  -- The owner's look: only for the owner, only whole numbers (the app checks the ranges too).\n  os := case when owner and jsonb_typeof(look -> 'owner_style') = 'object' then look -> 'owner_style' end;",
      /\n {4}'owner_style', case when os is not null then [\s\S]*?\)\) end,/,
    ];
    let stripped = now;
    for (const a of added) {
      expect(stripped).toMatch(a);
      stripped = stripped.replace(a, '');
    }
    expect(stripped).toBe(before);
  });

  it('only the owner’s look is ever returned, and only as numbers', () => {
    const now = body(sql, 'profile_card');
    expect(now).toMatch(/owner := exists \(select 1 from public\.owners where user_id = p_user\);/);
    expect(now).toMatch(/os := case when owner and /);
    for (const k of ['badge', 'frame', 'name', 'frameVariant', 'nameVariant']) expect(now).toContain(`'${k}', case when jsonb_typeof(os -> '${k}') = 'number' then os -> '${k}' end`);
  });
});
