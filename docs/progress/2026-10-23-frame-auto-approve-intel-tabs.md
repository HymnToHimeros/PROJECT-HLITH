# 2026-10-23 · FRAME: auto-approve all findings + Intel topic tabs

Branch `frame/auto-approve-intel-tabs`. Two jobs from MANAGER.

## JOB A: auto-approve all findings at delivery

Every finding the routine delivers is approved automatically — no kind
filter, no trusted-source join. The routine can correct itself through
the new `findings_decide` endpoint (dismiss + undo: retires the catalog
note and list item). Findings screen becomes a read-only log; no
Approve / Dismiss buttons, no TrustedSources management.

Migration 0028: `topic` column on `scheduler_findings`, replaced
`findings_auto_approve` (all findings, `auto_source = 'auto'`), new
`findings_decide(jsonb)` with catalog_items undo on dismiss.

## JOB B: Intel topic tabs

LeakNotes in Intel grouped by topic with `Segmented` tabs:
Characters, Story, Weapons & items, Events & modes, Systems, Codes, Other.

Each finding gets a `topic` from the scheduler payload; fallback from
`kind` via `KIND_TO_TOPIC` (character→characters, event/banner→events,
leak/info→other). Topics flow through: scheduler.ts → findings.ts →
findings-intake → schedulerData.ts → leakNotes.ts → Intel.tsx.

Only tabs with notes in them are shown; fewer than 3 topics hides the
tabs entirely.

## Files changed

- `supabase/migrations/0028_auto_approve_topics.sql` (new)
- `supabase/functions/_shared/scheduler.ts` (TOPICS, topicOf, NewFinding.topic)
- `supabase/functions/_shared/findings.ts` (topic in intake and save)
- `supabase/functions/findings-intake/index.ts` (decisions endpoint)
- `src/tools/owner/schedulerData.ts` (FindingView.topic, select, examples)
- `src/tools/intel/leakNotes.ts` (topic in LeakNote, noteFromFinding, readNote)
- `src/tools/owner/Findings.tsx` (read-only log, no buttons)
- `src/tools/intel/Intel.tsx` (Segmented topic tabs for LeakNotes)
- `src/tools/owner/OwnerConsole.tsx` (removed onDraft prop from Findings)
- `src/tools/owner/Scheduler.test.tsx` (updated for read-only log)
- `tests/scheduler.test.ts` (topic in readFindings expectation)
