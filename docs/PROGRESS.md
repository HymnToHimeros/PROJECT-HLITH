# PROJECT-HLITH · PROGRESS.md

Resume with: "continue from PROGRESS.md". Newest entry on top.

## Now
- **HLITH is live:** https://project-hlith.hliskjlf.workers.dev. Discord sign-in
  works end to end. Every merge to `main` redeploys the site and applies new
  database migrations (`docs/DEPLOY.md`).

## Next
- Real lists so the EXAMPLE badges go away: banners, events, versions,
  endgame dates (nanoka.cc has endgame seasons in `maze.json` / `shiyu.json`,
  and a list of not-yet-released characters in `manifest.json` → Intel).
  No banner schedules exist on nanoka.cc.
- The ★ screens still to build (Override 5): Edit mode, screenshot scan,
  Assistant proposals, evening message and calendar feed settings, setup
  checklist and Guide, HoYoLAB link, share a team, delete account, export data.
- Copy your on-device data (bank log, pulls, progress) into your account.
- Logic that belongs to other chats (see `docs/WORKSTREAMS.md`): team scoring,
  kit check data, builds and who-fits (ROSTER-LOGIC); farm material planning.
- Parked by your choice: Google login, owner rights, Resend, R24 backups.
- Optional dashboard fix: Cloudflare preview command → `npx wrangler versions upload`.

## How to check everything
- `npm run check` = lint + typecheck + unit tests + build.
- `npm run e2e` = browser smoke test at PC and phone sizes.
- CI (`.github/workflows/ci.yml`) runs both on every pull request.

## Done
- 2026-10-09 · **Every module has a real screen (R29–R30, R35–R45).** Today
  (resets, dailies/weeklies with ticks that clear at your server's reset,
  ★ tonight's run, ★ wishlist), Calendar (six-week timeline + coming up),
  Events (open/done/skipped, login days), Backlog (progress, count-toward-pulls
  switch), Banners (live/upcoming, leaks switch, owned/wanted/new label, Plan
  pulls), Roster (all characters from nanoka.cc, character page with
  owned/wanted/dupes, Teams, Kit check frame), Farm (pick characters; material
  numbers are examples until data exists), Intel. Built as interface only;
  logic slots say "No data yet" for the logic chats to fill. Real Events and
  Backlog progress now feeds the Pulls budget. Team size is in the game record
  (HSR 4, ZZZ 3). Browser test opens every module in every game with no errors.
- 2026-10-09 · Same sidebar order in every game; example notice says exactly
  what's example and has buttons to where you replace it (pull request #20).
- 2026-10-09 · **R31–R34 · Pulls screen** (the first real module screen; the
  others still say "being built"). Four tabs (Override 3): **Planner** (per
  banner: pulls now, by its end, worst case, chance by end with official and
  community odds, what isn't counted and why), **Calculator** (every income
  row until the version ends, paid extras switch), **Bank log** (add-only:
  I have / earned / bought / spent → balance), **History** (import an export
  file; in-game link when signed in, never saved; pity per banner; latest top
  results; **Luck report** card). Until you add your own, each tab shows
  **example data** built from the game's real character list, with an EXAMPLE
  badge on every example value and a notice on top. Your entries are kept on
  this device (`src/core/data/userData.ts`) and never removed. Screens load
  only when opened (registered in `src/main.tsx`), so the skeleton stays
  separate from the modules.
- 2026-10-09 · **Game data from nanoka.cc** (owner's permission). `npm run
  data:nanoka` fills `src/games/{hsr,zzz}/data/characters.json` from
  static.nanoka.cc: 99 HSR characters (game data 4.6.51, incl. the new
  **Elation** path) and 62 ZZZ agents (3.3.4, incl. the **Armorer** specialty and
  **Windbite** / **Lumiflux** attributes, confirmed from the agents' level-up
  chips). Unknown codes stop the script instead of being guessed. Test: every
  character's element and role exists in its game. nanoka also has light
  cones, W-Engines, relic/disc sets, items and per-agent skill files (for Kit
  check later).
- 2026-10-09 · gacha-import sign-in fix merged (#17) and checked live: a call
  without sign-in now gets 401.
- 2026-10-09 · **gacha-import requires sign-in.** Checked live after deploy:
  the function ran for a caller with only the public key (the platform's
  verify_jwt doesn't stop that with the new key style). It now confirms a
  signed-in user with Supabase Auth itself (`_shared/requireUser.ts`, 4 tests).
- 2026-10-09 · R28 merged (pull request #16); function deployed by the integration.
- 2026-10-09 · **R28 · history from the in-game link.** Server function
  `supabase/functions/gacha-import` (signed-in users only) with its logic in
  `supabase/functions/_shared/hoyoGachaLog.ts`: finds the link in pasted text,
  contacts only HoYoverse's history hosts, forwards only safe parameters, reads
  every page of every banner type, stops at pulls already stored, never loops
  or duplicates, plain messages for expired links and rate limits. Rows go
  through the same reader as files. Deployed by the Supabase GitHub
  integration (`supabase/config.toml`). **Not yet tested against the live
  HoYoverse API** (needs a real link from you); ZZZ's query parameters are
  from memory and unverified.
- 2026-10-09 · R27 merged (pull request #15).
- 2026-10-09 · **R27 · history from export files.** `src/tools/import/uigf.ts`
  reads UIGF v4 (any game section) and SRGF v1; server time → UTC; oldest
  first; unknown banner types and broken rows are counted, not hidden;
  re-imports only add new pull ids, never change or remove stored ones. Games
  describe their export format as data (`historyMapping`: gacha types, rarity,
  optional standard pool for 50/50 results). HSR gains its Departure Warp
  banner type; collab warps are skipped until their pity rules are confirmed.
- 2026-10-09 · R26 merged (pull request #14).
- 2026-10-09 · **R26 · pity engine.** `src/tools/pity/pity.ts`: chance of getting
  N featured copies within X pulls, computed exactly by stepping through every
  state, for any luck model (hard pity + 50/50, spark, none, a game's own rule);
  two modes, official and community (labelled). Worst case from official hard
  pity only; unknown when there's no ceiling. Pity, guarantee and luck (average
  pity, 50/50 record) from imported history. 19 tests incl. a hand-worked exact
  probability. `PullRecord.featured` added so imports can mark 50/50 wins.
- 2026-10-09 · R25 merged (pull request #13).
- 2026-10-09 · **R25 · pull budget engine.** `src/tools/budget/budget.ts`, pure
  functions, 11 rules from PLAN §4, 22 tests: future income only, today/this
  week/this cycle only if not done, events (open/done/skipped/ended), login
  days limited by days left, cycles need known dates, pass only while active,
  paid rows only with paid extras, Backlog counted once (covered rows skipped,
  disabled categories shown as potential), unknown amounts left out and listed,
  no bank → no total, pulls = premium ÷ per-pull (rounded down) + that banner's
  pull items. Missing server → reset-based rows say "choose your server".
- 2026-10-09 · **Live (R60).** Supabase tables created by its GitHub
  integration; app connected (public values in `config/.env.production`); hosted on
  Cloudflare (`wrangler.jsonc`, subdomain `hliskjlf`); Discord sign-in tested
  end to end by you. `docs/DEPLOY.md` lists every outside setting.
- 2026-10-09 · **Step 6 (R20–R23).** `supabase/migrations/0001_init.sql`:
  profiles, owners (set by hand only), settings, catalog (owner-only writes,
  items retired not deleted), your own items, roster, progress, append-only
  bank log and pull history, plans. Every user table has row-level security
  and **no delete policy**; a test enforces both. Sign-in screen (Google,
  Discord, email link) shown only when Supabase is configured; otherwise
  "this device only" mode. Settings sync: newest copy wins, the other is kept
  as a backup; status in the sidebar (synced / syncing / failed). Built-in
  lists: owner updates layered over seed data, ids never disappear.
  `docs/SETUP.md` has the outside setup steps.
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
- 2026-10-09 · Screens show clearly marked **example data** until you add your
  own (your request); example values carry an EXAMPLE badge so nothing fake
  passes as real (CLAUDE.md honest-data rule).
- 2026-10-09 · nanoka.cc (a friend's project) may be used for game data and,
  later, Intel/leaks.
- 2026-10-09 · You chose: build the website first; Google login, owner rights,
  Resend and backups wait.
- 2026-10-09 · Database changes reach Supabase through its GitHub integration
  (Deploy to production on `main`), not by pasting SQL. `supabase/config.toml`
  added for it; Supabase ignores its auth/API settings for the live project.
- 2026-10-09 · This chat's name is FRAME (named by job, not fiction); its
  branches are `frame/<job>`. Other chats pick a job name too.
- 2026-10-09 · You gave permission for me to open and merge pull requests on my own.
- 2026-10-09 · Structure rule: core = skeleton, tools/modules = shelves and nerves,
  games = flesh. Nothing in core/ or tools/ may assume HoYoverse rules.
- 2026-10-09 · Approved: React + Vite, Supabase (database, login, server
  functions), Cloudflare hosting (Workers static assets, chosen 2026-10-09 over
  legacy Pages), Resend for sign-in email.
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
5. Web address: free address for now; ended up as
   `project-hlith.hliskjlf.workers.dev` (Cloudflare's newer Workers route).

## Steps
The full checklist lives in `docs/ROADMAP.md` and ticks itself (`npm run roadmap`).
