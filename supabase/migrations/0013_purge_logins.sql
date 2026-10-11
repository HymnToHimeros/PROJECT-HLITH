-- PROJECT-HLITH · 0013 · finishing account deletions (T11)
-- Same rules as 0001: this migration only adds.
--
-- When an account's 30-day deletion grace period is over, the purge-accounts server function
-- removes everything of it. Its saved HoYoLAB logins live in Vault, which the function can't
-- reach directly, so this overwrites each of them with random text first (the same as "Forget"
-- does for one link). The server function alone (service role) may call it.

create or replace function public.hoyolab_links_purge(p_user uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  l record;
begin
  for l in select login_secret, redeem_secret from public.hoyolab_links where user_id = p_user loop
    if l.login_secret is not null then
      perform vault.update_secret(l.login_secret, 'purged-' || gen_random_uuid()::text);
    end if;
    if l.redeem_secret is not null then
      perform vault.update_secret(l.redeem_secret, 'purged-' || gen_random_uuid()::text);
    end if;
  end loop;
end $$;

revoke all on function public.hoyolab_links_purge(uuid) from public, anon, authenticated;
grant execute on function public.hoyolab_links_purge(uuid) to service_role;
