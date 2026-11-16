# 2026-11-15 · SCHEDULER · Data refresh no longer misses its check times

- From 12 to 15 Nov the timed data refresh imported nothing: every run said
  "not due". A check counted as due only for 2 hours after its time, but
  GitHub ran the 2-hourly timer only every 5-7 hours, so the runs never
  landed inside that window (the 13, 14 and 15 Nov 10:30 UTC checks were
  all missed).
- The refresh now treats a check as due for 8 hours after its time. If two
  runs fall inside the same 8 hours, the second one just finds nothing new.

## 2026-11-16 follow-up: due until an import has run

- The 8-hour window was not enough: on 16 Nov GitHub ran no timer for
  8 h 20 min, so the 07:00 UTC check was missed again.
- Now a check is due until a run has imported after its time. The workflow
  looks up the start of the last run whose import step succeeded (its own
  token, read-only `actions: read`) and passes it to
  `schedule-due.ts --since`. Only checks from the last 72 hours count, so an
  old gap gives one catch-up run, not many.
- If that lookup fails or finds nothing, the 8-hour window rule is used and
  the job carries on.
- Test: tests/scheduleRhythm.test.ts ("a check stays due until an import
  runs after it…"): a late run still catches the check, an imported check
  is not due again, future checks are never due, the 72-hour cap holds.
