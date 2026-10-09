# PROJECT-HLITH · PROGRESS.md

Resume with: "continue from PROGRESS.md". Newest entry on top.

## Now
- **HLITH is live:** https://project-hlith.hliskjlf.workers.dev. Discord sign-in
  works end to end. Every merge to `main` redeploys the site and applies new
  database migrations (`docs/DEPLOY.md`).

## Next
- Show you every screen next to the design; fix what you point out.
- At the end (parked, needs you): Google login, owner rights (owner check →
  Owner console row), Resend, the nightly backup schedule, the daily HoYoLAB
  schedule (SETUP.md §4), phone push keys
  (VAPID) for the evening message, finishing account deletions after 30 days.
- Live checks only possible with real logins: HoYoLAB link, in-game history
  link, Assistant with your Claude key (all built, marked unverified until then).
- Data/logic for other chats (`docs/WORKSTREAMS.md`): real banners, events,
  versions, art; team scoring, kit data, builds, material planning.
- Optional dashboard fix: Cloudflare preview command → `npx wrangler versions upload`.

## How to check everything
- `npm run check` = lint + typecheck + unit tests + build.
- `npm run e2e` = browser smoke test at PC and phone sizes.
- CI (`.github/workflows/ci.yml`) runs both on every pull request.

## Done
- 2026-10-09 · **R62 HoYoLAB: several accounts, one button, automatic check-in
  and codes** (branch `frame/hoyolab-accounts`).
  - Roster in All games has ONE "Import from HoYoLAB" and ONE "Scan a
    screenshot". The import sheet picks a game (and which account reads it) or
    "Every connected game", each into its own roster. The scan sheet asks which
    game the screenshot is from.
  - Account → Connected accounts is one list of HoYoLAB accounts ("Main",
    "Alt"…), each showing the games and UIDs it covers, with Check now / Check
    in now per game, Rename, Replace login, Forget. A login can be used once,
    remembered on this device, or saved on HLITH's server.
  - Saved on the server = encrypted in Supabase Vault (migration 0003); no
    browser can read it back. Forget overwrites it with random text and keeps
    the row (never-wipe).
  - Automatic daily check-in and automatic codes (opt-in switches per account).
    The `hoyolab-daily` function runs them and records every result; the card
    shows "Last automatic check-in: today 05:02 · got 20 × Stellar Jade" or the
    error. "Run now" does it on demand. **Needs the daily schedule (SETUP.md §4).**
  - Codes come from the public list hoyo-codes.seria.moe (open source,
    github.com/seriaati/hoyo-codes; it keeps only codes it could redeem on its
    own test account) plus codes you paste. Redeeming needs a second login from
    hoyoverse.com (account_id_v2, account_mid_v2, cookie_token_v2), because
    codes are redeemed there, not on HoYoLAB.
  - Research on "anything else it can do on its own" (genshin.py): web events
    have no documented calls, so they need you; Traveling Mimo has calls, but
    its tasks need you and spending its points is your choice, so it's left to
    you; HoYoLAB's community check-in is retired. The screen says all this.
  - Also fixed: backups no longer include logins remembered on the device
    (`hlith.secret.*`), and a restore never brings one back.
  - Not tested with a real login yet: check-in reward text, code redemption,
    the Vault functions on the live database.
- 2026-10-09 · **All 61 roadmap steps have their frame** (branch `frame/skeleton`).
  Five builders' work combined and joined up: Account as the design (Sync,
  Backup with export/restore and delete account, Notifications with evening
  message and calendar feed, Game settings, Connected accounts with the HoYoLAB
  link, Guide with a self-ticking setup checklist, Layout, Theme dark/light,
  Sign out); every module matched to the design with a "How to use this" box;
  HoYoLAB roster import, screenshot scan, share a team; Assistant with your own
  key, cost per message, proposals with approve/undo; Edit mode (your own
  events, banners, backlog items show on Events, Banners, Backlog, Pulls, Today
  and Calendar); approved plans on the Calendar; nightly backup function (R24);
  accessibility test on every page, game and size (R59); light theme (R61).
  Browser tests now always test this checkout's own fresh build.
- 2026-10-09 · **Roster, Farm and Intel follow the design; Owner console frame
  (R58).** Branch `frame/design-roster-farm`. Roster: one grid in All games
  with game tags, design tiles with an art slot (hatched placeholder until art
  exists), All / Owned / Not owned / Wanted, quick marking and "Select
  several". Character page opens in place with "← Roster": Level, copies,
  Build score tiles, Build score (or If you pull), Team fit, Kit check,
  Materials to max, Recommended build. Teams: your presets, recommended teams
  with portraits and a score spot, ideas (teams you can build, if you pull,
  endgame record). Farm: "Farm for" chips, stamina tiles, Materials, Gear to
  farm. Intel: kind filter, dashed rows with source reliability. Owner
  console: built, not reachable until there is an owner check. Logic slots
  show "No data yet" or EXAMPLE values. Every screen has "How to use this".
- 2026-10-09 · **R47 HoYoLAB link, roster import, R50 screenshot scan, R54 share
  a team** (branch `frame/connections`, frames + plumbing). HoYoLAB: a server
  function (`supabase/functions/hoyolab`, sign-in required, only HoYoLAB hosts)
  reads live stamina, daily activity, check-in (and can claim it), characters
  and endgame records. The login values are used once by default; "Remember on
  this device" keeps them in this browser only (never synced or backed up).
  **Not yet tested with a real HoYoLAB login**: it follows community docs
  (genshin.py), and the screens say so. Roster → Characters has "Import from
  HoYoLAB" (only adds and raises, never removes) and "Scan a screenshot"
  (manual entry saves owned + dupes now; "Read it for me" waits for the
  Assistant key). Share: a link with the team inside it (after the #, no
  server), copy as text, save picture, phone share menu; opening a link shows
  the team read-only with "Save to my teams". Still to mount: the HoYoLAB card in
  the Account panel and the Share button on Teams (owners of those screens).
- 2026-10-09 · **★ Assistant, proposals, Edit mode (R46, R48, R49)** — frame,
  to show you (Override 5: no design for proposals or Edit mode yet).
  - **Assistant** (⌘K / Ctrl+K, "Ask" on phone; look from the design
    prototype): your own Claude key (kept only on this device or only for
    this tab, your choice; "Forget key"; never in your synced settings),
    model picker (Opus 5.5 default, Sonnet 5.5, Haiku 5.5, with prices, what
    each is good for, and your own measured average per model), chat,
    screenshots (shrunk in the browser), web search on Opus/Sonnet (not
    documented for Haiku, so off there), cost of every reply as an estimate
    (token counts × list price, + $0.01 per search), a daily limit counted on
    this device, New chat, suggestions, and a clearly marked EXAMPLE chat
    until you start. The server function `supabase/functions/assistant` needs
    sign-in, gets your key with each message, uses it for that one call and
    keeps nothing. It tells Claude a compact summary of your real data (no
    examples).
  - **Proposals**: the Assistant can only *propose* changes (bank log entry,
    event done/skipped, backlog count, owned/wanted, tick a Today task, a
    plan or a route). Each is a card: Approve / Dismiss, then Undo. Undo of a
    bank log entry adds a correcting entry; nothing is ever deleted. Settings
    lists every change it made, with Undo.
  - **Edit mode**: add, change and hide your own events, banners and backlog
    items per game; hide is a flag, list updates never touch your entries.
    Reachable now from Assistant → Edit lists. Module screens can use
    `useWithOwnItems(game, kind, list)` and `<EditListButton game kind />`
    (one line each) once their builder adds them.
  - Not checked against the live API yet: needs a deployed function and a
    real key (see the report).
<<<<<<< HEAD
- 2026-10-09 · **Shell, Account, Today and Calendar drawn to the design
  (`docs/design/HLITH App.dc.html`).** Sidebar (segmented game switcher,
  MODULES with Edit layout beside it, boxed glyphs, sync line, Assistant,
  Account with avatar), phone top bar with the switcher, bottom bar with glyph
  pills and the ASK button, SAMPLE DATA marker in the header whenever an EXAMPLE
  notice is on screen, centred sheets on PC (Account, Server, Add a game, More),
  Edit layout over the sidebar. Account sheet with the design's rows, each opening
  a page: Sync, Backup (Export my data, Restore that only adds, Delete my account
  with a 30-day grace period), Notifications (evening message + calendar feed,
  R51–R53), Game settings (server per game, your games, tasks on Today), Guide +
  Setup checklist (R55), Layout settings, Theme (dark/light, R61), Sign out.
  Server functions export-data (R56), delete-account (R57), ics-feed (R52),
  evening-message (R51); migration 0002 adds deletion requests and reminder
  settings. Today: tiles, server + currency chips, Open tasks, Live banners,
  Coming up, plus Tonight's run and Wishlist. Calendar: legend, Monday ticks,
  lanes, white today line, Dates list.
=======
>>>>>>> frame/design-roster-farm
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
- 2026-10-09 · As in the design: Account, Server, Add a game and More open as a
  centred card on PC and a bottom sheet on phone; Edit layout covers the sidebar
  on PC; the Assistant stays a right-side panel.
- 2026-10-09 · Delete my account never removes rows on the spot: it records a
  request with a 30-day grace period (cancel any time, export first). Restore from
  a backup only adds: nothing on the device is removed or overwritten.
- 2026-10-09 · Light theme (R61) is built from the tokens (`tokens-light.css`),
  same names, contrast tested; the full light design still comes later.
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
