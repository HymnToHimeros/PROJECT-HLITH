-- PROJECT-HLITH · 0003 · HoYoLAB accounts saved on HLITH's server, automatic daily
-- check-in and code redemption.
-- Same rules as 0001/0002: every user table has user_id and row-level security, no
-- delete policy, and this migration only adds.
--
-- Where the login values live: in Supabase Vault (encrypted at rest; Supabase docs,
-- https://supabase.com/docs/guides/database/vault). The tables below hold only the
-- Vault secret's id, never the value. Only the server (service role) can read a value
-- back, through hoyolab_link_secret(); the browser never can, not even its owner.
-- "Forget" never removes a row (never-wipe rule): it overwrites the secret with
-- random text, switches everything off and stamps forgotten_at.

create extension if not exists supabase_vault with schema vault;

-- ── Linked HoYoLAB accounts ───────────────────────────────────────
-- One row per HoYoLAB login a player saved ("Main", "Alt"…). `games` is what the
-- login covers, as found on HoYoLAB when it was saved:
-- [{ "gameBiz": "hkrpg_global", "uid": "700000001", "nickname": "…", "server": "Europe", "region": "prod_official_eur" }]
-- Each game's data stays in that game's own tables; this only says which login reads it.
create table public.hoyolab_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  label text not null default 'Main' check (char_length(label) between 1 and 40),
  hoyolab_id text not null,
  games jsonb not null default '[]'::jsonb,
  login_secret uuid not null,
  redeem_secret uuid,
  has_redeem_login boolean generated always as (redeem_secret is not null) stored,
  auto_checkin boolean not null default false,
  auto_redeem boolean not null default false,
  forgotten_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hoyolab_links_redeem_needs_login check (not auto_redeem or redeem_secret is not null),
  constraint hoyolab_links_forgotten_is_off check (forgotten_at is null or not (auto_checkin or auto_redeem))
);
alter table public.hoyolab_links enable row level security;
create policy "own hoyolab links: read" on public.hoyolab_links for select using (user_id = (select auth.uid()));
create policy "own hoyolab links: change" on public.hoyolab_links for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger hoyolab_links_touch before update on public.hoyolab_links for each row execute function public.touch_updated_at();
create index hoyolab_links_user on public.hoyolab_links (user_id);
-- The browser may read everything except the secret ids, and may change only the
-- label and the two switches. New rows and logins go through the server functions.
revoke insert, update, select on public.hoyolab_links from anon, authenticated;
grant select (id, user_id, label, hoyolab_id, games, has_redeem_login, auto_checkin, auto_redeem, forgotten_at, created_at, updated_at) on public.hoyolab_links to authenticated;
grant update (label, auto_checkin, auto_redeem) on public.hoyolab_links to authenticated;

-- ── Results: check-ins and code redemptions ───────────────────────
-- Written only by the server functions (service role). The player reads their own.
create table public.hoyolab_checkins (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id),
  link_id uuid not null references public.hoyolab_links (id),
  game_biz text not null,
  ran_at timestamptz not null default now(),
  started_by text not null check (started_by in ('auto', 'manual')),
  status text not null check (status in ('claimed', 'already', 'error')),
  message text,
  reward text
);
alter table public.hoyolab_checkins enable row level security;
create policy "own checkins: read" on public.hoyolab_checkins for select using (user_id = (select auth.uid()));
create index hoyolab_checkins_link on public.hoyolab_checkins (link_id, ran_at desc);

create table public.hoyolab_redemptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id),
  link_id uuid not null references public.hoyolab_links (id),
  game_biz text not null,
  game_uid text not null,
  code text not null,
  ran_at timestamptz not null default now(),
  started_by text not null check (started_by in ('auto', 'manual')),
  status text not null check (status in ('redeemed', 'already-used', 'expired', 'invalid', 'region-locked', 'level-too-low', 'cooldown', 'login', 'captcha', 'error')),
  message text
);
alter table public.hoyolab_redemptions enable row level security;
create policy "own redemptions: read" on public.hoyolab_redemptions for select using (user_id = (select auth.uid()));
create index hoyolab_redemptions_link on public.hoyolab_redemptions (link_id, ran_at desc);

-- Codes a player pasted themselves. Tried for every saved account of theirs that has
-- automatic codes on, on the next run.
create table public.hoyolab_my_codes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id),
  game_biz text not null check (game_biz in ('hkrpg_global', 'nap_global')),
  code text not null check (code ~ '^[A-Z0-9]{4,30}$'),
  added_at timestamptz not null default now(),
  unique (user_id, game_biz, code)
);
alter table public.hoyolab_my_codes enable row level security;
create policy "own codes: read" on public.hoyolab_my_codes for select using (user_id = (select auth.uid()));
create policy "own codes: add" on public.hoyolab_my_codes for insert with check (user_id = (select auth.uid()));

-- Public code list, copied once a day by hoyolab-daily from the community list
-- (hoyo-codes.seria.moe, which checks each code by redeeming it on a test account).
-- Not anyone's data; readable by everyone, written only by the server.
create table public.hoyolab_codes (
  game_biz text not null,
  code text not null,
  rewards text,
  source text not null,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (game_biz, code)
);
alter table public.hoyolab_codes enable row level security;
create policy "code list: read" on public.hoyolab_codes for select using (true);

-- ── Server-only functions (service role) ──────────────────────────
-- Save a new login (p_link null) or replace the login of an existing one. The value
-- goes straight into Vault; the table keeps only the secret's id.
create or replace function public.hoyolab_link_save(p_user uuid, p_link uuid, p_label text, p_hoyolab_id text, p_games jsonb, p_login text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_secret uuid;
begin
  if p_link is null then
    v_secret := vault.create_secret(p_login, null, 'HLITH HoYoLAB login');
    insert into public.hoyolab_links (user_id, label, hoyolab_id, games, login_secret)
    values (p_user, coalesce(nullif(trim(p_label), ''), 'Main'), p_hoyolab_id, coalesce(p_games, '[]'::jsonb), v_secret)
    returning id into v_id;
  else
    select login_secret into v_secret from public.hoyolab_links where id = p_link and user_id = p_user for update;
    if v_secret is null then
      raise exception 'not found';
    end if;
    perform vault.update_secret(v_secret, p_login);
    update public.hoyolab_links
      set hoyolab_id = p_hoyolab_id, games = coalesce(p_games, games), forgotten_at = null,
          label = coalesce(nullif(trim(p_label), ''), label)
      where id = p_link;
    v_id := p_link;
  end if;
  return v_id;
end $$;

-- Add, replace or clear (p_redeem null) the separate login used for code redemption.
create or replace function public.hoyolab_link_set_redeem(p_user uuid, p_link uuid, p_redeem text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_secret uuid;
  v_found boolean;
begin
  select true, redeem_secret into v_found, v_secret from public.hoyolab_links where id = p_link and user_id = p_user and forgotten_at is null for update;
  if v_found is null then
    raise exception 'not found';
  end if;
  if p_redeem is null then
    if v_secret is not null then
      perform vault.update_secret(v_secret, 'cleared-' || gen_random_uuid()::text);
    end if;
    update public.hoyolab_links set auto_redeem = false, redeem_secret = null where id = p_link;
  elsif v_secret is null then
    update public.hoyolab_links set redeem_secret = vault.create_secret(p_redeem, null, 'HLITH HoYoLAB code login') where id = p_link;
  else
    perform vault.update_secret(v_secret, p_redeem);
  end if;
end $$;

-- Read a saved login back. Only for the server functions; never granted to the browser.
create or replace function public.hoyolab_link_secret(p_link uuid)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'user_id', l.user_id,
    'login', (select s.decrypted_secret from vault.decrypted_secrets s where s.id = l.login_secret),
    'redeem', (select s.decrypted_secret from vault.decrypted_secrets s where s.id = l.redeem_secret)
  )
  from public.hoyolab_links l
  where l.id = p_link and l.forgotten_at is null
$$;

revoke all on function public.hoyolab_link_save(uuid, uuid, text, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.hoyolab_link_set_redeem(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.hoyolab_link_secret(uuid) from public, anon, authenticated;
grant execute on function public.hoyolab_link_save(uuid, uuid, text, text, jsonb, text) to service_role;
grant execute on function public.hoyolab_link_set_redeem(uuid, uuid, text) to service_role;
grant execute on function public.hoyolab_link_secret(uuid) to service_role;

-- ── Forget (the player, from the browser) ─────────────────────────
-- Overwrites both saved values with random text, switches automatic check-in and
-- codes off, and stamps forgotten_at. The row and its results stay (never-wipe);
-- the login can't be read or used again. Only the row's owner can do it.
create or replace function public.hoyolab_link_forget(p_link uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_login uuid;
  v_redeem uuid;
begin
  select login_secret, redeem_secret into v_login, v_redeem from public.hoyolab_links where id = p_link and user_id = (select auth.uid()) for update;
  if v_login is null then
    raise exception 'not found';
  end if;
  perform vault.update_secret(v_login, 'forgotten-' || gen_random_uuid()::text);
  if v_redeem is not null then
    perform vault.update_secret(v_redeem, 'forgotten-' || gen_random_uuid()::text);
  end if;
  update public.hoyolab_links set auto_checkin = false, auto_redeem = false, forgotten_at = now() where id = p_link;
end $$;

revoke all on function public.hoyolab_link_forget(uuid) from public, anon;
grant execute on function public.hoyolab_link_forget(uuid) to authenticated;
