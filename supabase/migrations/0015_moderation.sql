-- PROJECT-HLITH · 0015 · Owner console → Users: see who joined, silence, ban, remove (T60b)
-- Same rules as 0001: this migration only adds. Nothing here deletes an account: "Remove"
-- starts the normal 30-day deletion (account_deletion_requests, 0002), which the owner can
-- undo until the purge-accounts job finishes it.
--
--   * account_restrictions: one row per account the owner acted on. silenced_until and
--     banned_until; 'infinity' means until lifted (silence) or permanent (ban). Both run out
--     on their own: everything compares them with now().
--   * moderation_actions: the log (what, when, reason, until, who). Owner reads it; it goes
--     with the account when the account is deleted.
--   * is_banned() / is_silenced() / my_standing(): about the caller.
--   * A banned account can't read or change anything: restrictive policies on every table
--     with people's data, so even a session started before the ban is refused. Server
--     functions refuse it too (requireUser), except Export my data: a banned or removed
--     account can still sign in, see why, and download its own data (read-only).
--     Supabase Auth's own ban is not used on purpose: it would stop that sign-in.
--   * A silenced account keeps its own HLITH but can't appear in anything others see: its
--     profile card is not shown with teams it shares, and it can't write to community tables.
--     Every new community or sharing table must get the same silence policy
--     (tests/moderation.test.ts checks it). No new profile pictures or banners while silenced.
--   * Stored files follow the same rules (every bucket refuses a banned account).
--   * owner_users(): every account, without email addresses: profile name and picture,
--     sign-in methods, joined, last active, tester, owner, status.
--   * moderate(): owner only, never on yourself or another owner.

-- ── Restrictions and the log ──────────────────────────────────────
create table public.account_restrictions (
  user_id uuid primary key references auth.users (id),
  silenced_until timestamptz,
  banned_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.account_restrictions enable row level security;
create policy "account restrictions: owner reads" on public.account_restrictions for select to authenticated using (public.is_owner());

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  action text not null check (action in ('silence', 'lift_silence', 'ban', 'unban', 'remove', 'undo_remove')),
  reason text not null default '' check (char_length(reason) <= 300),
  until timestamptz,
  created_by uuid default auth.uid(), -- no reference: an owner's account can go without tying this up
  created_at timestamptz not null default now()
);
create index moderation_actions_by_time on public.moderation_actions (created_at desc);
alter table public.moderation_actions enable row level security;
create policy "moderation log: owner reads" on public.moderation_actions for select to authenticated using (public.is_owner());

-- ── About the caller ──────────────────────────────────────────────
create or replace function public.is_banned() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.account_restrictions where user_id = (select auth.uid()) and banned_until > now());
$$;

create or replace function public.is_silenced() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.account_restrictions where user_id = (select auth.uid()) and (silenced_until > now() or banned_until > now()));
$$;

-- For the app's calm "suspended" screen and the silenced notes. Only times still to come.
create or replace function public.my_standing() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'banned_until', (select case when banned_until > now() then banned_until end from public.account_restrictions where user_id = (select auth.uid())),
    'silenced_until', (select case when silenced_until > now() then silenced_until end from public.account_restrictions where user_id = (select auth.uid()))
  );
$$;

-- For the server's own scheduled jobs that act for people (service role only): which of these
-- accounts are banned right now, so the jobs skip them (_shared/moderation.ts).
create or replace function public.banned_among(p_users uuid[]) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(user_id), '{}') from public.account_restrictions where user_id = any (p_users) and banned_until > now();
$$;
revoke all on function public.banned_among(uuid[]) from public, anon, authenticated;
grant execute on function public.banned_among(uuid[]) to service_role;

-- ── Banned: refused everywhere ────────────────────────────────────
-- Restrictive policies are added to the existing ones (all must pass). No delete policies.
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'user_settings', 'user_game_data', 'user_items', 'roster', 'progress', 'bank_ledger', 'pulls', 'plans',
    'reminder_settings', 'account_deletion_requests', 'hoyolab_links', 'hoyolab_checkins', 'hoyolab_redemptions',
    'hoyolab_my_codes', 'community_members', 'community_invites', 'announcements', 'owners'
  ] loop
    execute format('create policy %I on public.%I as restrictive for select to authenticated using (not (select public.is_banned()))', 'banned: no reading', t);
    execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (not (select public.is_banned()))', 'banned: no adding', t);
    execute format('create policy %I on public.%I as restrictive for update to authenticated using (not (select public.is_banned())) with check (not (select public.is_banned()))', 'banned: no changing', t);
  end loop;
end $$;

-- Stored files too: every bucket, so a banned account can't read, upload or replace any file
-- (there are no delete policies on files at all). The scheduled jobs that act for people
-- (HoYoLAB daily, the calendar feed) skip banned accounts on their own (_shared/moderation.ts).
create policy "banned: no reading files" on storage.objects as restrictive for select to authenticated
  using (not (select public.is_banned()));
create policy "banned: no adding files" on storage.objects as restrictive for insert to authenticated
  with check (not (select public.is_banned()));
create policy "banned: no changing files" on storage.objects as restrictive for update to authenticated
  using (not (select public.is_banned())) with check (not (select public.is_banned()));

-- ── Silenced: nothing community-facing ────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array['community_members', 'community_invites'] loop
    execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (not (select public.is_silenced()))', 'silenced: no posting', t);
    execute format('create policy %I on public.%I as restrictive for update to authenticated using (not (select public.is_silenced())) with check (not (select public.is_silenced()))', 'silenced: no changing', t);
  end loop;
end $$;

-- Profile pictures and banners show on shared profile cards: no new ones while silenced.
create policy "silenced: no new profile pictures" on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'avatars' or not (select public.is_silenced()));
create policy "silenced: no changing profile pictures" on storage.objects as restrictive for update to authenticated
  using (bucket_id <> 'avatars' or not (select public.is_silenced())) with check (bucket_id <> 'avatars' or not (select public.is_silenced()));

-- The profile card shown with shared teams (0011), now also hidden while silenced or banned.
create or replace function public.profile_card(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  prof public.profiles%rowtype;
  sc jsonb;
  look jsonb;
  priv jsonb;
  games jsonb;
  g text;
  gd jsonb;
  pulls jsonb;
  n int;
  t int;
  total_pulls int := 0;
  total_tops int := 0;
  active int := 0;
  any_owned boolean := false;
  any_ledger boolean := false;
  any_backlog boolean := false;
  any_farm boolean := false;
  any_plans boolean := false;
  any_events boolean := false;
  any_builds boolean := false;
  dawn_run int := 0;
  owner boolean;
  badges text[] := array['seated'];
  stats jsonb := '[]'::jsonb;
  featured jsonb := '[]'::jsonb;
  item jsonb;
  team jsonb;
  pinned text;
  frame text;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if exists (select 1 from public.account_restrictions where user_id = p_user and (silenced_until > now() or banned_until > now())) then
    return null;
  end if;
  select * into prof from public.profiles where user_id = p_user;
  if not found then
    return null;
  end if;
  sc := case when jsonb_typeof(prof.showcase) = 'object' then prof.showcase else '{}'::jsonb end;
  priv := case when jsonb_typeof(sc -> 'privacy') = 'object' then sc -> 'privacy' else '{}'::jsonb end;
  if (priv -> 'card') is distinct from 'true'::jsonb then
    return null;
  end if;
  look := case when jsonb_typeof(sc -> 'look') = 'object' then sc -> 'look' else '{}'::jsonb end;
  owner := exists (select 1 from public.owners where user_id = p_user);
  select data -> 'games' into games from public.user_game_data where user_id = p_user;
  if jsonb_typeof(games) is distinct from 'object' then
    games := '{}'::jsonb;
  end if;

  for g, gd in select key, value from jsonb_each(games) loop
    continue when jsonb_typeof(gd) <> 'object';
    pulls := case when jsonb_typeof(gd -> 'pulls') = 'array' then gd -> 'pulls' else '[]'::jsonb end;
    n := jsonb_array_length(pulls);
    select count(*) into t from jsonb_array_elements(pulls) e where e ->> 'rarity' = 'top';
    if n > 0 then
      stats := stats || jsonb_build_array(jsonb_build_object('game', g, 'total', n, 'tops', t));
    end if;
    total_pulls := total_pulls + n;
    total_tops := total_tops + t;
    if jsonb_typeof(gd -> 'roster') = 'object' and exists (select 1 from jsonb_each(gd -> 'roster') r where r.value -> 'owned' = 'true'::jsonb) then
      any_owned := true;
      active := active + 1;
    elsif n > 0 then
      active := active + 1;
    end if;
    any_ledger := any_ledger or (jsonb_typeof(gd -> 'ledger') = 'array' and exists (select 1 from jsonb_array_elements(gd -> 'ledger') e where not (e ? 'reverses')));
    any_backlog := any_backlog or (jsonb_typeof(gd -> 'backlog') = 'object' and gd -> 'backlog' <> '{}'::jsonb);
    any_farm := any_farm or (jsonb_typeof(gd -> 'farm') = 'array' and jsonb_array_length(gd -> 'farm') > 0);
    any_plans := any_plans or (jsonb_typeof(gd -> 'plans') = 'array' and jsonb_array_length(gd -> 'plans') > 0);
    any_events := any_events or (jsonb_typeof(gd -> 'events') = 'object' and gd -> 'events' <> '{}'::jsonb);
    any_builds := any_builds or (jsonb_typeof(gd -> 'builds') = 'object' and gd -> 'builds' <> '{}'::jsonb);
  end loop;

  select coalesce(max(run), 0) into dawn_run from (
    select count(*) as run from (
      select d, d - (row_number() over (order by d))::int as grp
      from (select distinct (ran_at at time zone 'utc')::date as d from public.hoyolab_checkins where user_id = p_user and status in ('claimed', 'already')) days
    ) runs group by grp
  ) best;

  if owner then badges := array['owner'] || badges; end if;
  if total_tops > 0 then badges := badges || 'first-light'::text; end if;
  if total_pulls >= 100 then badges := badges || 'hundred'::text; end if;
  if total_pulls >= 1000 then badges := badges || 'thousand'::text; end if;
  if active >= 2 then badges := badges || 'between-worlds'::text; end if;
  if dawn_run >= 30 then badges := badges || 'thirty-dawns'::text; end if;
  if any_owned then badges := badges || 'hall'::text; end if;
  if any_ledger then badges := badges || 'treasurer'::text; end if;
  if any_backlog then badges := badges || 'sagas'::text; end if;
  if any_farm then badges := badges || 'gatherer'::text; end if;
  if any_plans then badges := badges || 'rune-days'::text; end if;
  if any_events then badges := badges || 'feast-days'::text; end if;
  if any_builds then badges := badges || 'smith'::text; end if;

  if (priv -> 'showcase') is distinct from 'false'::jsonb and jsonb_typeof(sc -> 'featured') = 'array' then
    for item in select value from jsonb_array_elements(sc -> 'featured') limit 4 loop
      gd := games -> (item ->> 'game');
      continue when gd is null or jsonb_typeof(gd) <> 'object';
      if item ->> 'kind' = 'character' and gd -> 'roster' -> (item ->> 'id') -> 'owned' = 'true'::jsonb then
        featured := featured || jsonb_build_array(jsonb_build_object('kind', 'character', 'game', item ->> 'game', 'id', item ->> 'id'));
      elsif item ->> 'kind' = 'team' and jsonb_typeof(gd -> 'teams') = 'array' then
        select value into team from jsonb_array_elements(gd -> 'teams') where value ->> 'id' = item ->> 'id' limit 1;
        if team is not null then
          featured := featured || jsonb_build_array(jsonb_build_object('kind', 'team', 'game', item ->> 'game', 'id', item ->> 'id', 'name', left(coalesce(team ->> 'name', ''), 60), 'members', coalesce(team -> 'members', '[]'::jsonb)));
        end if;
        team := null;
      end if;
    end loop;
  end if;

  pinned := look ->> 'pinned_badge';
  if pinned is not null and not (pinned = any (badges)) then pinned := null; end if;
  frame := look ->> 'frame';
  if frame = 'sky' and not owner then frame := 'none'; end if;

  return jsonb_build_object(
    'display_name', left(prof.display_name, 40),
    'avatar_path', prof.avatar_path,
    'banner_path', prof.banner_path,
    'title', left(look ->> 'title', 60),
    'frame', frame,
    'name_color', look ->> 'name_color',
    'avatar_char', look -> 'avatar_char',
    'banner_char', look -> 'banner_char',
    'owner', owner,
    'owner_title', case when owner then look ->> 'owner_title' end,
    'badges', case when (priv -> 'badges') is distinct from 'false'::jsonb then to_jsonb(badges) end,
    'pinned_badge', case when (priv -> 'badges') is distinct from 'false'::jsonb then pinned end,
    'stats', case when (priv -> 'stats') is distinct from 'false'::jsonb then stats end,
    'featured', featured
  );
end $$;

-- ── Owner: everyone, without email addresses ──────────────────────
create or replace function public.owner_users() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'owner only' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', u.id,
      'name', left(p.display_name, 40),
      'avatar_path', p.avatar_path,
      'methods', coalesce(u.raw_app_meta_data -> 'providers', '[]'::jsonb),
      'joined_at', u.created_at,
      'last_active_at', greatest(u.last_sign_in_at, s.updated_at, d.updated_at),
      'tester', exists (select 1 from public.community_members m where m.user_id = u.id and m.removed_at is null),
      'owner', exists (select 1 from public.owners o where o.user_id = u.id),
      'silenced_until', case when r.silenced_until > now() then r.silenced_until end,
      'banned_until', case when r.banned_until > now() then r.banned_until end,
      'deleting_after', case when q.cancelled_at is null and q.completed_at is null then q.purge_after end,
      'removed_by_owner', q.cancelled_at is null and q.completed_at is null and q.reason = 'removed-by-owner'
    ) order by u.created_at desc)
    from auth.users u
    left join public.profiles p on p.user_id = u.id
    left join public.user_settings s on s.user_id = u.id
    left join public.user_game_data d on d.user_id = u.id
    left join public.account_restrictions r on r.user_id = u.id
    left join public.account_deletion_requests q on q.user_id = u.id
  ), '[]'::jsonb);
end $$;

create or replace function public.owner_moderation_log() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'owner only' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id,
      'user_id', a.user_id,
      'name', left(p.display_name, 40),
      'action', a.action,
      'reason', a.reason,
      'until', a.until,
      'by_name', left(b.display_name, 40),
      'created_at', a.created_at
    ) order by a.created_at desc)
    from (select * from public.moderation_actions order by created_at desc limit 300) a
    left join public.profiles p on p.user_id = a.user_id
    left join public.profiles b on b.user_id = a.created_by
  ), '[]'::jsonb);
end $$;

-- ── Owner: act ────────────────────────────────────────────────────
-- p_hours: 24 or 168, or null for "until lifted" (silence) / "permanent" (ban). Remove is a
-- permanent ban plus the normal 30-day deletion; Undo remove cancels both.
create or replace function public.moderate(p_user uuid, p_action text, p_hours int default null, p_reason text default '') returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  until_at timestamptz;
  removing boolean;
begin
  if not public.is_owner() then
    raise exception 'owner only' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'not on your own account' using errcode = '22023';
  end if;
  if exists (select 1 from public.owners where user_id = p_user) then
    raise exception 'not on an owner account' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users where id = p_user) then
    raise exception 'no such account' using errcode = '22023';
  end if;
  if p_hours is not null and p_hours not in (24, 168) then
    raise exception 'pick 24 hours, 7 days or no end' using errcode = '22023';
  end if;
  until_at := case when p_hours is null then 'infinity'::timestamptz else now() + make_interval(hours => p_hours) end;
  removing := exists (select 1 from public.account_deletion_requests where user_id = p_user and cancelled_at is null and completed_at is null and reason = 'removed-by-owner');
  insert into public.account_restrictions (user_id) values (p_user) on conflict (user_id) do nothing;

  if p_action = 'silence' then
    update public.account_restrictions set silenced_until = until_at, updated_at = now() where user_id = p_user;
  elsif p_action = 'lift_silence' then
    update public.account_restrictions set silenced_until = null, updated_at = now() where user_id = p_user;
    until_at := null;
  elsif p_action = 'ban' then
    if removing then raise exception 'this account is being removed: use Undo remove' using errcode = '22023'; end if;
    update public.account_restrictions set banned_until = until_at, updated_at = now() where user_id = p_user;
  elsif p_action = 'unban' then
    if removing then raise exception 'this account is being removed: use Undo remove' using errcode = '22023'; end if;
    update public.account_restrictions set banned_until = null, updated_at = now() where user_id = p_user;
    until_at := null;
  elsif p_action = 'remove' then
    update public.account_restrictions set banned_until = 'infinity', updated_at = now() where user_id = p_user;
    insert into public.account_deletion_requests (user_id, requested_at, purge_after, cancelled_at, completed_at, reason)
    values (p_user, now(), now() + interval '30 days', null, null, 'removed-by-owner')
    on conflict (user_id) do update
      set requested_at = now(), purge_after = now() + interval '30 days', cancelled_at = null, completed_at = null, reason = 'removed-by-owner';
    until_at := now() + interval '30 days';
  elsif p_action = 'undo_remove' then
    if not removing then raise exception 'nothing to undo' using errcode = '22023'; end if;
    update public.account_deletion_requests set cancelled_at = now() where user_id = p_user and cancelled_at is null and completed_at is null;
    update public.account_restrictions set banned_until = null, updated_at = now() where user_id = p_user;
    until_at := null;
  else
    raise exception 'unknown action' using errcode = '22023';
  end if;

  insert into public.moderation_actions (user_id, action, reason, until, created_by)
  values (p_user, p_action, left(btrim(coalesce(p_reason, '')), 300), until_at, auth.uid());
  return jsonb_build_object('action', p_action, 'until', until_at);
end $$;

revoke execute on function public.is_banned() from public, anon;
revoke execute on function public.is_silenced() from public, anon;
revoke execute on function public.my_standing() from public, anon;
revoke execute on function public.owner_users() from public, anon;
revoke execute on function public.owner_moderation_log() from public, anon;
revoke execute on function public.moderate(uuid, text, int, text) from public, anon;
grant execute on function public.is_banned() to authenticated;
grant execute on function public.is_silenced() to authenticated;
grant execute on function public.my_standing() to authenticated;
grant execute on function public.owner_users() to authenticated;
grant execute on function public.owner_moderation_log() to authenticated;
grant execute on function public.moderate(uuid, text, int, text) to authenticated;
