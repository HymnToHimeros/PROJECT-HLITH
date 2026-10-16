-- PROJECT-HLITH · 0026 · fix pull_numbers to respect per-banner-type rules
-- (matches client-side luckOf from pity.ts).
-- Two fixes:
--   1. guarantee-after-loss is not always true (Endfield: false)
--   2. standard banners have no featured split, so nothing on them is a 50/50
-- The rules are built from the game contracts, not from user data.
-- A test (tests/bannerTypeRules.test.ts) checks that these match bannerRulesOf(game).
-- Unknown banner types fall back to the previous behaviour (guarantee true,
-- featured true) so nothing regresses if a new game adds types before the SQL.

-- Per-banner-type rules, matching bannerRulesOf() in pity.ts.
-- guarantee = whether a lost 50/50 guarantees the next one
-- featured  = whether the banner has a featured split at all
create or replace function public.banner_type_rules(bt text)
returns table (guarantee boolean, featured boolean)
language sql immutable set search_path = public as $$
  select
    case
      -- Endfield: 50/50 banners do NOT guarantee after a loss
      when bt in ('chartered', 'rerun', 'weapon') then false
      -- ZZZ and HSR featured banners guarantee after a loss
      when bt in ('exclusive', 'w-engine', 'character', 'light-cone') then true
      -- Default for unknown types: previous behaviour
      else true
    end as guarantee,
    case
      -- Standard/permanent banners have no featured split
      when bt in ('standard', 'bangboo', 'departure', 'collab-character',
                  'collab-light-cone', 'joint', 'basic', 'beginner', 'limited') then false
      -- Featured banners
      when bt in ('exclusive', 'w-engine', 'character', 'light-cone',
                  'chartered', 'rerun', 'weapon') then true
      -- Default for unknown types: previous behaviour
      else true
    end as featured;
$$;

create or replace function public.pull_numbers(p jsonb) returns jsonb
language plpgsql immutable set search_path = public as $$
declare
  bt text;
  r jsonb;
  since int;
  counting boolean;
  guaranteed boolean;
  guarantee_after_loss boolean;
  has_featured boolean;
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
    select btr.guarantee, btr.featured into guarantee_after_loss, has_featured
      from public.banner_type_rules(bt) btr;
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
      if not has_featured then
        continue;
      end if;
      if guaranteed then
        guaranteed := false;
      elsif r -> 'featured' = 'true'::jsonb then
        won := won + 1;
      elsif r -> 'featured' = 'false'::jsonb then
        lost := lost + 1;
        guaranteed := guarantee_after_loss;
      end if;
    end loop;
  end loop;
  return jsonb_build_object('total', jsonb_array_length(p), 'tops', tops, 'avg', case when tops > 0 then round(gap_sum::numeric / tops, 2) end, 'won', won, 'lost', lost, 'luckiest', best);
end $$;

-- Revoke: only profile_card calls it, nobody directly.
revoke execute on function public.banner_type_rules(text) from public, anon, authenticated;
revoke execute on function public.pull_numbers(jsonb) from public, anon, authenticated;

-- profile_card is NOT re-created here: 0019_rewards.sql is the live
-- definition (it includes the T67 rewards block). Replacing pull_numbers
-- above is enough — profile_card already calls it with one argument.