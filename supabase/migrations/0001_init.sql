-- PROJECT-HLITH · 0001 · core tables
-- Rules (docs/PLAN.md §5):
--   * Every user table has user_id and row-level security: you only ever see your own rows.
--   * No user table has a delete policy. Your data is never wiped; things are hidden or
--     retired instead. Only the delete-account server function (service role) removes rows,
--     after offering an export.
--   * Built-in lists (catalog_items) and your progress live in separate tables, so list
--     updates never touch progress. Catalog items are retired, never deleted.
--   * Migrations only add. tests/migrations.test.ts blocks DROP, DELETE, TRUNCATE, RENAME
--     and ON DELETE CASCADE.

create extension if not exists pgcrypto;

-- Keeps updated_at current on every change.
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ── Profiles ────────────────────────────────────────────────────────
create table public.profiles (
  user_id uuid primary key references auth.users (id),
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own profile: read" on public.profiles for select using (user_id = (select auth.uid()));
create policy "own profile: create" on public.profiles for insert with check (user_id = (select auth.uid()));
create policy "own profile: change" on public.profiles for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

-- A profile row for every new sign-in.
create or replace function public.create_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.create_profile();

-- Owners: set by hand in the Supabase dashboard (service role only). Users can't make themselves owner.
create table public.owners (
  user_id uuid primary key references auth.users (id),
  created_at timestamptz not null default now()
);
alter table public.owners enable row level security;
create policy "owners: see yourself" on public.owners for select using (user_id = (select auth.uid()));

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.owners where user_id = (select auth.uid()));
$$;

-- ── Settings (layout, servers, chosen games) ───────────────────────
create table public.user_settings (
  user_id uuid primary key references auth.users (id),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_settings enable row level security;
create policy "own settings: read" on public.user_settings for select using (user_id = (select auth.uid()));
create policy "own settings: create" on public.user_settings for insert with check (user_id = (select auth.uid()));
create policy "own settings: change" on public.user_settings for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ── Built-in lists, maintained by the owner ───────────────────────
create table public.catalog_items (
  game_id text not null,
  kind text not null check (kind in ('character', 'banner', 'event', 'backlog', 'material', 'team', 'kit', 'version', 'leak', 'income')),
  id text not null,
  data jsonb not null,
  status text not null default 'active' check (status in ('active', 'retired')),
  source text not null default 'official',
  updated_at timestamptz not null default now(),
  primary key (game_id, kind, id)
);
alter table public.catalog_items enable row level security;
create policy "catalog: everyone signed in reads" on public.catalog_items for select to authenticated using (true);
create policy "catalog: owner adds" on public.catalog_items for insert to authenticated with check (public.is_owner());
create policy "catalog: owner changes" on public.catalog_items for update to authenticated using (public.is_owner()) with check (public.is_owner());
create trigger catalog_items_touch before update on public.catalog_items for each row execute function public.touch_updated_at();

-- ── Your own events, banners, backlog items, and hides (Edit mode) ─
create table public.user_items (
  user_id uuid not null references auth.users (id),
  game_id text not null,
  kind text not null,
  id text not null,
  ref_id text, -- the built-in item this changes or hides, if any
  data jsonb not null default '{}'::jsonb,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id, kind, id)
);
alter table public.user_items enable row level security;
create policy "own items: read" on public.user_items for select using (user_id = (select auth.uid()));
create policy "own items: create" on public.user_items for insert with check (user_id = (select auth.uid()));
create policy "own items: change" on public.user_items for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger user_items_touch before update on public.user_items for each row execute function public.touch_updated_at();

-- ── Roster ─────────────────────────────────────────────────────────
create table public.roster (
  user_id uuid not null references auth.users (id),
  game_id text not null,
  character_id text not null,
  owned boolean not null default false,
  wanted boolean not null default false,
  dupes integer check (dupes >= 0),
  level integer check (level >= 0),
  build jsonb,
  sources jsonb not null default '{}'::jsonb, -- which field came from where (manual, hoyolab, scan)
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id, character_id)
);
alter table public.roster enable row level security;
create policy "own roster: read" on public.roster for select using (user_id = (select auth.uid()));
create policy "own roster: create" on public.roster for insert with check (user_id = (select auth.uid()));
create policy "own roster: change" on public.roster for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger roster_touch before update on public.roster for each row execute function public.touch_updated_at();

-- ── Progress: events, login days, backlog counts, tasks per reset period ─
create table public.progress (
  user_id uuid not null references auth.users (id),
  game_id text not null,
  kind text not null check (kind in ('event', 'login', 'backlog', 'task')),
  ref_id text not null,
  period text not null default '', -- e.g. the game day for daily tasks
  state text check (state in ('open', 'done', 'skipped')),
  count integer check (count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id, kind, ref_id, period)
);
alter table public.progress enable row level security;
create policy "own progress: read" on public.progress for select using (user_id = (select auth.uid()));
create policy "own progress: create" on public.progress for insert with check (user_id = (select auth.uid()));
create policy "own progress: change" on public.progress for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger progress_touch before update on public.progress for each row execute function public.touch_updated_at();

-- ── Bank log: append-only ledger (no update, no delete) ───────────
create table public.bank_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  game_id text not null,
  at timestamptz not null,
  currency text not null,
  kind text not null check (kind in ('have', 'earned', 'bought', 'spent')),
  delta integer,
  balance integer check (balance >= 0),
  note text,
  source text not null default 'user',
  created_at timestamptz not null default now()
);
alter table public.bank_ledger enable row level security;
create policy "own ledger: read" on public.bank_ledger for select using (user_id = (select auth.uid()));
create policy "own ledger: add" on public.bank_ledger for insert with check (user_id = (select auth.uid()));
create index bank_ledger_user_game_at on public.bank_ledger (user_id, game_id, at);

-- ── Pull history: append-only, re-imports add only missing rows ───
create table public.pulls (
  user_id uuid not null references auth.users (id),
  game_id text not null,
  game_pull_id text not null, -- the game's own id, so imports never duplicate
  banner_type text not null,
  item_id text not null,
  name text not null,
  rarity text not null check (rarity in ('top', 'mid', 'low')),
  pulled_at timestamptz not null,
  source text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, game_id, game_pull_id)
);
alter table public.pulls enable row level security;
create policy "own pulls: read" on public.pulls for select using (user_id = (select auth.uid()));
create policy "own pulls: add" on public.pulls for insert with check (user_id = (select auth.uid()));
create index pulls_user_game_time on public.pulls (user_id, game_id, pulled_at);

-- ── Plans (yours and Assistant proposals) ─────────────────────────
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  game_id text not null,
  title text not null,
  starts timestamptz,
  ends timestamptz,
  origin text not null default 'user' check (origin in ('user', 'assistant')),
  status text not null default 'approved' check (status in ('proposed', 'approved', 'undone', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.plans enable row level security;
create policy "own plans: read" on public.plans for select using (user_id = (select auth.uid()));
create policy "own plans: create" on public.plans for insert with check (user_id = (select auth.uid()));
create policy "own plans: change" on public.plans for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger plans_touch before update on public.plans for each row execute function public.touch_updated_at();
