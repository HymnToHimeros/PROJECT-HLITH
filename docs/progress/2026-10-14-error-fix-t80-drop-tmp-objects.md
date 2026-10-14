# 2026-10-14 · ERROR-FIX · T80 remove left-over temporary objects (branch errorfix/t80-drop-tmp-objects)

- Migration 0021_drop_tmp_objects.sql drops `public._tmp_exec_sql(text)` (a SECURITY DEFINER that ran any SQL) and the policy `_tmp_anon_upsert` on `public.owner_theme_drafts` (anon could write). MANAGER had already revoked access by hand; this removes them for good. No table, column or row is removed.
- tests/migrations.test.ts now fails if any migration creates a function or policy named `_tmp…` (tests/lib/migration-rules.ts: tmpObjects).
- After merge: the migration runs on deploy; MANAGER checks live that both are gone.
