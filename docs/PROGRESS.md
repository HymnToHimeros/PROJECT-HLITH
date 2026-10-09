# PROJECT-HLITH · PROGRESS.md

Resume with: "continue from PROGRESS.md". Newest entry on top.

## Now
- **Step 4 (R16) done**, in review: server resets and local time.

## Next
- Step 5 — The shell: PC sidebar, phone bars, More sheet, game switcher, Edit
  layout, server picker (R17–R19). Uses local storage until accounts exist (R20+).

## How to check everything
- `npm run check` = lint + typecheck + unit tests + build.
- `npm run e2e` = browser smoke test at PC and phone sizes.
- CI (`.github/workflows/ci.yml`) runs both on every pull request.

## Done
- 2026-10-09 · **Step 4 (R16).** `src/core/time/reset.ts`: game day and week
  start, next daily/weekly reset, resets counted in a window (for the pull
  budget), all from the game record's server offset and reset rule. Display
  in the viewer's own time zone and locale. Tested on Europe, America and Asia
  servers, incl. Asia's Monday reset falling on Sunday evening UTC.
- 2026-10-09 · Step 3 merged (pull request #5).
- 2026-10-09 · **Step 3 (R09–R15).** `src/core/contract/` (contract, list item
  types, honest-data type), `src/core/registry/` (modules with Pulls' four tabs and
  Roster's two, data-driven features, game registration that rejects broken
  records, layout rules: order, hide-but-not-the-last, restore, move, reset,
  not-available, phone bar). `src/games/_template`, `hsr`, `zzz` with empty lists
  ready for data. Unknown numbers (endgame rewards, ZZZ weekly, Bangboo rate) are
  null and will show "No data yet". Every source line says `verified: false`
  until someone checks it in game. Made-up "Fake Quest" game (spark instead of
  pity, no dupes, two stamina pools, no Farm/Intel) registers with no core change.
- 2026-10-09 · **Step 2 (R06–R08).** `src/core/theme/tokens.css` is the only
  place colours, type and sizes live; ink.5 = `#6C7F93`. Fonts self-hosted
  (Archivo with width axis, JetBrains Mono). 15 shared components in
  `src/core/ui/` reading `--vent`, never a game name. `Known<T>` honest-data
  type in `src/core/contract/known.ts`: unknown values render "— No data yet ·
  fix", never 0. Countdown rules (2d 04h / live clock / ember under 72 h).
  Tests: contrast for every text colour, vent rule (7:1, not orange/red),
  component states. Preview at `/preview`, checked at PC and phone sizes.
- 2026-10-09 · **R05.** Self-checking roadmap (`npm run roadmap`, test fails if
  stale) and workstreams file. Step 1 merged (pull request #2).
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
- 2026-10-09 · This chat's name is FRAME (named by job, not fiction); its
  branches are `frame/<job>`. Other chats pick a job name too.
- 2026-10-09 · You gave permission for me to open and merge pull requests on my own.
- 2026-10-09 · Structure rule: core = skeleton, tools/modules = shelves and nerves,
  games = flesh. Nothing in core/ or tools/ may assume HoYoverse rules.
- 2026-10-09 · Approved: React + Vite, Supabase (database, login, server
  functions), Cloudflare Pages hosting, Resend for sign-in email.
- 2026-10-09 · ink.5 = `#6C7F93` (Override 4): 4.83:1 on bg.app, 4.59:1 on
  bg.card, 4.7:1 on bg.shell. It's for section labels only; on bg.inset/raised it
  is 4.4:1, so labels never go there.
- 2026-10-09 · "No data yet" fix wording is provider-neutral ("Connect account",
  not "Connect HoYoLAB") so other games' services fit.
- 2026-10-09 · Display type drops from 64px to 44px on phones (not in DESIGN.md;
  64px runs off a phone screen).

## Answers (2026-10-09)
1. Assistant: each user's own Claude key, set in their account.
2. Evening message: phone notification.
3. Pull chances: both official and community soft-pity numbers, labelled.
4. Supabase: free plan for now.
5. Web address: free pages.dev address for now.

## Steps
The full checklist lives in `docs/ROADMAP.md` and ticks itself (`npm run roadmap`).
