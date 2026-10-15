-- PROJECT-HLITH · 0023 · Harden table grants on link and result tables.
-- Supabase's default grants give anon and authenticated every privilege
-- (INSERT, SELECT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES).
-- RLS blocks row-level access, but TRUNCATE ignores RLS entirely.
-- This migration revokes everything and re-grants only what each role needs.

-- ── SKPort ──────────────────────────────────────────────────────────

-- skport_links: authenticated may SELECT specific columns and UPDATE label/auto_checkin.
-- (0022 already revoked INSERT/UPDATE/SELECT but left DELETE, TRUNCATE, TRIGGER, REFERENCES.)
revoke all on public.skport_links from anon, authenticated;
grant select (id, user_id, label, skport_uid, server, nickname, auto_checkin, forgotten_at, created_at, updated_at) on public.skport_links to authenticated;
grant update (label, auto_checkin) on public.skport_links to authenticated;

-- skport_checkins: authenticated may SELECT only (server writes).
revoke all on public.skport_checkins from anon, authenticated;
grant select on public.skport_checkins to authenticated;

-- ── HoYoLAB ─────────────────────────────────────────────────────────

-- hoyolab_links: authenticated may SELECT specific columns and UPDATE label/auto_checkin/auto_redeem.
-- (0003 already revoked INSERT/UPDATE/SELECT but left DELETE, TRUNCATE, TRIGGER, REFERENCES.)
revoke all on public.hoyolab_links from anon, authenticated;
grant select (id, user_id, label, hoyolab_id, games, has_redeem_login, auto_checkin, auto_redeem, forgotten_at, created_at, updated_at) on public.hoyolab_links to authenticated;
grant update (label, auto_checkin, auto_redeem) on public.hoyolab_links to authenticated;

-- hoyolab_checkins: authenticated may SELECT only (server writes).
revoke all on public.hoyolab_checkins from anon, authenticated;
grant select on public.hoyolab_checkins to authenticated;

-- hoyolab_redemptions: authenticated may SELECT only (server writes).
revoke all on public.hoyolab_redemptions from anon, authenticated;
grant select on public.hoyolab_redemptions to authenticated;

-- hoyolab_my_codes: authenticated may SELECT and INSERT (player pastes codes).
revoke all on public.hoyolab_my_codes from anon, authenticated;
grant select, insert on public.hoyolab_my_codes to authenticated;

-- hoyolab_codes: everyone may SELECT (public code list, server writes).
revoke all on public.hoyolab_codes from anon, authenticated;
grant select on public.hoyolab_codes to anon, authenticated;
