-- PROJECT-HLITH · 0018 · more on the profile card: pull numbers, luckiest pull, best team,
-- badge shelf (T64 B2)
-- Same rules as 0001: this migration only adds.
--
-- profile_card() is 0017's, plus (each only when the person allows that part):
--   * stats: average pulls per top result and the 50/50 record per game (switch: pull numbers);
--   * luckiest: the luckiest provable top result from imported history (switch: luckiest pull);
--   * best_team: one saved team that still exists (switch: showcase);
--   * shelf: up to 3 more badges, only ones the server can see they hold (switch: badges);
--   * earned_title: a title that comes with a badge, only while they hold that badge;
--   * bio (switch: bio, off unless switched on), fav_game and card_background (a theme's art);
--   * the typed title and the bio never show with a blocked word (the username list, word by
--     word: text_blocked()).
-- pull_numbers() does the counting; only profile_card() uses it (nobody can call it directly).
-- While an account is silenced, what others see on its profile can't change: the name, bio,
-- pictures and the card's look and showcase stay as they were (profiles_silence_guard).

-- Pull numbers from one game's imported pulls (same rules as src/tools/account/cardExtras.ts
-- and the Luck report): average pulls per top result, the 50/50 record (a guaranteed result is
-- not a 50/50), and the luckiest provable top result (the count before the first top result in
-- the history may have started on pulls never imported, so it is left out).
create or replace function public.pull_numbers(p jsonb) returns jsonb
language plpgsql immutable set search_path = public as $$
declare
  bt text;
  r jsonb;
  since int;
  counting boolean;
  guaranteed boolean;
  tops int := 0;
  gap_sum int := 0;
  won int := 0;
  lost int := 0;
  best jsonb;
begin
  if jsonb_typeof(p) is distinct from 'array' then
    return null;
  end if;
  for bt in select distinct e ->> 'bannerType' from jsonb_array_elements(p) e loop
    since := 0;
    counting := false;
    guaranteed := false;
    for r in select e from jsonb_array_elements(p) e where e ->> 'bannerType' is not distinct from bt order by e ->> 'time', e ->> 'id' loop
      since := since + 1;
      continue when r ->> 'rarity' is distinct from 'top';
      tops := tops + 1;
      gap_sum := gap_sum + since;
      if counting and (best is null or since < (best ->> 'pulls')::int or (since = (best ->> 'pulls')::int and r ->> 'time' < best ->> 'time')) then
        best := jsonb_build_object('item_id', left(r ->> 'itemId', 60), 'name', left(r ->> 'name', 60), 'banner_type', left(bt, 40), 'pulls', since, 'time', r ->> 'time');
      end if;
      counting := true;
      since := 0;
      if guaranteed then
        guaranteed := false;
      elsif r -> 'featured' = 'true'::jsonb then
        won := won + 1;
      elsif r -> 'featured' = 'false'::jsonb then
        lost := lost + 1;
        guaranteed := true;
      end if;
    end loop;
  end loop;
  return jsonb_build_object('total', jsonb_array_length(p), 'tops', tops, 'avg', case when tops > 0 then round(gap_sum::numeric / tops, 2) end, 'won', won, 'lost', lost, 'luckiest', best);
end $$;
revoke execute on function public.pull_numbers(jsonb) from public, anon, authenticated;

-- The username slur list, for free text, word by word (src/core/auth/username.ts textBlocked).
create or replace function public.text_blocked(p text) returns boolean
language sql immutable set search_path = public as $$
  select exists (select 1 from regexp_split_to_table(coalesce(p, ''), '\s+') w where w <> '' and public.username_blocked(w));
$$;
revoke execute on function public.text_blocked(text) from public, anon;
grant execute on function public.text_blocked(text) to authenticated;

-- Silenced: what others see stays as it was. Private parts (pinned characters, hidden cards,
-- privacy switches) still change.
create or replace function public.profiles_silence_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.user_id = (select auth.uid()) and public.is_silenced() then
    new.display_name := old.display_name;
    new.bio := old.bio;
    new.avatar_path := old.avatar_path;
    new.banner_path := old.banner_path;
    new.showcase := coalesce(new.showcase, '{}'::jsonb) - 'look' - 'featured'
      || jsonb_strip_nulls(jsonb_build_object('look', old.showcase -> 'look', 'featured', old.showcase -> 'featured'));
  end if;
  return new;
end $$;
revoke execute on function public.profiles_silence_guard() from public, anon, authenticated;
create trigger profiles_silence_guard before update on public.profiles for each row execute function public.profiles_silence_guard();

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
  os jsonb;
  nums jsonb;
  luckiest jsonb;
  best_team jsonb;
  shelf jsonb := '[]'::jsonb;
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
      nums := public.pull_numbers(pulls);
      stats := stats || jsonb_build_array(jsonb_build_object('game', g, 'total', n, 'tops', t, 'average_pity', nums -> 'avg', 'won', nums -> 'won', 'lost', nums -> 'lost'));
      -- The luckiest pull across games: fewest pulls, then earliest.
      if nums -> 'luckiest' <> 'null'::jsonb and (luckiest is null
          or (nums -> 'luckiest' ->> 'pulls')::int < (luckiest ->> 'pulls')::int
          or ((nums -> 'luckiest' ->> 'pulls')::int = (luckiest ->> 'pulls')::int and nums -> 'luckiest' ->> 'time' < luckiest ->> 'time')) then
        luckiest := (nums -> 'luckiest') || jsonb_build_object('game', g);
      end if;
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

  -- T64 B2: the best team (a saved team that still exists) and the badge shelf (held badges only).
  if (priv -> 'showcase') is distinct from 'false'::jsonb and jsonb_typeof(look -> 'best_team') = 'object' then
    gd := games -> (look -> 'best_team' ->> 'game');
    if gd is not null and jsonb_typeof(gd) = 'object' and jsonb_typeof(gd -> 'teams') = 'array' then
      select value into team from jsonb_array_elements(gd -> 'teams') where value ->> 'id' = look -> 'best_team' ->> 'id' limit 1;
      if team is not null then
        best_team := jsonb_build_object('game', look -> 'best_team' ->> 'game', 'id', team ->> 'id', 'name', left(coalesce(team ->> 'name', ''), 60), 'members', coalesce(team -> 'members', '[]'::jsonb));
      end if;
    end if;
  end if;
  if jsonb_typeof(look -> 'pinned_shelf') = 'array' then
    select coalesce(jsonb_agg(b), '[]'::jsonb) into shelf from (
      select value #>> '{}' as b from jsonb_array_elements(look -> 'pinned_shelf') where jsonb_typeof(value) = 'string' limit 3
    ) s where b = any (badges);
  end if;

  pinned := look ->> 'pinned_badge';
  if pinned is not null and not (pinned = any (badges)) then pinned := null; end if;
  frame := look ->> 'frame';
  if frame = 'sky' and not owner then frame := 'none'; end if;
  -- The owner's look: only for the owner, only whole numbers (the app checks the ranges too).
  os := case when owner and jsonb_typeof(look -> 'owner_style') = 'object' then look -> 'owner_style' end;

  return jsonb_build_object(
    'display_name', case when not public.text_blocked(prof.display_name) then left(prof.display_name, 40) end,
    'username', (select username from public.account_identity where user_id = p_user),
    'avatar_path', prof.avatar_path,
    'banner_path', prof.banner_path,
    'title', case when not public.text_blocked(look ->> 'title') then left(look ->> 'title', 60) end,
    'earned_title', case when look ->> 'title_badge' = any (badges) then look ->> 'title_badge' end,
    'bio', case when (priv -> 'bio') = 'true'::jsonb and not public.text_blocked(prof.bio) then left(prof.bio, 200) end,
    'fav_game', case when look ->> 'fav_game' ~ '^[a-z0-9-]{1,32}$' then look ->> 'fav_game' end,
    'card_background', case when look ->> 'card_background' ~ '^[a-z-]{1,32}$' then look ->> 'card_background' end,
    'frame', frame,
    'name_color', look ->> 'name_color',
    'avatar_char', look -> 'avatar_char',
    'banner_char', look -> 'banner_char',
    'owner', owner,
    'owner_title', case when owner then look ->> 'owner_title' end,
    'owner_style', case when os is not null then jsonb_strip_nulls(jsonb_build_object(
      'badge', case when jsonb_typeof(os -> 'badge') = 'number' then os -> 'badge' end,
      'frame', case when jsonb_typeof(os -> 'frame') = 'number' then os -> 'frame' end,
      'name', case when jsonb_typeof(os -> 'name') = 'number' then os -> 'name' end,
      'frameVariant', case when jsonb_typeof(os -> 'frameVariant') = 'number' then os -> 'frameVariant' end,
      'nameVariant', case when jsonb_typeof(os -> 'nameVariant') = 'number' then os -> 'nameVariant' end)) end,
    'badges', case when (priv -> 'badges') is distinct from 'false'::jsonb then to_jsonb(badges) end,
    'pinned_badge', case when (priv -> 'badges') is distinct from 'false'::jsonb then pinned end,
    'stats', case when (priv -> 'stats') is distinct from 'false'::jsonb then stats end,
    'shelf', case when (priv -> 'badges') is distinct from 'false'::jsonb then shelf end,
    'best_team', best_team,
    'luckiest', case when (priv -> 'luck') is distinct from 'false'::jsonb then luckiest end,
    'featured', featured
  );
end $$;
