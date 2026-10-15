-- PROJECT-HLITH · 0022 · SKPort accounts saved on HLITH's server, for Arknights:
-- Endfield live data (sanity/stamina, daily check-in, account level).
-- Same rules as 0003 (HoYoLAB): Vault for the token, RLS, no delete, and the
-- "forget" pattern that overwrites the secret and stamps forgotten_at.
--
-- SKPort is Gryphline's community platform (global counterpart of HyperGryph's
-- SKLand for CN). The token is the player's ACCOUNT_TOKEN from their SKPort
-- browser cookies. There is no separate code-redemption login (unlike HoYoLAB).

-- ── Linked SKPort accounts ───────────────────────────────────────
-- One row per SKPort token a player saved. `skport_uid` and `server` identify the
-- Endfield game account; `nickname` is display-only.
create table public.skport_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  label text not null default 'Main' check (char_length(label) between 1 and 40),
  skport_uid text not null,
  server text not null default '',
  nickname text not null default '',
  token_secret uuid not null,
  auto_checkin boolean not null default false,
  forgotten_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint skport_links_forgotten_is_off check (forgotten_at is null or not auto_checkin)
);
alter table public.skport_links enable row level security;
create policy "own skport links: read" on public.skport_links for select using (user_id = (select auth.uid()));
create policy "own skport links: change" on public.skport_links for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger skport_links_touch before update on public.skport_links for each row execute function public.touch_updated_at();
create index skport_links_user on public.skport_links (user_id);

-- The browser may read everything except the secret id, and may change only the
-- label and auto_checkin. New rows and tokens go through the server functions.
revoke insert, update, select on public.skport_links from anon, authenticated;
grant select (id, user_id, label, skport_uid, server, nickname, auto_checkin, forgotten_at, created_at, updated_at) on public.skport_links to authenticated;
grant update (label, auto_checkin) on public.skport_links to authenticated;

-- ── Check-in results ─────────────────────────────────────────────
-- Written only by the server (service role). The player reads their own.
create table public.skport_checkins (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id),
  link_id uuid not null references public.skport_links (id),
  ran_at timestamptz not null default now(),
  started_by text not null check (started_by in ('auto', 'manual')),
  status text not null check (status in ('claimed', 'already', 'error')),
  message text
);
alter table public.skport_checkins enable row level security;
create policy "own skport checkins: read" on public.skport_checkins for select using (user_id = (select auth.uid()));
create index skport_checkins_link on public.skport_checkins (link_id, ran_at desc);

-- ── Server-only functions (service role) ──────────────────────────
-- Save a new token (p_link null) or replace the token of an existing link.
create or replace function public.skport_link_save(
  p_user uuid, p_link uuid, p_label text, p_skport_uid text, p_server text, p_nickname text, p_token text
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_secret uuid;
begin
  if p_link is null then
    v_secret := vault.create_secret(p_token, null, 'HLITH SKPort token');
    insert into public.skport_links (user_id, label, skport_uid, server, nickname, token_secret)
    values (p_user, coalesce(nullif(trim(p_label), ''), 'Main'), p_skport_uid, coalesce(p_server, ''), coalesce(p_nickname, ''), v_secret)
    returning id into v_id;
  else
    select token_secret into v_secret from public.skport_links where id = p_link and user_id = p_user for update;
    if v_secret is null then
      raise exception 'not found';
    end if;
    perform vault.update_secret(v_secret, p_token);
    update public.skport_links
      set skport_uid = p_skport_uid, server = coalesce(p_server, server), nickname = coalesce(p_nickname, nickname),
          forgotten_at = null, label = coalesce(nullif(trim(p_label), ''), label)
      where id = p_link;
    v_id := p_link;
  end if;
  return v_id;
end $$;

-- Read a saved token back. Only for the server functions; never granted to the browser.
create or replace function public.skport_link_secret(p_link uuid)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'user_id', l.user_id,
    'token', (select s.decrypted_secret from vault.decrypted_secrets s where s.id = l.token_secret)
  )
  from public.skport_links l
  where l.id = p_link and l.forgotten_at is null
$$;

-- Forget: overwrites the saved token with random text, turns auto_checkin off, stamps
-- forgotten_at. The row stays (never-wipe rule); the token can't be read or used again.
create or replace function public.skport_link_forget(p_link uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_secret uuid;
begin
  select token_secret into v_secret from public.skport_links where id = p_link and user_id = (select auth.uid()) for update;
  if v_secret is null then
    raise exception 'not found';
  end if;
  perform vault.update_secret(v_secret, 'forgotten-' || gen_random_uuid()::text);
  update public.skport_links set auto_checkin = false, forgotten_at = now() where id = p_link;
end $$;

-- ── Gate + ban (matching 0015/0016 pattern) ──────────────────────
-- Ban: a banned account may not read any of this.
create policy "banned: no reading" on public.skport_links as restrictive for select to authenticated using (not (select public.is_banned()));
create policy "banned: no reading" on public.skport_checkins as restrictive for select to authenticated using (not (select public.is_banned()));
-- Gate: no writes until the player has accepted terms and set a username.
create policy "first run: accept first (changing)" on public.skport_links as restrictive for update to authenticated using ((select public.has_accepted())) with check ((select public.has_accepted()));

-- Purge: overwrites every saved token for a user (used during account deletion).
create or replace function public.skport_links_purge(p_user uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  l record;
begin
  for l in select token_secret from public.skport_links where user_id = p_user loop
    perform vault.update_secret(l.token_secret, 'purged-' || gen_random_uuid()::text);
  end loop;
end $$;

revoke all on function public.skport_links_purge(uuid) from public, anon, authenticated;
grant execute on function public.skport_links_purge(uuid) to service_role;

revoke all on function public.skport_link_save(uuid, uuid, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.skport_link_secret(uuid) from public, anon, authenticated;
revoke all on function public.skport_link_forget(uuid) from public, anon, authenticated;
grant execute on function public.skport_link_save(uuid, uuid, text, text, text, text, text) to service_role;
grant execute on function public.skport_link_secret(uuid) to service_role;
grant execute on function public.skport_link_forget(uuid) to authenticated;
