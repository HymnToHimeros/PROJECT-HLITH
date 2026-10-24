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
  old_topic text;
  new_status text;
  new_topic text;
  changed boolean;
  approve_ids uuid[] := '{}';
begin
  for d in select jsonb_array_elements from jsonb_array_elements(p_decisions)
  loop
    fid := (d->>'id')::uuid;
    new_status := d->>'status';
    new_topic := d->>'topic';
    if new_status is null or new_status not in ('approved', 'dismissed') then continue; end if;

    select status, topic into old_status, old_topic from public.scheduler_findings where id = fid;
    if not found then continue; end if;

    changed := false;

    if old_status <> new_status then
      update public.scheduler_findings
         set status = new_status,
             decided_at = now(),
             auto_source = coalesce(nullif(d->>'reason', ''), 'routine'),
             topic = coalesce(new_topic, topic)
       where id = fid;
      changed := true;

      if new_topic is not null then
        update public.catalog_items
           set data = jsonb_set(data, '{topic}', to_jsonb(new_topic))
         where source = 'finding:' || fid::text
           and status = 'active';
      end if;

      if old_status = 'approved' and new_status = 'dismissed' then
        update public.catalog_items
           set status = 'retired'
         where source = 'finding:' || fid::text
           and status = 'active';
      end if;

      if new_status = 'approved' then
        approve_ids := approve_ids || fid;
      end if;

    elsif new_topic is not null and new_topic is distinct from old_topic then
      update public.scheduler_findings set topic = new_topic where id = fid;
      update public.catalog_items
         set data = jsonb_set(data, '{topic}', to_jsonb(new_topic))
       where source = 'finding:' || fid::text
         and status = 'active';
      changed := true;
    end if;

    if changed then decided := decided + 1; end if;
  end loop;

  if array_length(approve_ids, 1) > 0 then
    perform public.findings_create_notes(approve_ids);
  end if;

  return decided;
end $$;
revoke execute on function public.findings_decide(jsonb) from public, anon, authenticated;
grant execute on function public.findings_decide(jsonb) to service_role;

-- ── findings_create_notes: server-side Intel note creation ──────────
-- After auto-approve, creates a catalog_items row (kind='leak') for each
-- finding that names a game. The browser backfill in schedulerData.ts stays
-- as a safety net, but this is the primary path: Intel fills even when the
-- owner never opens the console.
create or replace function public.findings_create_notes(p_finding_ids uuid[])
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  created integer := 0;
  f record;
  note_id text;
  note_data jsonb;
  src text;
  post jsonb;
  post_text text;
  post_url text;
  post_at text;
  post_translation text;
  post_images jsonb;
  evt_title text;
  evt_start text;
  evt_end text;
  evt_line text;
  topic_val text;
  valid_topics text[] := array['characters','story','weapons-items','events-modes','systems','codes','other'];
  kind_topic_map jsonb := '{"character":"characters","event":"events-modes","banner":"events-modes","leak":"other","info":"other"}'::jsonb;
begin
  for f in
    select id, game_id, kind, topic, title, payload, source_name, found_at
      from public.scheduler_findings
     where id = any(p_finding_ids)
       and game_id is not null
  loop
    src := 'finding:' || f.id::text;
    -- Skip if a note already exists for this finding.
    if exists (select 1 from public.catalog_items where source = src and kind = 'leak') then
      continue;
    end if;

    note_id := 'note-' || lower(regexp_replace(f.id::text, '[^a-z0-9-]+', '-', 'g'));

    -- Resolve topic: use finding's topic if valid, else map from kind.
    if f.topic is not null and f.topic = any(valid_topics) then
      topic_val := f.topic;
    else
      topic_val := coalesce(kind_topic_map ->> f.kind, 'other');
    end if;

    -- Extract post from payload (payload.post).
    post := f.payload -> 'post';
    post_text := null; post_url := null; post_at := null; post_translation := null;
    post_images := '[]'::jsonb;
    if post is not null and jsonb_typeof(post) = 'object' then
      post_text := nullif(trim(post ->> 'text'), '');
      post_url := nullif(trim(post ->> 'url'), '');
      post_at := nullif(trim(post ->> 'at'), '');
      post_translation := nullif(trim(post ->> 'translation'), '');
      if post -> 'images' is not null and jsonb_typeof(post -> 'images') = 'array' then
        post_images := post -> 'images';
      end if;
    end if;

    -- Build event line if no post and payload has event-like data.
    -- Matches browser eventFromInfo: kind='info', not a leak, title or payload dates.
    evt_title := null; evt_start := null; evt_end := null; evt_line := null;
    if post_text is null and f.kind = 'info' and f.payload ->> 'leak' <> 'true' then
      evt_title := nullif(trim(f.payload ->> 'title'), '');
      evt_start := nullif(trim(f.payload ->> 'start'), '');
      evt_end := nullif(trim(f.payload ->> 'end'), '');
      if evt_title is null or (evt_start is null and evt_end is null) then
        -- Parse from title: "ZZZ: new event Name (2026-10-13 → 2026-10-18)"
        declare
          m text[];
        begin
          m := regexp_match(f.title, 'new event\s*:?\s*(.+?)\s*\((\d{4}-\d{2}-\d{2})\s*(?:→|->|–|-|to)\s*(\d{4}-\d{2}-\d{2})\)\s*$', 'i');
          if m is not null and trim(m[1]) <> '' then
            evt_title := trim(m[1]);
            evt_start := m[2] || 'T00:00:00.000Z';
            evt_end := m[3] || 'T00:00:00.000Z';
          end if;
        end;
      end if;
      if evt_start is not null or evt_end is not null then
        evt_line := coalesce(left(evt_start, 10), '?') || ' → ' || coalesce(left(evt_end, 10), '?');
      end if;
    end if;

    -- Clean title: strip "Leak (Source): " prefix (matches browser cleanTitle).
    -- For events parsed from the title, use the event name instead.
    declare
      clean_title text;
      inserted_count integer;
    begin
      if evt_title is not null then
        clean_title := evt_title;
      else
        clean_title := regexp_replace(f.title, '^[Ll]eak\s*(\([^)]*\))?\s*:\s*', '');
        clean_title := trim(clean_title);
        if clean_title = '' then clean_title := trim(f.title); end if;
      end if;

      note_data := jsonb_build_object(
        'kind', f.kind,
        'topic', topic_val,
        'leak', case when f.kind = 'leak' or f.payload ->> 'leak' = 'true' then true else false end,
        'title', left(clean_title, 300),
        'at', coalesce(post_at, f.found_at),
        'credit', coalesce(nullif(trim(f.source_name), ''), 'unknown source'),
        'text', coalesce(post_text, evt_line),
        'images', post_images
      );
      if post_url is not null and post_url like 'https://%' then
        note_data := note_data || jsonb_build_object('url', post_url);
      end if;
      if post_translation is not null then
        note_data := note_data || jsonb_build_object('translation', post_translation);
      end if;

      insert into public.catalog_items (game_id, kind, id, data, source, status)
      values (f.game_id, 'leak', note_id, note_data, src, 'active')
      on conflict (game_id, kind, id) do nothing;

      get diagnostics inserted_count = row_count;
      created := created + inserted_count;
    end;
  end loop;
  return created;
end $$;
revoke execute on function public.findings_create_notes(uuid[]) from public, anon, authenticated;
grant execute on function public.findings_create_notes(uuid[]) to service_role;

-- ── Backfill: create notes for approved findings that have none yet ──
-- Covers the existing auto-approved findings (e.g. the 5 Seele leaks) that were
-- approved before findings_create_notes existed, and any future migration re-runs.
do $$
declare
  missing uuid[];
  backfilled integer;
begin
  select array_agg(sf.id)
    into missing
    from public.scheduler_findings sf
   where sf.status = 'approved'
     and sf.game_id is not null
     and not exists (
       select 1 from public.catalog_items ci
        where ci.source = 'finding:' || sf.id::text
          and ci.kind = 'leak'
     );
  if missing is not null and array_length(missing, 1) > 0 then
    backfilled := public.findings_create_notes(missing);
    raise notice '0028 backfill: created % notes for approved findings', backfilled;
  end if;
end $$;
