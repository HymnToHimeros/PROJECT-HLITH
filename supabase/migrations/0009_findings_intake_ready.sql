-- PROJECT-HLITH · findings intake: say when the Vault key itself is the problem.
-- The Vault secret findings_intake_key was shorter than 32 characters, so findings_intake_key_ok
-- refused every key and every caller got 401 "Not allowed.", which looked like a wrong key.
-- The findings-intake function now asks this first and answers 500 with a plain message when
-- the secret is missing or too short. Returns only true/false, never the key. Server only.
create or replace function public.findings_intake_key_ready()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'findings_intake_key' and char_length(decrypted_secret) >= 32
  );
$$;
revoke execute on function public.findings_intake_key_ready() from public, anon, authenticated;
grant execute on function public.findings_intake_key_ready() to service_role;
