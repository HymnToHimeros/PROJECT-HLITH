-- PROJECT-HLITH · 0008 · owner console: announcements and real numbers
-- Same rules as 0001: this migration only adds. No delete policies: an announcement is
-- ended (ends_at), never removed.
--   * announcements: short notes from the owner to everyone signed in, shown as a strip at
--     the top of the app while they are active. Everyone signed in reads the active ones;
--     the owner reads all of them and adds or changes them.
--   * owner_stats(): counts for Owner console → Overview. Owner only; anyone else gets an error.

-- ── Announcements ─────────────────────────────────────────────────
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '' check (char_length(body) <= 2000),
  level text not null default 'info' check (level in ('info', 'warning')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(), -- no reference: writing a note never ties up an account
  constraint announcements_ends_after_start check (ends_at is null or ends_at > starts_at)
);
create index announcements_active on public.announcements (starts_at, ends_at);
alter table public.announcements enable row level security;
create policy "announcements: everyone signed in reads active ones" on public.announcements for select to authenticated
  using ((starts_at <= now() and (ends_at is null or ends_at > now())) or public.is_owner());
create policy "announcements: owner adds" on public.announcements for insert to authenticated with check (public.is_owner());
create policy "announcements: owner changes" on public.announcements for update to authenticated using (public.is_owner()) with check (public.is_owner());

-- ── Numbers for the owner ─────────────────────────────────────────
-- users: accounts. active_7d: accounts that signed in, or whose settings or game data
-- changed, in the last 7 days. hoyolab_links: saved HoYoLAB logins not forgotten.
-- jobs: each scheduler job's last run. findings_waiting: inbox items not decided yet.
create or replace function public.owner_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  result jsonb;
begin
  if not public.is_owner() then
    raise exception 'owner only' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'users', (select count(*) from auth.users),
    'active_7d', (
      select count(distinct id) from (
        select id from auth.users where last_sign_in_at > now() - interval '7 days'
        union all
        select user_id from public.user_settings where updated_at > now() - interval '7 days'
        union all
        select user_id from public.user_game_data where updated_at > now() - interval '7 days'
      ) recent
    ),
    'hoyolab_links', (select count(*) from public.hoyolab_links where forgotten_at is null),
    'jobs', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'last_run_at', last_run_at, 'last_status', last_status) order by id)
      from public.scheduler_jobs
    ), '[]'::jsonb),
    'findings_waiting', (select count(*) from public.scheduler_findings where status = 'new'),
    'counted_at', now()
  ) into result;
  return result;
end $$;
revoke execute on function public.owner_stats() from public, anon;
grant execute on function public.owner_stats() to authenticated;
