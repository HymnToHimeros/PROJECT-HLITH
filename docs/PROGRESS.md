# PROJECT-HLITH · PROGRESS.md

Resume with: "continue from PROGRESS.md". Newest entry on top.

## Now
- **Step 6 (R20–R23) done**, in review: tables with per-user walls, sign-in
  screen, settings sync, built-in lists. **Waiting on you:** Supabase project URL
  + publishable key (see `docs/SETUP.md`), then Discord and Google login apps.

## Next
- Connect the real Supabase project once you send the two public values, and
  test sign-in end to end.
- R24 backups (needs a storage choice) can wait; next build step is the pull
  budget engine (R25).

## How to check everything
- `npm run check` = lint + typecheck + unit tests + build.
- `npm run e2e` = browser smoke test at PC and phone sizes.
- CI (`.github/workflows/ci.yml`) runs both on every pull request.

## Done
- 2026-10-09 · **Step 6 (R20–R23).** `supabase/migrations/0001_init.sql`:
  profiles, owners (set by hand only), settings, catalog (owner-only writes,
  items retired not deleted), your own items, roster, progress, append-only
  bank log and pull history, plans. Every user table has row-level security
  and **no delete policy**; a test enforces both. Sign-in screen (Google,
  Discord, email link) shown only when Supabase is configured; otherwise
  "this device only" mode. Settings sync: newest copy wins, the other is kept
  as a backup; status in the sidebar (synced / syncing / failed). Built-in
  lists: owner updates layered over seed data, ids never disappear.
  `docs/SETUP.md` has the outside setup steps. `public/_redirects` makes
  addresses like /hsr/pulls work on Cloudflare Pages.
- 2026-10-09 · Step 5 merged (pull request #7).
- 2026-10-09 · **Step 5 (R17–R19).** `src/core/shell/`: PC sidebar (game
  switcher All/HSR/ZZZ/+, modules, Edit layout, sync status, Assistant ⌘K,
  Account), phone top bar + bottom bar (first 4 + More) with 500 ms
  long-press to edit, More sheet, game picker. Edit layout: drag or arrow
  keys, Hide (never the last), Restore, Reset, "not in this game", phone-bar
  line. Server picker per game with each server's reset in your own time;
  no server is guessed ("Choose your server" until picked). Your games:
  turn games on/off, never the last, never deletes data. Addresses like
  /hsr/pulls. Settings saved on this device (`src/core/data/prefs.ts`);
  unreadable saved data is backed up, not wiped. Modules show a "being
  built" card, not fake numbers. Assistant opens a placeholder.
- 2026-10-09 · Step 4 merged (pull request #6).
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
- 2026-10-09 · Database changes reach Supabase through its GitHub integration
  (Deploy to production on `main`), not by pasting SQL. `supabase/config.toml`
  added for it; Supabase ignores its auth/API settings for the live project.
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
- 2026-10-09 · Edit layout, Account and Assistant open as a right-side panel
  on PC and a bottom sheet on phone (DESIGN.md names the Assistant panel only).
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
