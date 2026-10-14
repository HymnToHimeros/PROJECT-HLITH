-- Security cleanup (T80): two temporary objects left behind while loading owner theme drafts.
--   * public._tmp_exec_sql(text): SECURITY DEFINER that runs any SQL (EXECUTE already revoked
--     from public, anon and authenticated by hand on 14 Oct; this removes it for good).
--   * policy _tmp_anon_upsert on public.owner_theme_drafts: anon could write drafts (anon's
--     INSERT/UPDATE/DELETE grants already revoked by hand).
-- Removes no table, column or row; nobody's data is touched. Safe to run where they don't exist.
-- tests/migrations.test.ts fails if any migration creates a function or policy named _tmp….
drop function if exists public._tmp_exec_sql(text);
drop policy if exists _tmp_anon_upsert on public.owner_theme_drafts;
