-- PROJECT-HLITH · 0002 · account: deletion requests, evening message and calendar feed
-- Same rules as 0001: every user table has user_id and row-level security, no delete
-- policy, and this migration only adds.

-- ── Delete my account (R57) ───────────────────────────────────────
-- "Delete my account" never removes rows on the spot. The delete-account server
-- function records a request with a 30-day grace period; during that time signing in
-- and pressing "Keep my account" cancels it, and the data can still be exported.
-- After the grace period the owner completes it with the service role (outside any
-- migration), after the export was offered. Nothing here wipes anything.
create table public.account_deletion_requests (
  user_id uuid primary key references auth.users (id),
  requested_at timestamptz not null default now(),
  purge_after timestamptz not null default (now() + interval '30 days'),
  cancelled_at timestamptz,
  completed_at timestamptz,
  reason text,
  updated_at timestamptz not null default now()
);
alter table public.account_deletion_requests enable row level security;
create policy "own deletion request: read" on public.account_deletion_requests for select using (user_id = (select auth.uid()));
create policy "own deletion request: create" on public.account_deletion_requests for insert with check (user_id = (select auth.uid()));
create policy "own deletion request: change" on public.account_deletion_requests for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger account_deletion_requests_touch before update on public.account_deletion_requests for each row execute function public.touch_updated_at();

-- ── Evening message (R51) and calendar feed (R52) ─────────────────
-- One row per user. `schedule` is a snapshot the app writes from the game records
-- (servers, reset rules, real banner and event dates; never examples), so the server
-- functions need no game knowledge of their own. `feed_token` is the secret in the
-- calendar link; "New link" replaces it, "Switch off" sets feed_enabled = false.
create table public.reminder_settings (
  user_id uuid primary key references auth.users (id),
  notify jsonb not null default '{}'::jsonb,
  schedule jsonb not null default '{}'::jsonb,
  feed_enabled boolean not null default false,
  feed_token text unique,
  push_subscription jsonb,
  updated_at timestamptz not null default now()
);
alter table public.reminder_settings enable row level security;
create policy "own reminders: read" on public.reminder_settings for select using (user_id = (select auth.uid()));
create policy "own reminders: create" on public.reminder_settings for insert with check (user_id = (select auth.uid()));
create policy "own reminders: change" on public.reminder_settings for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger reminder_settings_touch before update on public.reminder_settings for each row execute function public.touch_updated_at();
