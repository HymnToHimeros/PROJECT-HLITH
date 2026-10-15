-- Security advisor clean-up (health sweep, 15 Oct). Changes who may call functions and how they
-- look up names; no table, column or row changes, nobody's data is touched.

-- 1. A fixed search_path (advisor 0011 "function search_path mutable"). Each of these only uses
--    built-in functions or names written as public.…, so an empty path changes nothing they do.
alter function public.touch_updated_at() set search_path = '';
alter function public.scheduler_runs_append_only() set search_path = '';
alter function public.terms_version() set search_path = '';
alter function public.privacy_version() set search_path = '';
alter function public.username_key(text) set search_path = '';
alter function public.username_reserved(text) set search_path = '';
alter function public.username_blocked(text) set search_path = '';

-- 2. SECURITY DEFINER functions signed-out visitors could call (advisor 0028). Every one already
--    refuses them inside ("owner only" / "sign in first"); this stops the call at the door too,
--    like 0005 and 0008 do. Signed-in users keep them, exactly as before.
revoke execute on function public.owner_reward_items() from public, anon;
revoke execute on function public.add_reward_item(text, text, text, boolean, text, date) from public, anon;
revoke execute on function public.grant_reward(uuid, text, text) from public, anon;
revoke execute on function public.revoke_reward(uuid, text) from public, anon;
revoke execute on function public.owner_reward_grants(uuid) from public, anon;
revoke execute on function public.create_reward_claim(uuid, int, timestamptz, text) from public, anon;
revoke execute on function public.cancel_reward_claim(uuid) from public, anon;
revoke execute on function public.owner_reward_claims() from public, anon;
revoke execute on function public.claim_reward(text) from public, anon;
revoke execute on function public.my_rewards() from public, anon;
revoke execute on function public.owner_theme_drafts() from public, anon;
grant execute on function public.owner_reward_items() to authenticated;
grant execute on function public.add_reward_item(text, text, text, boolean, text, date) to authenticated;
grant execute on function public.grant_reward(uuid, text, text) to authenticated;
grant execute on function public.revoke_reward(uuid, text) to authenticated;
grant execute on function public.owner_reward_grants(uuid) to authenticated;
grant execute on function public.create_reward_claim(uuid, int, timestamptz, text) to authenticated;
grant execute on function public.cancel_reward_claim(uuid) to authenticated;
grant execute on function public.owner_reward_claims() to authenticated;
grant execute on function public.claim_reward(text) to authenticated;
grant execute on function public.my_rewards() to authenticated;
grant execute on function public.owner_theme_drafts() to authenticated;

-- create_profile() runs as the trigger on new sign-ups (0001); nobody calls it directly.
revoke execute on function public.create_profile() from public, anon, authenticated;

-- public.is_owner() stays callable by everyone: row-level policies use it, and it only answers
-- true or false for the caller (tests/migrations.test.ts keeps this list).
