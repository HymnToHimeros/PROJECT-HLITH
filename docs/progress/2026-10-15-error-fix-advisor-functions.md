# 2026-10-15 · ERROR-FIX · security advisor: function search paths and anon access (branch errorfix/advisor-functions)

- From the live health sweep (Supabase security advisor).
- Migration 0024_advisor_functions.sql:
  - a fixed, empty search_path on the 7 flagged functions (touch_updated_at, scheduler_runs_append_only, terms_version, privacy_version, username_key, username_reserved, username_blocked); each uses only built-ins or public.… names.
  - EXECUTE taken from anon/public on the 11 SECURITY DEFINER reward and owner functions signed-out visitors could call (all already refused them inside), kept for signed-in users; create_profile (the sign-up trigger) taken from everyone. is_owner stays open (row-level policies use it).
- tests/migrations.test.ts: every SECURITY DEFINER function must have EXECUTE taken from anon/public unless it is on the open list (is_owner). Fails without 0024.
- Numbered 0024: FRAME's 0023 (skport/hoyolab grants) should merge first.
