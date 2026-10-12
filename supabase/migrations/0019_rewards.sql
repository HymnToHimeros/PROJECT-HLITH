-- PROJECT-HLITH · 0019 · rewards: exclusive items the owner gives out (T67)
-- Same rules as 0001: this migration only adds. Nothing is ever deleted: a grant is ended by
-- revoking it (revoked_at), a claim code by cancelling it (cancelled_at). Only the
-- purge-accounts server function removes rows, when an account is deleted for good.
--
--   * reward_items: what can be given: a badge, a picture frame or a name style, with its name,
--     its picture (art: a key from the app's reward pool, always "r-<kind>-…", so the owner's
--     own badges, frames and name styles can never be given), whether it is exclusive, and an
--     optional event name and date.
--   * reward_grants: who holds what, how they got it (given directly, or by a claim code),
--     when, and when it was revoked. People read only their own; the owner reads all.
--   * reward_claims: claim codes, one-time or limited (max uses), with an optional end date.
--     Like invites, only a hash of the code is kept; the owner sees the code once.
--   * reward_log: every item added, grant, claim, revoke and claim code. owner_moderation_log()
--     now lists it together with the moderation log.
--   * Owner only: owner_reward_items, add_reward_item, grant_reward (by username),
--     revoke_reward, owner_reward_grants, create_reward_claim, cancel_reward_claim,
--     owner_reward_claims.
--   * Signed in: claim_reward(code), my_rewards(). A banned account, or one that hasn't
--     finished first run, can't claim or be given anything. A silenced account can (rewards
--     aren't community-facing), but its card shows nothing while silenced.
--   * profile_card() is 0018's, plus rewards: what they wear, only while they hold it.
--   * No table here has a write policy: only these functions write.

-- ── Items ─────────────────────────────────────────────────────────
create table public.reward_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('badge', 'frame', 'name')),
  art text not null check (art ~ '^r-(badge|frame|name)-[a-z0-9-]{1,40}$'),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  exclusive boolean not null default true,
  event_name text not null default '' check (char_length(event_name) <= 60),
  event_date date,
  created_by uuid default auth.uid(), -- no reference: the owner's account can go without tying this up
  created_at timestamptz not null default now(),
  constraint reward_items_art_kind check (split_part(art, '-', 2) = kind)
);
alter table public.reward_items enable row level security;
create policy "reward items: owner reads" on public.reward_items for select to authenticated
  using (public.is_owner());

-- ── Claim codes ───────────────────────────────────────────────────
create table public.reward_claims (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.reward_items (id),
  token_hash text not null unique,
  note text not null default '' check (char_length(note) <= 120),
  max_uses int not null default 1 check (max_uses between 1 and 10000),
  uses int not null default 0 check (uses >= 0),
  expires_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);
alter table public.reward_claims enable row level security;
create policy "reward claims: owner reads" on public.reward_claims for select to authenticated
  using (public.is_owner());

-- ── Grants ────────────────────────────────────────────────────────
create table public.reward_grants (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.reward_items (id),
  user_id uuid not null references auth.users (id),
  source text not null check (source in ('direct', 'claim')),
  claim_id uuid references public.reward_claims (id),
  granted_by uuid, -- the owner for a direct grant; nobody for a claim
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid
);
create unique index reward_grants_one_active on public.reward_grants (item_id, user_id) where revoked_at is null;
create index reward_grants_user on public.reward_grants (user_id);
alter table public.reward_grants enable row level security;
create policy "reward grants: see your own" on public.reward_grants for select to authenticated
  using (user_id = (select auth.uid()));
create policy "reward grants: owner reads" on public.reward_grants for select to authenticated
  using (public.is_owner());
create policy "banned: no reading" on public.reward_grants as restrictive for select to authenticated using (not (select public.is_banned()));
-- People read the items they hold (after reward_grants exists).
create policy "reward items: holders read" on public.reward_items for select to authenticated
  using (exists (select 1 from public.reward_grants g where g.item_id = reward_items.id and g.user_id = (select auth.uid()) and g.revoked_at is null));

-- ── Log ───────────────────────────────────────────────────────────
create table public.reward_log (
  id uuid primary key default gen_random_uuid(),
  action text not null check (action in ('reward_item', 'reward_grant', 'reward_claim', 'reward_revoke', 'reward_code', 'reward_code_cancel')),
  user_id uuid, -- whom it's about, if anyone
  item_id uuid,
  claim_id uuid,
  reason text not null default '' check (char_length(reason) <= 300),
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.reward_log enable row level security;
create policy "reward log: owner reads" on public.reward_log for select to authenticated
  using (public.is_owner());
create policy "banned: no reading" on public.reward_log as restrictive for select to authenticated using (not (select public.is_banned()));

-- ── Helpers ───────────────────────────────────────────────────────
-- A claim code as people type it: letters and digits only, capitals. "abcd-efgh" = "ABCDEFGH".
create or replace function public.reward_code_key(p_code text) returns text
language sql immutable set search_path = public as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

-- Can this account hold rewards? Not banned, and first run finished.
create or replace function public.reward_eligible(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
      select 1 from public.account_identity
      where user_id = p_user and username is not null
        and terms_version >= public.terms_version() and privacy_version >= public.privacy_version())
    and not exists (select 1 from public.account_restrictions where user_id = p_user and banned_until > now());
$$;
revoke execute on function public.reward_eligible(uuid) from public, anon, authenticated;

create or replace function public.reward_item_json(i public.reward_items) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object('id', i.id, 'kind', i.kind, 'art', i.art, 'name', i.name, 'exclusive', i.exclusive,
    'event_name', nullif(i.event_name, ''), 'event_date', i.event_date);
$$;

-- ── Owner: items ──────────────────────────────────────────────────
create or replace function public.owner_reward_items() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'owner only' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(public.reward_item_json(i) || jsonb_build_object(
      'created_at', i.created_at,
      'holders', (select count(*) from public.reward_grants g where g.item_id = i.id and g.revoked_at is null)
    ) order by i.created_at desc)
    from public.reward_items i
  ), '[]'::jsonb);
end $$;

create or replace function public.add_reward_item(p_kind text, p_art text, p_name text, p_exclusive boolean default true, p_event_name text default '', p_event_date date default null) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  row_id uuid;
begin
  if not public.is_owner() then
    raise exception 'owner only' using errcode = '42501';
  end if;
  insert into public.reward_items (kind, art, name, exclusive, event_name, event_date, created_by)
  values (p_kind, p_art, btrim(coalesce(p_name, '')), coalesce(p_exclusive, true), left(btrim(coalesce(p_event_name, '')), 60), p_event_date, auth.uid())
  returning id into row_id;
  insert into public.reward_log (action, item_id, created_by) values ('reward_item', row_id, auth.uid());
  return row_id;
end $$;

-- ── Owner: grants ─────────────────────────────────────────────────
-- 'granted' or 'already' (they hold it now). The username is matched ignoring case.
create or replace function public.grant_reward(p_item uuid, p_username text, p_reason text default '') returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  target uuid;
  row_id uuid;
begin
  if not public.is_owner() then
    raise exception 'owner only' using errcode = '42501';
  end if;
  if not exists (select 1 from public.reward_items where id = p_item) then
    raise exception 'no such item' using errcode = '22023';
  end if;
  select user_id into target from public.account_identity where lower(username) = lower(btrim(coalesce(p_username, '')));
  if target is null then
    raise exception 'no account has that username' using errcode = '22023';
  end if;
  if not public.reward_eligible(target) then
    raise exception 'that account is banned or hasn''t finished first run' using errcode = '22023';
  end if;
  if exists (select 1 from public.reward_grants where item_id = p_item and user_id = target and revoked_at is null) then
    return 'already';
  end if;
  insert into public.reward_grants (item_id, user_id, source, granted_by) values (p_item, target, 'direct', auth.uid()) returning id into row_id;
  insert into public.reward_log (action, user_id, item_id, reason, created_by) values ('reward_grant', target, p_item, left(btrim(coalesce(p_reason, '')), 300), auth.uid());
  return 'granted';
end $$;

create or replace function public.revoke_reward(p_grant uuid, p_reason text default '') returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare
  gr public.reward_grants%rowtype;
begin
  if not public.is_owner() then
    raise exception 'owner only' using errcode = '42501';
  end if;
  update public.reward_grants set revoked_at = now(), revoked_by = auth.uid()
  where id = p_grant and revoked_at is null
  returning * into gr;
  if not found then return false; end if;
  insert into public.reward_log (action, user_id, item_id, reason, created_by) values ('reward_revoke', gr.user_id, gr.item_id, left(btrim(coalesce(p_reason, '')), 300), auth.uid());
  return true;
end $$;

-- Who holds (or held) one item, newest first.
create or replace function public.owner_reward_grants(p_item uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'owner only' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', g.id,
      'user_id', g.user_id,
      'name', coalesce(ai.username, left(p.display_name, 40)),
      'source', g.source,
      'granted_at', g.granted_at,
      'revoked_at', g.revoked_at
    ) order by g.granted_at desc)
    from public.reward_grants g
    left join public.account_identity ai on ai.user_id = g.user_id
    left join public.profiles p on p.user_id = g.user_id
    where g.item_id = p_item
  ), '[]'::jsonb);
end $$;

-- ── Owner: claim codes ────────────────────────────────────────────
-- A 16-character code (no 0/O or 1/I), returned once and never kept, only its hash.
create or replace function public.create_reward_claim(p_item uuid, p_max_uses int default 1, p_expires_at timestamptz default null, p_note text default '') returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  abc constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  raw bytea := uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid());
  code text := '';
  i int;
  row_id uuid;
begin
  if not public.is_owner() then
    raise exception 'owner only' using errcode = '42501';
  end if;
  if not exists (select 1 from public.reward_items where id = p_item) then
    raise exception 'no such item' using errcode = '22023';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'the end date has already passed' using errcode = '22023';
  end if;
  -- Bytes 6 and 8 of each uuid carry its version and variant bits, so they are skipped.
  foreach i in array array[0, 1, 2, 3, 4, 5, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17] loop
    code := code || substr(abc, get_byte(raw, i) % 32 + 1, 1);
  end loop;
  insert into public.reward_claims (item_id, token_hash, note, max_uses, expires_at, created_by)
  values (p_item, public.invite_hash(code), left(btrim(coalesce(p_note, '')), 120), coalesce(p_max_uses, 1), p_expires_at, auth.uid())
  returning id into row_id;
  insert into public.reward_log (action, item_id, claim_id, created_by) values ('reward_code', p_item, row_id, auth.uid());
  return jsonb_build_object('id', row_id, 'code', code);
end $$;

create or replace function public.cancel_reward_claim(p_id uuid) returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare
  c public.reward_claims%rowtype;
begin
  if not public.is_owner() then
    raise exception 'owner only' using errcode = '42501';
  end if;
  update public.reward_claims set cancelled_at = now() where id = p_id and cancelled_at is null returning * into c;
  if not found then return false; end if;
  insert into public.reward_log (action, item_id, claim_id, created_by) values ('reward_code_cancel', c.item_id, c.id, auth.uid());
  return true;
end $$;

create or replace function public.owner_reward_claims() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'owner only' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id,
      'item_id', c.item_id,
      'note', c.note,
      'max_uses', c.max_uses,
      'uses', c.uses,
      'expires_at', c.expires_at,
      'created_at', c.created_at,
      'cancelled_at', c.cancelled_at
    ) order by c.created_at desc)
    from public.reward_claims c
  ), '[]'::jsonb);
end $$;

-- ── Signed in ─────────────────────────────────────────────────────
-- {status: 'claimed' | 'already', item}. A code that can't be used says why, nothing more.
create or replace function public.claim_reward(p_code text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  c public.reward_claims%rowtype;
  it public.reward_items%rowtype;
begin
  if me is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if public.is_banned() then
    raise exception 'this account is banned' using errcode = '42501';
  end if;
  if not public.has_accepted() then
    raise exception 'finish setting up your account first' using errcode = '42501';
  end if;
  select * into c from public.reward_claims where token_hash = public.invite_hash(public.reward_code_key(p_code)) for update;
  if not found then
    raise exception 'that code doesn''t exist' using errcode = '22023';
  end if;
  select * into it from public.reward_items where id = c.item_id;
  if exists (select 1 from public.reward_grants where item_id = c.item_id and user_id = me and revoked_at is null) then
    return jsonb_build_object('status', 'already', 'item', public.reward_item_json(it));
  end if;
  if c.cancelled_at is not null then
    raise exception 'that code was cancelled' using errcode = '22023';
  end if;
  if c.expires_at is not null and c.expires_at <= now() then
    raise exception 'that code has expired' using errcode = '22023';
  end if;
  if c.uses >= c.max_uses then
    raise exception 'that code has been used up' using errcode = '22023';
  end if;
  update public.reward_claims set uses = uses + 1 where id = c.id;
  insert into public.reward_grants (item_id, user_id, source, claim_id) values (c.item_id, me, 'claim', c.id);
  insert into public.reward_log (action, user_id, item_id, claim_id) values ('reward_claim', me, c.item_id, c.id);
  return jsonb_build_object('status', 'claimed', 'item', public.reward_item_json(it));
end $$;

-- What you hold now, newest first, with how and when you got it.
create or replace function public.my_rewards() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if public.is_banned() then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(public.reward_item_json(i) || jsonb_build_object('grant_id', g.id, 'source', g.source, 'granted_at', g.granted_at) order by g.granted_at desc)
    from public.reward_grants g
    join public.reward_items i on i.id = g.item_id
    where g.user_id = auth.uid() and g.revoked_at is null
  ), '[]'::jsonb);
end $$;

-- ── The owner's log: moderation and rewards together ──────────────
create or replace function public.owner_moderation_log() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'owner only' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(entry order by (entry ->> 'created_at')::timestamptz desc)
    from (
      select jsonb_build_object(
        'id', a.id,
        'user_id', a.user_id,
        'name', coalesce(pi.username, left(p.display_name, 40)),
        'action', a.action,
        'reason', a.reason,
        'until', a.until,
        'by_name', coalesce(bi.username, left(b.display_name, 40)),
        'created_at', a.created_at
      ) as entry
      from (select * from public.moderation_actions order by created_at desc limit 300) a
      left join public.profiles p on p.user_id = a.user_id
      left join public.profiles b on b.user_id = a.created_by
      left join public.account_identity pi on pi.user_id = a.user_id
      left join public.account_identity bi on bi.user_id = a.created_by
      union all
      select jsonb_build_object(
        'id', l.id,
        'user_id', l.user_id,
        'name', coalesce(pi.username, left(p.display_name, 40)),
        'action', l.action,
        'reason', l.reason,
        'until', null,
        'by_name', coalesce(bi.username, left(b.display_name, 40)),
        'created_at', l.created_at,
        'item', i.name
      )
      from (select * from public.reward_log order by created_at desc limit 300) l
      left join public.reward_items i on i.id = l.item_id
      left join public.profiles p on p.user_id = l.user_id
      left join public.profiles b on b.user_id = l.created_by
      left join public.account_identity pi on pi.user_id = l.user_id
      left join public.account_identity bi on bi.user_id = l.created_by
    ) both_logs
  ), '[]'::jsonb);
end $$;

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
  rewards jsonb := '{}'::jsonb;
  k text;
  rid text;
  ritem jsonb;
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

  -- T67: rewards they wear, only while they still hold them (an active grant). The badge
  -- follows the badges switch. A silenced or banned account shows no card at all (above).
  if jsonb_typeof(look -> 'rewards') = 'object' then
    foreach k in array array['badge', 'frame', 'name'] loop
      rid := look -> 'rewards' ->> k;
      continue when rid is null or rid !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
      continue when k = 'badge' and (priv -> 'badges') = 'false'::jsonb;
      select jsonb_build_object('id', i.id, 'kind', i.kind, 'art', i.art, 'name', i.name, 'exclusive', i.exclusive, 'event_name', nullif(i.event_name, ''), 'event_date', i.event_date)
        into ritem
        from public.reward_items i
        join public.reward_grants gr on gr.item_id = i.id and gr.user_id = p_user and gr.revoked_at is null
        where i.id = rid::uuid and i.kind = k
        limit 1;
      if ritem is not null then rewards := rewards || jsonb_build_object(k, ritem); end if;
      ritem := null;
    end loop;
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
    'featured', featured,
    'rewards', rewards
  );
end $$;
