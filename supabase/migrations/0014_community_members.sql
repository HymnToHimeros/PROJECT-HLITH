-- PROJECT-HLITH · 0014 · community groundwork: testers and invite links (T60)
-- Same rules as 0001: this migration only adds. No delete policies: a member is removed by
-- marking them (removed_at), an invite is ended by cancelling it (cancelled_at). Only the
-- purge-accounts server function removes rows, when an account is deleted for good.
--
-- The community itself (a Discord server inside HLITH, share cards, roles, polls…) is planned,
-- not built. This is only what the owner needs to start inviting the first members:
--   * community_members: who is a tester (role 'tester'), which invite brought them, who
--     invited them. Members read their own row; the owner reads all of them.
--   * community_invites: one-time invite links. Only a hash of the secret is kept, so a link
--     can't be read back out of the database; the owner sees it once, when it's made.
--   * is_member() / is_tester(): like is_owner(). The owner counts as everything.
--   * create_invite, cancel_invite, owner_invites, owner_members, remove_member: owner only.
--   * invite_status, accept_invite: for whoever opens a link (signed in).
--   * community_home(): the Community page's data, for members only; anyone else gets an error.

-- ── Members ───────────────────────────────────────────────────────
create table public.community_members (
  user_id uuid primary key references auth.users (id),
  role text not null default 'tester' check (role in ('tester')),
  invite_id uuid,
  invited_by uuid, -- no reference: an owner's account can go without tying this up
  created_at timestamptz not null default now(),
  removed_at timestamptz
);
alter table public.community_members enable row level security;
create policy "community members: see yourself" on public.community_members for select to authenticated
  using (user_id = (select auth.uid()));
create policy "community members: owner reads" on public.community_members for select to authenticated
  using (public.is_owner());

-- ── Invites ───────────────────────────────────────────────────────
create table public.community_invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  note text not null default '' check (char_length(note) <= 120),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  used_by uuid,
  used_at timestamptz,
  cancelled_at timestamptz,
  constraint community_invites_one_end check (used_at is null or cancelled_at is null)
);
alter table public.community_invites enable row level security;
create policy "community invites: owner reads" on public.community_invites for select to authenticated
  using (public.is_owner());

-- ── Who is who ────────────────────────────────────────────────────
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_owner()
    or exists (select 1 from public.community_members where user_id = (select auth.uid()) and removed_at is null);
$$;

create or replace function public.is_tester() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_owner()
    or exists (select 1 from public.community_members where user_id = (select auth.uid()) and removed_at is null and role = 'tester');
$$;

create or replace function public.invite_hash(p_token text) returns text
language sql immutable set search_path = public as $$
  select encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
$$;

-- ── Owner: invites ────────────────────────────────────────────────
-- Makes a one-time link. The secret is returned once and never kept, only its hash.
create or replace function public.create_invite(p_note text default '') returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  secret text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  row_id uuid;
begin
  if not public.is_owner() then
    raise exception 'owner only' using errcode = '42501';
  end if;
  insert into public.community_invites (token_hash, note, created_by)
  values (public.invite_hash(secret), left(btrim(coalesce(p_note, '')), 120), auth.uid())
  returning id into row_id;
  return jsonb_build_object('id', row_id, 'token', secret);
end $$;

create or replace function public.cancel_invite(p_id uuid) returns boolean
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'owner only' using errcode = '42501';
  end if;
  update public.community_invites set cancelled_at = now()
  where id = p_id and used_at is null and cancelled_at is null;
  return found;
end $$;

-- Every invite, newest first, with who used it (their profile name) when it was used.
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
      'used_by_name', left(p.display_name, 40),
      'cancelled_at', i.cancelled_at
    ) order by i.created_at desc)
    from public.community_invites i
    left join public.profiles p on p.user_id = i.used_by
  ), '[]'::jsonb);
end $$;

-- ── Owner: members ────────────────────────────────────────────────
create or replace function public.owner_members() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'owner only' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', m.user_id,
      'name', left(p.display_name, 40),
      'role', m.role,
      'joined_at', m.created_at,
      'invite_note', i.note
    ) order by m.created_at)
    from public.community_members m
    left join public.profiles p on p.user_id = m.user_id
    left join public.community_invites i on i.id = m.invite_id
    where m.removed_at is null
  ), '[]'::jsonb);
end $$;

create or replace function public.remove_member(p_user uuid) returns boolean
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'owner only' using errcode = '42501';
  end if;
  update public.community_members set removed_at = now() where user_id = p_user and removed_at is null;
  return found;
end $$;

-- ── Whoever opens a link ──────────────────────────────────────────
-- 'open', 'used' (by someone else), 'yours' (you used it, or you're already in), 'cancelled'
-- or 'unknown'. Says nothing else about the invite (not the note, not who made it).
create or replace function public.invite_status(p_token text) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  inv public.community_invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if public.is_member() then
    return 'yours';
  end if;
  select * into inv from public.community_invites where token_hash = public.invite_hash(p_token);
  if not found then return 'unknown'; end if;
  if inv.cancelled_at is not null then return 'cancelled'; end if;
  if inv.used_at is not null then
    return case when inv.used_by = auth.uid() then 'yours' else 'used' end;
  end if;
  return 'open';
end $$;

-- Accepting makes you a tester and uses the link up. A link works once; a removed tester
-- needs a new one. Someone already in keeps the link unused.
create or replace function public.accept_invite(p_token text) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  inv public.community_invites%rowtype;
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if public.is_member() then
    return 'already';
  end if;
  select * into inv from public.community_invites where token_hash = public.invite_hash(p_token) for update;
  if not found or inv.cancelled_at is not null or inv.used_at is not null then
    raise exception 'this invite can''t be used' using errcode = '22023';
  end if;
  update public.community_invites set used_by = me, used_at = now() where id = inv.id;
  insert into public.community_members (user_id, role, invite_id, invited_by)
  values (me, 'tester', inv.id, inv.created_by)
  on conflict (user_id) do update
    set role = 'tester', invite_id = excluded.invite_id, invited_by = excluded.invited_by, created_at = now(), removed_at = null;
  return 'joined';
end $$;

-- ── The Community page ────────────────────────────────────────────
-- Members only; the page shows nothing it can't prove. members: testers in now.
create or replace function public.community_home() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  mine public.community_members%rowtype;
begin
  if not public.is_member() then
    raise exception 'members only' using errcode = '42501';
  end if;
  select * into mine from public.community_members where user_id = auth.uid() and removed_at is null;
  return jsonb_build_object(
    'members', (select count(*) from public.community_members where removed_at is null),
    'role', case when public.is_owner() then 'owner' else mine.role end,
    'joined_at', mine.created_at
  );
end $$;

revoke execute on function public.is_member() from public, anon;
revoke execute on function public.is_tester() from public, anon;
revoke execute on function public.create_invite(text) from public, anon;
revoke execute on function public.cancel_invite(uuid) from public, anon;
revoke execute on function public.owner_invites() from public, anon;
revoke execute on function public.owner_members() from public, anon;
revoke execute on function public.remove_member(uuid) from public, anon;
revoke execute on function public.invite_status(text) from public, anon;
revoke execute on function public.accept_invite(text) from public, anon;
revoke execute on function public.community_home() from public, anon;
grant execute on function public.is_member() to authenticated;
grant execute on function public.is_tester() to authenticated;
grant execute on function public.create_invite(text) to authenticated;
grant execute on function public.cancel_invite(uuid) to authenticated;
grant execute on function public.owner_invites() to authenticated;
grant execute on function public.owner_members() to authenticated;
grant execute on function public.remove_member(uuid) to authenticated;
grant execute on function public.invite_status(text) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.community_home() to authenticated;
