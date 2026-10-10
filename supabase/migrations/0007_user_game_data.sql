-- PROJECT-HLITH · your game data syncs to your account.
-- One row per user holds the app's game data (bank log, pulls, roster, progress, own
-- items, teams, plans…) as JSON, like user_settings does for settings. The app keeps the
-- newer copy and leaves the other one as a backup in the browser. Private by row-level
-- security; there is no delete policy (account deletion runs server-side).
create table public.user_game_data (
  user_id uuid primary key references auth.users (id),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_game_data enable row level security;
create policy "own game data: read" on public.user_game_data for select using (user_id = (select auth.uid()));
create policy "own game data: create" on public.user_game_data for insert with check (user_id = (select auth.uid()));
create policy "own game data: change" on public.user_game_data for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
