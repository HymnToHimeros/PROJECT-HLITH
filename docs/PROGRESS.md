# PROJECT-HLITH · PROGRESS.md

Resume with: "continue from PROGRESS.md". Newest entry on top. Older entries:
`docs/HISTORY.md`.

## Now
- **HLITH is live:** https://project-hlith.hliskjlf.workers.dev. Sign-in with
  Google, Discord or an email link; settings and game data sync to the account.
- The scheduler runs every 15 minutes (nightly backup, HoYoLAB daily check-in
  and codes). Owner rights are set; `scheduler_key` and `findings_intake_key`
  are in Vault.
- Two more chats can start: **SCHEDULER** (`docs/briefs/SCHEDULER.md`: all
  time-gated game data) and **LOGIC-CORE** (`docs/briefs/LOGIC-CORE.md`).

## Next
- SCHEDULER fills versions, banners, events, endgame and backlog; LOGIC-CORE
  refines Roster (kits, kit check, teams, builds, materials). Schedules for the
  research routine are decided once both are done.
- Live checks with real logins: HoYoLAB link, in-game history link, Assistant
  with your own key.
- Later: phone push keys (VAPID) so the evening message is really sent;
  Resend for sign-in mail at scale; finishing account deletions after 30 days.

## How to check everything
- `npm run check` = lint + typecheck + unit tests + build.
- `npm run e2e` = browser tests at PC and phone sizes.
- CI (`.github/workflows/ci.yml`) runs both on every pull request.

## Done
- 2026-10-10 · **Whole-site audit: about 70 flaws fixed** (branch `frame/audit-fixes`).
  Five audits (Today/Calendar/Events/Intel, Pulls/Banners, Roster/Farm/Scan,
  Account/Assistant/shell, Backlog/Edit mode), then fixes:
  - Game data (bank log, pulls, roster, teams, progress, own items) syncs to the
    account like settings (table `user_game_data`, migration 0007; in export,
    deletion and backup).
  - Examples come from one generator and mix in one by one on every screen; a
    hide or tick on one shows everywhere; Hide leaks works on Today, Calendar,
    Events and the Planner. Examples are never counted.
  - Undo everywhere it was missing: bank log entries, imports, "All done",
    deleted teams, roster import, Edit-mode changes ("Back to the list's version"),
    plans from Calendar, findings ("Move back to new").
  - Dead ends removed: empty screens offer "Add your own", "No data yet" fixes
    are clickable, tabs live in the address, hidden modules open with Restore.
  - Honest texts: notifications marked preview only, calendar feed wording,
    owner console without fake buttons, scan says what it saves, Assistant says
    when it isn't connected, Edit layout "one order for every game".
  - Roster: delete and copy teams, editor lists everyone, owned clears wanted.
    Pulls: saved pity, guaranteed label, per-row paid extras, multi-account
    import picks one.
  - README rewritten; screenshots in `docs/screenshots/`; old progress moved to
    `docs/HISTORY.md`.
- 2026-10-10 · **Example data switch + Backlog rebuilt** (branch `frame/example-switch`).
  - Account → Example data: one switch hides every example on every screen
    (empty places say "No data yet") and brings them back. Only changes what is
    shown; nothing entered is touched. Browser test checks all screens.
  - Backlog rebuilt to the V1 layout: "Still on the table" on top, category
    tabs with counts, the story as a checklist (tap where you are), side quests
    as tick boxes per region, counters with − / + for everything else.
    Inline Edit mode: change any item (name, kind, totals, reward, currency,
    group, steps, note), add items or categories, hide and show again.
    Examples are editable: changing one makes it your own item. Examples are
    never counted toward pulls. New optional item fields: group, steps, unit, note.
  - Events and Banners: Edit list now shows the examples too, so they can be
    changed (becomes yours) or hidden.
- 2026-10-09 · **Timer key fix** (branch `frame/scheduler-key-check`). The first
  timer run (23:30 UTC) was refused (401): the scheduler compared the Vault key with
  its own copy of the project key, which differs. It now asks the database
  (`scheduler_key_ok`, migration 0006) whether the key matches the Vault secret
  `scheduler_key`. Tested on local Postgres; browser users can't call it.
- 2026-10-09 · **R63 Scheduler frame** (branch `frame/scheduler`). Shown to you
  for approval (no design yet, Override 5).
  - Live since PR #30. One Cron job (`hlith-scheduler`, every 15 min) exists
    only after the owner presses **Start timer** in Owner console → Scheduler
    (Stop timer removes it; the migration creates none). It calls the `scheduler` function with the Vault
    secret `scheduler_key`. The function runs each due job (backup 02:40 UTC,
    HoYoLAB daily 16:10 UTC), one at a time inside a 140 s budget, never two
    copies of a job (lock with expiry), one catch-up after missed runs, and
    records every run. Owners can "Run now" one job.
  - Job list in code: `supabase/functions/_shared/jobs.ts`. leaks-scan,
    events-scan and game-data-refresh are run by an external routine chat (not
    Supabase), FRAME until it exists; it delivers to `findings-intake` with its
    own key `findings_intake_key` (format: `docs/ROUTINES.md`).
  - Tables: `scheduler_jobs`, `scheduler_runs` (append-only), `scheduler_findings`
    (inbox; dismiss is a status). Owner-only read; owner may change only a job's
    switch/cadence and a finding's decision; only the server adds rows.
  - Owner console now has tabs Overview · Scheduler · Findings. Approve only
    marks a finding; adding it to the lists is `onApprove` (data workstream).
  - Checked: all five migrations on PGlite with stubbed auth/storage/vault/cron/
    net, policies exercised. Not checked live: the Cron call, Vault lookup, the
    function waiting for backup/hoyolab-daily, background work after the 202.
- 2026-10-09 · **Adjust your profile picture and banner** (branch
  `frame/profile-image-editor`). Shown to you for approval (no design yet).
  - Choosing a file (or "Adjust picture" / "Adjust banner" on one you already
    have) opens a sheet with the picture inside its exact final shape (circle,
    or the 4 : 1 banner strip) and the outside dimmed.
  - Drag (mouse or finger), pinch, mouse wheel, Zoom slider with − / +, Fill,
    Fit and Reset. Keys: arrows move (Shift = bigger steps), + / − zoom, 0 resets.
    Fill never leaves gaps; Fit shows the whole picture and the gaps show the
    default background. Live preview of the profile header. Explained with HowTo.
  - Saved exactly as shown: 512 × 512 picture, 1600 × 400 banner, JPEG 0.85
    (WebP/PNG with see-through edges only after Fit). The original file stays
    in memory only while editing. Same 2 MB / images-only limits and the same
    save paths (this device or the avatars bucket).
  - The profile banner is now always the same 4 : 1 shape as the saved banner.
  - Files: `src/tools/account/imageCrop.ts` (maths), `imageRender.ts`,
    `ImageAdjust.tsx`, `imageAdjust.module.css`; tests in `imageCrop.test.ts`,
    `ImageAdjust.test.tsx`, e2e in `tests/e2e/smoke.spec.ts` + accessibility.
- 2026-10-09 · **Account is its own page, with a customisable Profile** (branch
  `frame/account-page`). Shown to you for approval (no design yet, Override 5).
  - `/account` and `/account/<section>`: a section bar (left column on PC,
    sideways-scrolling tabs on phone) with Profile, Sync, Backup, Notifications,
    Game settings, Connected accounts, Guide, Layout, Theme, Owner console (owners
    only), Sign in / Sign out. The sidebar stays; browser back works.
  - Every "Choose server" button opens Account → Game settings for that game
    (`/account/game-settings/<game>`), with "Done · back to where you were".
  - Profile: banner (default: a wash in your games' colours), round picture
    (default: your initial), name, bio (200 max), and showcase cards from your own
    data only: games + server, sign-in methods, member since, characters owned +
    up to 6 pinned per game, pulls imported, current pity per banner, backlog %
    (only when every item has a count). Empty cards say "No data yet" with a button.
    Edit mode: pictures (images only, 2 MB max, cropped to fill, shrunk in the
    browser), name, bio, pins, card switches.
  - Saved: this device only → `hlith.profile` in the browser (in backups too).
    Signed in → new columns on `public.profiles` + an `avatars` storage bucket
    (`supabase/migrations/0004_profile.sql`, `supabase/config.toml`): public read,
    writes only into your own `<user id>/` folder, no delete policy.
  - Checked: migrations 0001, 0002, 0004 applied to an in-process Postgres
    (PGlite, Postgres 17 in WASM, stub auth/storage schemas) with the policy rules
    exercised. Live upload to Supabase not tried yet.
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
