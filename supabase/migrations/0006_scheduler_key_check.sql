-- PROJECT-HLITH · the timer's key is checked against Vault, not the runtime's copy.
-- The cron job sends the Vault secret scheduler_key. The scheduler function used to compare
-- it with its own SUPABASE_SERVICE_ROLE_KEY, which may hold a different form of the project
-- key, so the timer was refused (401). The function now asks this function instead.
-- Missing secret or a short key = refused. Server only (service_role).
create or replace function public.scheduler_key_ok(p_key text)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(char_length(p_key) >= 32, false) and exists (
    select 1 from vault.decrypted_secrets where name = 'scheduler_key' and decrypted_secret = p_key
  );
$$;
revoke execute on function public.scheduler_key_ok(text) from public, anon, authenticated;
grant execute on function public.scheduler_key_ok(text) to service_role;
