# 2026-10-12 · FRAME · T74 Set themes for the owner

- New generic background layers a theme can switch on: ten motifs with slow motion, four
  surface textures, four menu accent shapes (src/core/theme/ornaments.tsx, ornamentIds.ts).
  Neutral names only; the theme's own colours paint them. Motion stops unless Animations is on.
- The themes themselves (names, colours, which layers) are not in this repo or the app. They
  wait as drafts in `owner_theme_drafts` (migration 0020, owner read only, no write through the
  API). Owner console → Owner themes → "Add the set themes" merges them into the private
  manifest: it only adds, never changes or removes a theme already there.
- Nightly backup lists the new table (backupPlan.ts), so the PR needs MANAGER's live test.
- After merge: once 0020 is live, write the drafts straight into the database (not the repo).
- Screenshots: a private claude.ai page sent to MANAGER, not in docs/owner-reports.
