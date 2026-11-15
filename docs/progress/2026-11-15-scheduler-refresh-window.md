# 2026-11-15 · SCHEDULER · Data refresh no longer misses its check times

- From 12 to 15 Nov the timed data refresh imported nothing: every run said
  "not due". A check counted as due only for 2 hours after its time, but
  GitHub ran the 2-hourly timer only every 5-7 hours, so the runs never
  landed inside that window (the 13, 14 and 15 Nov 10:30 UTC checks were
  all missed).
- The refresh now treats a check as due for 8 hours after its time. If two
  runs fall inside the same 8 hours, the second one just finds nothing new.
