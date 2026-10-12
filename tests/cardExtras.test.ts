// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findDestructive } from './lib/migration-rules';

const DIR = resolve(__dirname, '../supabase/migrations');
const sql = readFileSync(join(DIR, '0018_card_extras.sql'), 'utf8');
const body = (src: string, fn: string) => src.match(new RegExp(`create or replace function public\\.${fn}\\([\\s\\S]*?end \\$\\$;`))?.[0] ?? '';

describe('more on the profile card (0018, T64 B2)', () => {
  it('only adds', () => {
    expect(findDestructive(sql)).toEqual([]);
  });

  it('nobody can call the counting function directly; only the card uses it', () => {
    expect(sql).toContain('revoke execute on function public.pull_numbers(jsonb) from public, anon, authenticated;');
    expect(body(sql, 'profile_card')).toContain('nums := public.pull_numbers(pulls);');
  });

  it('counts like the app: a guaranteed result is no 50/50, and the luckiest pull skips the count before the first top', () => {
    const f = body(sql, 'pull_numbers');
    expect(f).toMatch(/if guaranteed then\s+guaranteed := false;\s+elsif r -> 'featured' = 'true'::jsonb then\s+won := won \+ 1;\s+elsif r -> 'featured' = 'false'::jsonb then\s+lost := lost \+ 1;\s+guaranteed := true;/);
    expect(f).toMatch(/if counting and \(best is null or since < /);
  });

  it('each new part shows only when its switch allows it, and the shelf holds only badges the server can see', () => {
    const f = body(sql, 'profile_card');
    expect(f).toContain("'shelf', case when (priv -> 'badges') is distinct from 'false'::jsonb then shelf end,");
    expect(f).toContain("'luckiest', case when (priv -> 'luck') is distinct from 'false'::jsonb then luckiest end,");
    expect(f).toMatch(/if \(priv -> 'showcase'\) is distinct from 'false'::jsonb and jsonb_typeof\(look -> 'best_team'\) = 'object' then/);
    expect(f).toMatch(/\) s where b = any \(badges\);/);
  });

  it('the card is otherwise 0017’s', () => {
    const before = body(readFileSync(join(DIR, '0017_owner_look.sql'), 'utf8'), 'profile_card');
    const now = body(sql, 'profile_card');
    // Everything 0017 returned is still returned the same way.
    // (title and display_name now also pass the slur check, tested below.)
    const changed = ["'stats'", "'title'", "'display_name'"];
    for (const line of before.split('\n').filter((l) => /^ {4}'[a-z_]+', /.test(l) && !changed.some((c) => l.includes(c)))) expect(now).toContain(line);
    // The owner's look (several lines in 0017) comes through unchanged too.
    expect(now).toContain(before.match(/ {4}'owner_style', [\s\S]*?\)\) end,/)?.[0] ?? 'missing in 0017');
    expect(now).toContain("if exists (select 1 from public.account_restrictions where user_id = p_user and (silenced_until > now() or banned_until > now())) then");
  });
});

describe('titles, bio, favourite game and the silenced rule (0018, T64 B2)', () => {
  const f = body(sql, 'profile_card');
  it('an earned title shows only while the server sees the badge; blocked words never show', () => {
    expect(f).toContain("'earned_title', case when look ->> 'title_badge' = any (badges) then look ->> 'title_badge' end,");
    expect(f).toContain("'title', case when not public.text_blocked(look ->> 'title') then left(look ->> 'title', 60) end,");
    expect(f).toContain("'display_name', case when not public.text_blocked(prof.display_name) then left(prof.display_name, 40) end,");
    expect(f).toContain("'bio', case when (priv -> 'bio') = 'true'::jsonb and not public.text_blocked(prof.bio) then left(prof.bio, 200) end,");
  });

  it('text is checked word by word with the username list', () => {
    expect(body(sql, 'text_blocked') || sql).toMatch(/regexp_split_to_table\(coalesce\(p, ''\), '\\s\+'\) w where w <> '' and public\.username_blocked\(w\)/);
  });

  it('while silenced, what others see stays as it was; private parts still change', () => {
    const g = body(sql, 'profiles_silence_guard');
    expect(g).toMatch(/if new\.user_id = \(select auth\.uid\(\)\) and public\.is_silenced\(\) then/);
    for (const col of ['display_name', 'bio', 'avatar_path', 'banner_path']) expect(g).toContain(`new.${col} := old.${col};`);
    expect(g).toContain("- 'look' - 'featured'");
    expect(sql).toContain('create trigger profiles_silence_guard before update on public.profiles for each row execute function public.profiles_silence_guard();');
  });
});
