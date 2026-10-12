-- PROJECT-HLITH · 0020 · owner theme drafts (T74)
-- Same rules as 0001: this migration only adds. No rows here: the drafts are written straight
-- into the live database, never into this public repo.
--
-- Owner themes live in the private owner-themes bucket (0010). New themes made for the owner
-- wait here as drafts until the owner presses "Add the set themes" in Owner console → Owner
-- themes, which merges them into the bucket's manifest (never removing or overwriting the
-- owner's own themes). Only owners can read the drafts; nobody can write them through the API.
create table public.owner_theme_drafts (
  id text primary key check (id ~ '^[a-z0-9-]{1,40}$'),
  theme jsonb not null check (jsonb_typeof(theme) = 'object'),
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.owner_theme_drafts enable row level security;
create policy "owner theme drafts: owner reads" on public.owner_theme_drafts for select to authenticated
  using (public.is_owner());

-- The drafts in order, for the owner only.
create or replace function public.owner_theme_drafts() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'owner only' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(theme || jsonb_build_object('id', id) order by sort, id) from public.owner_theme_drafts), '[]'::jsonb);
end $$;
