# PROJECT-HLITH · PROGRESS.md

Resume with: "continue from PROGRESS.md". Newest entry on top.

## Now
- **Step 1 — Project setup: done**, in review as a pull request.

## Next
- Step 2 — Tokens (`tokens.css`, ink.5 = `#6C7F93`) and Layer 4 components with
  a preview page.

## How to check everything
- `npm run check` = lint + typecheck + unit tests + build.
- `npm run e2e` = browser smoke test at PC and phone sizes.
- CI (`.github/workflows/ci.yml`) runs both on every pull request.

## Done
- 2026-10-09 · **Step 1.** React 19 + Vite 8 + TypeScript 6 (strict), ESLint,
  Vitest, Playwright, CI. Architecture test: core/ ↛ tools/ ↛ games/, games
  only import core/, games never import each other; checked by a test and by
  ESLint (both proven to fail on a planted bad import). Migration test blocks
  DROP / DELETE / TRUNCATE / RENAME / ON DELETE CASCADE. Placeholder page only.
  TypeScript stays on 6.x: the lint tools don't support 7 yet.
- 2026-10-09 · Plan merged (pull request #1).
- 2026-10-09 · Moved FEATURES.md, DESIGN.md and the design files into `docs/`
  (CLAUDE.md expects them there). Wrote `docs/PLAN.md` and this file.

## Decisions log
- 2026-10-09 · You gave permission for me to open and merge pull requests on my own.
- 2026-10-09 · Structure rule: core = skeleton, tools/modules = shelves and nerves,
  games = flesh. Nothing in core/ or tools/ may assume HoYoverse rules.
- 2026-10-09 · Approved: React + Vite, Supabase (database, login, server
  functions), Cloudflare Pages hosting, Resend for sign-in email.
- 2026-10-09 · ink.5 proposed as `#6C7F93` (Override 4): 4.83:1 on bg.app,
  4.59:1 on bg.card.

## Answers (2026-10-09)
1. Assistant: each user's own Claude key, set in their account.
2. Evening message: phone notification.
3. Pull chances: both official and community soft-pity numbers, labelled.
4. Supabase: free plan for now.
5. Web address: free pages.dev address for now.

## Steps (from PLAN.md §8)
| # | Step | State |
|---|---|---|
| 0 | Plan | done |
| 1 | Project setup + architecture test | done |
| 2 | Tokens + Layer 4 components | not started |
| 3 | Contract, registries, `_template`, HSR + ZZZ records | not started |
| 4 | Time and resets | not started |
| 5 | Shell + Edit layout | not started |
| 6 | Supabase schema, login, sync | not started |
| 7 | Built-in lists + never-wipe tests | not started |
| 8 | Budget engine | not started |
| 9 | Pity engine + history import | not started |
| 10–18 | Modules: Events, Backlog, Pulls, Roster, Banners, Farm, Calendar, Today, Intel | not started |
| 19–27 | Edit mode, HoYoLAB, Assistant, scan, evening message + feed, share team, checklist + Guide, export + delete, Owner console | not started |
| 28 | Polish | not started |
