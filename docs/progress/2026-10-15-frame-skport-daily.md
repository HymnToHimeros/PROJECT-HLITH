# 2026-10-15 · FRAME: SKPort automatic daily check-in

Branch `claude/zen-clarke-up2y9d`, commit `167288e`.

New scheduled edge function `skport-daily` claims the daily attendance
reward for every saved SKPort account (Arknights: Endfield) whose owner
switched auto check-in on.

- **`supabase/functions/skport-daily/index.ts`**: the function. Mirrors
  the `hoyolab-daily` pattern: `isScheduler` auth, service-role DB,
  `withoutBanned` filter, skip links already checked in today, 120 s
  deadline for new work. For each link: reads the token from Vault
  (`skport_link_secret` RPC), calls `readSkport` with
  `want: ['checkin'], claim: true`, records the result into
  `skport_checkins`.
- **`supabase/functions/_shared/jobs.ts`**: registered the job
  (`id: 'skport-daily'`, cadence `daily 16:40`, target
  `{ kind: 'function', name: 'skport-daily' }`, maxSeconds 135).
- **`supabase/config.toml`**: added `[functions.skport-daily]` with
  `verify_jwt = false` (the scheduler calls it with the service key).

All 19 SKPort tests pass. TypeScript typecheck clean.
