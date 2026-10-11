-- PROJECT-HLITH · 0016 · first run: accept the Terms and Privacy policy, choose a username (T62)
-- Same rules as 0001: this migration only adds.
--
-- Before anyone uses HLIÐSKJÁLF (new accounts, and existing ones once, the owner too):
--   1. accept the current Terms of service and Privacy policy (their versions are below and in
--      config/legal/versions.ts; a test keeps them equal). Raising a version asks everyone to
--      accept again (only that step).
--   2. choose a username: 3–20 letters, numbers, _ and . ; unique ignoring case; names that
--      could pass for HLIÐSKJÁLF or its staff are refused, and so are slurs and swearing.
--      It can be changed later, at most once every 30 days; the old name is freed.
--
--   * account_identity: the username and when which version was accepted. People read their
--     own row; nobody writes it directly (only accept_legal and set_username), so the rules
--     can't be skipped with a plain update.
--   * Until both are done, an account can't add to or change its app data (restrictive
--     policies). Reading, Export my data and Delete my account stay possible (server functions
--     check this through requireUser, which lets those two through).
--   * The owner's lists, Members and the profile card show the username from now on.

-- ── Versions (raise them here and in config/legal/versions.ts) ─────
create or replace function public.terms_version() returns int language sql immutable as $$ select 1 $$;
create or replace function public.privacy_version() returns int language sql immutable as $$ select 1 $$;

-- ── The table ─────────────────────────────────────────────────────
create table public.account_identity (
  user_id uuid primary key references auth.users (id),
  username text check (username ~ '^[A-Za-z0-9_.]{3,20}$'),
  username_changed_at timestamptz,
  terms_version int,
  terms_accepted_at timestamptz,
  privacy_version int,
  privacy_accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index account_identity_username_unique on public.account_identity (lower(username));
alter table public.account_identity enable row level security;
create policy "account identity: see your own" on public.account_identity for select to authenticated using (user_id = (select auth.uid()));
create policy "account identity: owner reads" on public.account_identity for select to authenticated using (public.is_owner());
-- Same as every table with people's data (0015): a banned account reads nothing directly.
create policy "banned: no reading" on public.account_identity as restrictive for select to authenticated using (not (select public.is_banned()));

-- ── Username rules ────────────────────────────────────────────────
-- Compared without case, dots, underscores and look-alike digits (0→o, 1→i, 3→e, 4→a, 5→s, 7→t).
create or replace function public.username_key(p_name text) returns text
language sql immutable as $$
  select translate(lower(coalesce(p_name, '')), '013457._', 'oieast');
$$;

-- Anything containing these could pass for HLIÐSKJÁLF or its staff.
create or replace function public.username_reserved(p_name text) returns boolean
language sql immutable as $$
  select exists (
    select 1 from unnest(array['owner', 'admin', 'mod', 'moderator', 'hlith', 'hlidskjalf', 'hliðskjálf', 'projecthlith', 'support', 'staff', 'official', 'system']) r
    where public.username_key(p_name) like '%' || public.username_key(r) || '%'
  );
$$;

-- A short list of slurs and swearing (substring, after the same folding). Words that hide
-- inside ordinary ones (therapist, peacock, spicy, swank) are left out on purpose.
create or replace function public.username_blocked(p_name text) returns boolean
language sql immutable as $$
  select exists (
    select 1 from unnest(array['fuck', 'shit', 'cunt', 'bitch', 'whore', 'slut', 'nigger', 'nigga', 'faggot', 'retard', 'kike', 'chink', 'tranny', 'nazi', 'hitler', 'porn', 'pussy', 'bastard']) b
    where public.username_key(p_name) like '%' || b || '%'
  );
$$;

-- 'ok', 'yours' (already yours), 'taken', 'invalid', 'reserved' or 'blocked'.
create or replace function public.username_status(p_name text) returns text
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if p_name is null or p_name !~ '^[A-Za-z0-9_.]{3,20}$' then return 'invalid'; end if;
  if public.username_reserved(p_name) then return 'reserved'; end if;
  if public.username_blocked(p_name) then return 'blocked'; end if;
  if exists (select 1 from public.account_identity where lower(username) = lower(p_name) and user_id = auth.uid()) then return 'yours'; end if;
  if exists (select 1 from public.account_identity where lower(username) = lower(p_name)) then return 'taken'; end if;
  return 'ok';
end $$;

-- ── Where the caller stands ───────────────────────────────────────
create or replace function public.has_accepted() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.account_identity
    where user_id = (select auth.uid()) and username is not null
      and terms_version >= public.terms_version() and privacy_version >= public.privacy_version()
  );
$$;

-- For the app's first-run screen. suggested: the display name, when it would be a valid, free username.
create or replace function public.my_gate() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  me public.account_identity%rowtype;
  shown text;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  select * into me from public.account_identity where user_id = auth.uid();
  select display_name into shown from public.profiles where user_id = auth.uid();
  return jsonb_build_object(
    'terms_version', public.terms_version(),
    'privacy_version', public.privacy_version(),
    'terms_ok', coalesce(me.terms_version >= public.terms_version(), false),
    'privacy_ok', coalesce(me.privacy_version >= public.privacy_version(), false),
    'username', me.username,
    'next_change_at', case when me.username_changed_at is not null then me.username_changed_at + interval '30 days' end,
    'suggested', case when me.username is null and public.username_status(btrim(shown)) = 'ok' then btrim(shown) end,
    'banned', public.is_banned(),
    'accepted', public.has_accepted()
  );
end $$;

-- ── Writing (the only way) ────────────────────────────────────────
-- The versions must be the current ones (an old page can't accept an old text).
create or replace function public.accept_legal(p_terms int, p_privacy int) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if p_terms is distinct from public.terms_version() or p_privacy is distinct from public.privacy_version() then
    raise exception 'the Terms or Privacy policy changed: reload to read the current ones' using errcode = '22023';
  end if;
  insert into public.account_identity (user_id, terms_version, terms_accepted_at, privacy_version, privacy_accepted_at)
  values (auth.uid(), p_terms, now(), p_privacy, now())
  on conflict (user_id) do update
    set terms_version = excluded.terms_version, terms_accepted_at = now(), privacy_version = excluded.privacy_version, privacy_accepted_at = now();
  return public.my_gate();
end $$;

-- First choice any time; after that at most once every 30 days. The old name is freed.
create or replace function public.set_username(p_name text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  me public.account_identity%rowtype;
  status text;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  status := public.username_status(p_name);
  if status = 'yours' and exists (select 1 from public.account_identity where user_id = auth.uid() and username = p_name) then
    return public.my_gate();
  end if;
  if status not in ('ok', 'yours') then
    raise exception 'username %', status using errcode = '22023';
  end if;
  select * into me from public.account_identity where user_id = auth.uid() for update;
  if me.username is not null and me.username_changed_at is not null and me.username_changed_at > now() - interval '30 days' then
    raise exception 'you can change your username again on %', to_char(me.username_changed_at + interval '30 days', 'YYYY-MM-DD') using errcode = '22023';
  end if;
  insert into public.account_identity (user_id, username) values (auth.uid(), p_name)
  on conflict (user_id) do update
    set username = excluded.username,
        username_changed_at = case when public.account_identity.username is null then public.account_identity.username_changed_at else now() end;
  return public.my_gate();
exception when unique_violation then
  raise exception 'username taken' using errcode = '22023';
end $$;

-- ── Until then: no adding or changing app data ────────────────────
-- Reading stays, and so do the deletion request and Export my data (server functions).
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'user_settings', 'user_game_data', 'user_items', 'roster', 'progress', 'bank_ledger', 'pulls', 'plans',
    'reminder_settings', 'hoyolab_links', 'hoyolab_checkins', 'hoyolab_redemptions', 'hoyolab_my_codes',
    'community_members', 'community_invites', 'announcements'
  ] loop
    execute format('create policy %I on public.%I as restrictive for insert to authenticated with check ((select public.has_accepted()))', 'first run: accept first (adding)', t);
    execute format('create policy %I on public.%I as restrictive for update to authenticated using ((select public.has_accepted())) with check ((select public.has_accepted()))', 'first run: accept first (changing)', t);
  end loop;
end $$;
create policy "first run: accept first (adding files)" on storage.objects as restrictive for insert to authenticated
  with check ((select public.has_accepted()));
create policy "first run: accept first (changing files)" on storage.objects as restrictive for update to authenticated
  using ((select public.has_accepted())) with check ((select public.has_accepted()));

-- ── Show the username (same functions as before, with the username) ─
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
    'username', (select username from public.account_identity where user_id = p_user),
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

create or replace function public.owner_users() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'owner only' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', u.id,
      'name', coalesce(i.username, left(p.display_name, 40)),
      'username', i.username,
      'accepted', i.user_id is not null and i.username is not null and i.terms_version >= public.terms_version() and i.privacy_version >= public.privacy_version(),
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
    left join public.account_identity i on i.user_id = u.id
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
      'name', coalesce(pi.username, left(p.display_name, 40)),
      'action', a.action,
      'reason', a.reason,
      'until', a.until,
      'by_name', coalesce(bi.username, left(b.display_name, 40)),
      'created_at', a.created_at
    ) order by a.created_at desc)
    from (select * from public.moderation_actions order by created_at desc limit 300) a
    left join public.profiles p on p.user_id = a.user_id
    left join public.profiles b on b.user_id = a.created_by
    left join public.account_identity pi on pi.user_id = a.user_id
    left join public.account_identity bi on bi.user_id = a.created_by
  ), '[]'::jsonb);
end $$;

create or replace function public.owner_invites() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'owner only' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', i.id,
      'note', i.note,
      'created_at', i.created_at,
      'used_at', i.used_at,
      'used_by', i.used_by,
      'used_by_name', coalesce(ui.username, left(p.display_name, 40)),
      'cancelled_at', i.cancelled_at
    ) order by i.created_at desc)
    from public.community_invites i
    left join public.profiles p on p.user_id = i.used_by
    left join public.account_identity ui on ui.user_id = i.used_by
  ), '[]'::jsonb);
end $$;

create or replace function public.owner_members() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'owner only' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', m.user_id,
      'name', coalesce(ai.username, left(p.display_name, 40)),
      'role', m.role,
      'joined_at', m.created_at,
      'invite_note', i.note
    ) order by m.created_at)
    from public.community_members m
    left join public.profiles p on p.user_id = m.user_id
    left join public.account_identity ai on ai.user_id = m.user_id
    left join public.community_invites i on i.id = m.invite_id
    where m.removed_at is null
  ), '[]'::jsonb);
end $$;

revoke execute on function public.username_status(text) from public, anon;
revoke execute on function public.has_accepted() from public, anon;
revoke execute on function public.my_gate() from public, anon;
revoke execute on function public.accept_legal(int, int) from public, anon;
revoke execute on function public.set_username(text) from public, anon;
grant execute on function public.username_status(text) to authenticated;
grant execute on function public.has_accepted() to authenticated;
grant execute on function public.my_gate() to authenticated;
grant execute on function public.accept_legal(int, int) to authenticated;
grant execute on function public.set_username(text) to authenticated;
