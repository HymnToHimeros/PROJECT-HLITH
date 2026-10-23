-- PROJECT-HLITH · 0027 · trusted sources for auto-approving findings
-- A finding delivered by the external routine whose source_name matches a trusted source
-- is approved automatically at delivery time (no manual decision needed). The owner manages
-- the list in Owner console → Findings. "Move back to new" still works: auto-approved findings
-- are ordinary approved findings with an extra auto_source marker.
-- Seele (Telegram) is the first trusted source: the owner trusts it for leak findings.
-- Retroactive: existing Seele findings still waiting in the inbox are approved by this migration.

-- ── Trusted sources table ─────────────────────────────────────────────
create table public.scheduler_trusted_sources (
  source_name text primary key,
  added_at timestamptz not null default now(),
  added_by uuid references auth.users (id)
);
alter table public.scheduler_trusted_sources enable row level security;
create policy "trusted sources: owner reads" on public.scheduler_trusted_sources for select to authenticated using (public.is_owner());
create policy "trusted sources: owner adds" on public.scheduler_trusted_sources for insert to authenticated with check (public.is_owner());
create policy "trusted sources: owner removes" on public.scheduler_trusted_sources for delete to authenticated using (public.is_owner());
revoke all on public.scheduler_trusted_sources from anon, authenticated;
grant select, insert, delete on public.scheduler_trusted_sources to authenticated;

-- ── Auto-source marker on findings ────────────────────────────────────
-- When a finding is auto-approved at delivery time, auto_source records the trusted source
-- name that triggered it. Null means the owner decided manually (or not yet).
alter table public.scheduler_findings add column auto_source text;

-- ── Seed: Seele (Telegram) ────────────────────────────────────────────
insert into public.scheduler_trusted_sources (source_name) values ('Seele (Telegram)');

-- ── Retroactive: approve Seele findings that are still waiting ────────
-- The owner asked for Kafka, Robin (ZZZ 3.4), Obsidian and Xuanquan (HSR) — all from Seele.
-- Rather than naming them one by one, approve every Seele finding still in status 'new'.
update public.scheduler_findings
   set status = 'approved',
       decided_at = now(),
       auto_source = 'Seele (Telegram)'
 where source_name = 'Seele (Telegram)'
   and status = 'new';

-- ── Server function: auto-approve after delivery ──────────────────────
-- Called by the findings-intake edge function after saving findings. For each finding id
-- whose source_name matches a trusted source, sets status to 'approved' with auto_source.
-- Returns the number of findings auto-approved. Only the service role calls it.
create or replace function public.findings_auto_approve(p_finding_ids uuid[])
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  approved integer;
begin
  update public.scheduler_findings f
     set status = 'approved',
         decided_at = now(),
         auto_source = ts.source_name
    from public.scheduler_trusted_sources ts
   where f.id = any(p_finding_ids)
     and f.source_name = ts.source_name
     and f.status = 'new';
  get diagnostics approved = row_count;
  return approved;
end $$;
revoke execute on function public.findings_auto_approve(uuid[]) from public, anon, authenticated;
grant execute on function public.findings_auto_approve(uuid[]) to service_role;
