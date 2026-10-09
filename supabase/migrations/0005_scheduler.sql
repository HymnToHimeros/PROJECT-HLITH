-- PROJECT-HLITH · 0005 · the scheduler (one cron job runs every scheduled job)
-- Two runners share these tables: the Supabase scheduler (fixed jobs such as backup and
-- hoyolab-daily) and an external routine (the "find new info" jobs), which delivers its
-- findings to the findings-intake function with its own narrow key (docs/ROUTINES.md).
-- Same rules as 0001: this migration only adds.
--   * scheduler_jobs: one row per job in supabase/functions/_shared/jobs.ts. The scheduler
--     adds missing rows itself; the owner can switch a job off or change its cadence.
--   * scheduler_runs: append-only log of every run (no change, no removal, even by the server).
--   * scheduler_findings: the owner's inbox of what jobs found. Dismiss is a status, never a removal.
-- Owner-only read and change (public.is_owner() from 0001). Only the server (service role,
-- which skips row-level security) adds rows. No delete policies anywhere.

-- ── Jobs ───────────────────────────────────────────────────────────
create table public.scheduler_jobs (
  id text primary key,
  enabled boolean not null default true,
  cadence text, -- owner's override, e.g. 'mon,wed,fri 06:00'; null = the default in jobs.ts
  last_run_at timestamptz, -- when the job last started (external routine: last delivery)
  last_status text check (last_status in ('ok', 'error', 'skipped', 'frame')),
  last_message text,
  next_due_at timestamptz,
  lock_until timestamptz, -- a run holds the job until then; an expired lock is free
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.scheduler_jobs enable row level security;
create policy "scheduler jobs: owner reads" on public.scheduler_jobs for select to authenticated using (public.is_owner());
create policy "scheduler jobs: owner changes" on public.scheduler_jobs for update to authenticated using (public.is_owner()) with check (public.is_owner());
create trigger scheduler_jobs_touch before update on public.scheduler_jobs for each row execute function public.touch_updated_at();
-- The owner may change only the switch and the cadence; run results come from the server.
revoke insert, update on public.scheduler_jobs from anon, authenticated;
grant update (enabled, cadence) on public.scheduler_jobs to authenticated;

-- ── Runs (append-only) ─────────────────────────────────────────────
create table public.scheduler_runs (
  id bigint generated always as identity primary key,
  job_id text not null references public.scheduler_jobs (id),
  started_at timestamptz not null,
  finished_at timestamptz not null,
  status text not null check (status in ('ok', 'error', 'skipped', 'frame')),
  message text not null default '',
  counts jsonb not null default '{}'::jsonb,
  started_by text not null check (started_by in ('cron', 'owner', 'routine'))
);
create index scheduler_runs_recent on public.scheduler_runs (started_at desc);
alter table public.scheduler_runs enable row level security;
create policy "scheduler runs: owner reads" on public.scheduler_runs for select to authenticated using (public.is_owner());
revoke insert, update on public.scheduler_runs from anon, authenticated;

create or replace function public.scheduler_runs_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'scheduler_runs is an append-only log';
end $$;
create trigger scheduler_runs_append_only before update or delete on public.scheduler_runs
  for each row execute function public.scheduler_runs_append_only();

-- ── Findings (the owner's inbox) ───────────────────────────────────
create table public.scheduler_findings (
  id uuid primary key default gen_random_uuid(),
  job_id text not null references public.scheduler_jobs (id),
  game_id text,
  kind text not null check (kind in ('leak', 'event', 'banner', 'character', 'info')),
  title text not null,
  payload jsonb not null default '{}'::jsonb,
  source_name text,
  source_url text,
  dedupe_key text not null, -- game|kind|source|title: delivered again by the same job within 30 days = skipped
  found_at timestamptz not null default now(), -- when the job found it
  delivered_at timestamptz not null default now(), -- when it reached the inbox
  delivered_by text not null default 'scheduler' check (delivered_by in ('scheduler', 'routine')),
  status text not null default 'new' check (status in ('new', 'approved', 'dismissed')),
  decided_by uuid, -- the owner who decided (no reference: deciding never ties up an account)
  decided_at timestamptz
);
create index scheduler_findings_inbox on public.scheduler_findings (status, delivered_at desc);
create index scheduler_findings_repeat on public.scheduler_findings (job_id, dedupe_key, delivered_at);
alter table public.scheduler_findings enable row level security;
create policy "scheduler findings: owner reads" on public.scheduler_findings for select to authenticated using (public.is_owner());
create policy "scheduler findings: owner decides" on public.scheduler_findings for update to authenticated
  using (public.is_owner())
  with check (public.is_owner() and (decided_by is null or decided_by = (select auth.uid())));
-- The owner may change only the decision; what was found stays as found.
revoke insert, update on public.scheduler_findings from anon, authenticated;
grant update (status, decided_by, decided_at) on public.scheduler_findings to authenticated;

-- ── Taking a job's lock (server only) ──────────────────────────────
-- In one statement: take the lock and mark the job started, only when the lock is free and
-- (for a scheduled run) the job has not started since its latest slot. Two runs at once can
-- therefore never both start the same job.
create or replace function public.scheduler_take_lock(p_job text, p_now timestamptz, p_until timestamptz, p_not_run_since timestamptz)
returns text
language plpgsql security definer set search_path = public as $$
declare
  got integer;
  row_lock timestamptz;
begin
  update public.scheduler_jobs
     set lock_until = p_until, last_run_at = p_now
   where id = p_job
     and (lock_until is null or lock_until < p_now)
     and (p_not_run_since is null or last_run_at is null or last_run_at < p_not_run_since);
  get diagnostics got = row_count;
  if got = 1 then
    return 'taken';
  end if;
  select lock_until into row_lock from public.scheduler_jobs where id = p_job;
  if row_lock is not null and row_lock >= p_now then
    return 'busy';
  end if;
  return 'already-ran';
end $$;
revoke execute on function public.scheduler_take_lock(text, timestamptz, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.scheduler_take_lock(text, timestamptz, timestamptz, timestamptz) to service_role;

-- ── The routine's key (server only) ────────────────────────────────
-- The external routine sends its own key (never the service key). The findings-intake
-- function asks this function whether it matches the Vault secret findings_intake_key.
-- Missing secret or a short key = refused.
create or replace function public.findings_intake_key_ok(p_key text)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(char_length(p_key) >= 32, false) and exists (
    select 1 from vault.decrypted_secrets where name = 'findings_intake_key' and decrypted_secret = p_key
  );
$$;
revoke execute on function public.findings_intake_key_ok(text) from public, anon, authenticated;
grant execute on function public.findings_intake_key_ok(text) to service_role;

-- ── The one cron job (started only by the owner) ───────────────────
-- Nothing is scheduled by this migration. The owner presses "Start timer" in the Owner
-- console, which calls scheduler_timer_start(): every 15 minutes the database then calls
-- the scheduler function with the key kept in Vault as scheduler_key (docs/SETUP.md).
-- "Stop timer" removes the timer again. Both check public.is_owner().
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create or replace function public.scheduler_timer_start() returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_owner() then raise exception 'owners only'; end if;
  perform cron.schedule(
    'hlith-scheduler',
    '*/15 * * * *',
    $cron$
    select net.http_post(
      url := 'https://qywvnvwfsknfcxgpbivo.supabase.co/functions/v1/scheduler',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'scheduler_key' limit 1)
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 10000
    );
    $cron$
  );
end;
$$;

create or replace function public.scheduler_timer_stop() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'owners only'; end if;
  perform cron.unschedule(jobid) from cron.job where jobname = 'hlith-scheduler';
end;
$$;

create or replace function public.scheduler_timer_status() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'owners only'; end if;
  return jsonb_build_object(
    'running', exists (select 1 from cron.job where jobname = 'hlith-scheduler' and active),
    'key_saved', exists (select 1 from vault.secrets where name = 'scheduler_key')
  );
end;
$$;

revoke execute on function public.scheduler_timer_start() from public, anon;
revoke execute on function public.scheduler_timer_stop() from public, anon;
revoke execute on function public.scheduler_timer_status() from public, anon;
grant execute on function public.scheduler_timer_start() to authenticated;
grant execute on function public.scheduler_timer_stop() to authenticated;
grant execute on function public.scheduler_timer_status() to authenticated;
