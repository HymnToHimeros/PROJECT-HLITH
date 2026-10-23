-- PROJECT-HLITH · 0028 · auto-approve all findings + topic column
-- JOB A: every finding the routine delivers is approved automatically at arrival.
-- The owner never has to decide; the Findings screen becomes a read-only log.
-- The routine can correct itself by sending decisions (dismiss wrong ones, undo
-- the Intel note and list item that the approval added).
-- JOB B: each finding carries a topic so Intel can group them into tabs.

-- ── Topic column ─────────────────────────────────────────────────────
alter table public.scheduler_findings add column topic text;

-- ── findings_auto_approve: approve ALL findings, not just trusted-source leaks ──
-- Replaces the 0027 version that joined scheduler_trusted_sources and filtered kind = 'leak'.
-- Now every finding id in the array is approved unconditionally (the routine already
-- vetted them). auto_source marks them as automatically approved.
create or replace function public.findings_auto_approve(p_finding_ids uuid[])
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  approved integer;
begin
  update public.scheduler_findings
     set status = 'approved',
         decided_at = now(),
         auto_source = 'auto'
   where id = any(p_finding_ids)
     and status = 'new';
  get diagnostics approved = row_count;
  return approved;
end $$;
-- Grants unchanged from 0027: only service_role calls it.

-- ── findings_decide: the routine corrects itself ─────────────────────
-- Accepts a JSON array of { id, status, reason? }. When dismissing a previously
-- approved finding, retires the catalog rows it added (Intel note + list item).
-- Returns the number of findings whose status actually changed.
create or replace function public.findings_decide(p_decisions jsonb)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  decided integer := 0;
  d jsonb;
  fid uuid;
  old_status text;
  new_status text;
begin
  for d in select jsonb_array_elements from jsonb_array_elements(p_decisions)
  loop
    fid := (d->>'id')::uuid;
    new_status := d->>'status';
    if new_status is null or new_status not in ('approved', 'dismissed') then continue; end if;

    select status into old_status from public.scheduler_findings where id = fid;
    if not found or old_status = new_status then continue; end if;

    update public.scheduler_findings
       set status = new_status,
           decided_at = now(),
           auto_source = coalesce(nullif(d->>'reason', ''), 'routine')
     where id = fid;

    if old_status = 'approved' and new_status = 'dismissed' then
      update public.catalog_items
         set status = 'retired'
       where source = 'finding:' || fid::text
         and status = 'active';
    end if;

    decided := decided + 1;
  end loop;
  return decided;
end $$;
revoke execute on function public.findings_decide(jsonb) from public, anon, authenticated;
grant execute on function public.findings_decide(jsonb) to service_role;
