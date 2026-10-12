-- PROJECT-HLITH · 0017 · the owner's look on the profile card (T64)
-- Same rules as 0001: this migration only adds.
--
-- The owner picked owner-only badges, picture frames and name styles (option sheets in
-- docs/owner-reports/2026-10-11/). The app keeps the choice with the card's look
-- (profiles.showcase -> look -> owner_style: badge 0–8, frame 1–20, name 1–20, and which of
-- a set's variants: frameVariant / nameVariant 0–4).
--   * profile_card() now also returns owner_style on the owner's card (and only the owner's:
--     nobody else can claim the owner's look, whatever their own row says). Everyone who can
--     open the owner's card sees it. Everything else is as in 0016.

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
  -- The owner's look: only for the owner, only whole numbers (the app checks the ranges too).
  os := case when owner and jsonb_typeof(look -> 'owner_style') = 'object' then look -> 'owner_style' end;

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
    'owner_style', case when os is not null then jsonb_strip_nulls(jsonb_build_object(
      'badge', case when jsonb_typeof(os -> 'badge') = 'number' then os -> 'badge' end,
      'frame', case when jsonb_typeof(os -> 'frame') = 'number' then os -> 'frame' end,
      'name', case when jsonb_typeof(os -> 'name') = 'number' then os -> 'name' end,
      'frameVariant', case when jsonb_typeof(os -> 'frameVariant') = 'number' then os -> 'frameVariant' end,
      'nameVariant', case when jsonb_typeof(os -> 'nameVariant') = 'number' then os -> 'nameVariant' end)) end,
    'badges', case when (priv -> 'badges') is distinct from 'false'::jsonb then to_jsonb(badges) end,
    'pinned_badge', case when (priv -> 'badges') is distinct from 'false'::jsonb then pinned end,
    'stats', case when (priv -> 'stats') is distinct from 'false'::jsonb then stats end,
    'featured', featured
  );
end $$;
