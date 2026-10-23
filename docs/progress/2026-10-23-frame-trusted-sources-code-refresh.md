# 2026-10-23 · FRAME: Trusted sources auto-approve + faster code redemption

Branch `claude/zen-clarke-up2y9d`.

## JOB 1 — Trusted sources (auto-approve Seele leaks)

- **Migration 0027**: `scheduler_trusted_sources` table (source_name PK, owner RLS),
  `auto_source` column on `scheduler_findings`, seed row `'Seele (Telegram)'`,
  server function `findings_auto_approve(p_finding_ids uuid[])`.
- **findings-intake**: after `deliver()`, calls `findings_auto_approve` with the
  new finding IDs. Findings from a trusted source are approved server-side in one
  step (status + auto_source + decided_at).
- **Retroactive**: the migration UPDATE approves Seele findings still waiting
  (Kafka, Robin for ZZZ 3.4; Obsidian, Xuanquan for HSR).
- **Owner console → Findings**: shows "Approved automatically (trusted source: X)"
  when `auto_source` is set. Undo still works.
- **Trusted Sources section**: collapsible CRUD below the inbox (read/add/remove
  from `scheduler_trusted_sources`). Seele starts on it.
- **Tests**: `saveFindings` returns `ids`, `deliver` returns `{saved, addedIds}`,
  fakeDb generates UUIDs for `.insert().select('id')` chaining.

## JOB 2 — Fix code redemption + make it faster

### 2(a) No manual re-paste of cookie_token_v2

**Honest answer: not possible without stoken.** The codebase has no stoken
anywhere. HoYoverse's code redemption API requires `cookie_token_v2` +
`account_mid_v2` + `account_id_v2`. The `cookie_token_v2` expires and can only
be refreshed from an stoken, which HLITH does not collect. To add auto-refresh,
the app would need a new UI step to collect stoken from users — a separate job.

### 2(b) New codes tried sooner

- **New edge function `codes-refresh`**: lightweight function that fetches
  hoyo-codes for HSR and ZZZ and saves them to `hoyolab_codes`. Auth: scheduler
  service key only.
- **Job definition changed**: `codes-refresh` is now its own function with
  `'every 4h'` cadence (was `included` in `hoyolab-daily` with daily cadence).
  The daily job still does its own refresh on its run.
- **Codes from Findings**: `findings-intake` now extracts redeem codes from
  findings payloads (`payload.codes` arrays) and saves them to `hoyolab_codes`
  immediately, so codes from Findings/SCHEDULER enter the same list.
- **Config**: `supabase/config.toml` entry for `codes-refresh` (verify_jwt = false).
- **Tests**: scheduler test updated for the new job definition.

### 2(c) AKEF/Endfield via SKPort

**Honest answer: SKPort does not offer code redemption.** SKPort supports only
`['stamina', 'checkin']`. There is no code redemption endpoint for Arknights:
Endfield through SKPort.

## Follow-up — Leak findings with missing rarity

MANAGER instruction: auto-approved Seele leaks with missing rarity should go
through without the Lists form. Store rarity as unknown, show "No data yet".

- **approve.ts**: leak findings now require only `['name']` (not name + rarity +
  element + role). Missing fields stay undefined → "No data yet" in the UI.
- **schedulerData.ts**: new `backfillListItems()` mirrors `backfillNotes()` —
  on OwnerConsole load, adds any auto-approved finding that got an Intel note
  but never made it into the built-in list.
- **OwnerConsole.tsx**: wired `backfillListItems` into the existing useEffect.
- Typecheck clean, 203 scheduler tests pass. Committed at `60cb26b`.
