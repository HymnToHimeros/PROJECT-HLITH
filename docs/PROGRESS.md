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
- SCHEDULER: lists filled (see Done); next is keeping them current once the owner
  decides the schedule (`npm run data:nanoka && npm run data:schedule`). LOGIC-CORE
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
- 2026-10-10 · **FRAME: calm Backlog** (branch `frame/calm-backlog`, owner job T20).
  The main story now leads with "where you are": the chapter you are on, "12 of 26
  done", a progress bar and the reward left. The full chapter list is folded behind
  "Show all N chapters" (only the last done, current and next chapter show, numbered);
  plain lists longer than 8 rows show 6 and fold the rest the same way. The pulls
  switch has a visible "Counts toward pulls" label. Nothing removed; ticking, Edit,
  hide/undo all work folded or open. Page height on PC 1440: HSR 1835 → 900 px,
  All 3537 → 1540 px; phone All 4155 → 1995 px.
- 2026-10-10 · **Two more chats: MANAGER and ERROR-FIX** (branch `frame/manager-error-fix`).
  `docs/WORKSTREAMS.md`: rules 7–8, both in Who's who, a routing table (which job goes
  to which chat). `docs/briefs/MANAGER.md` (the owner's front desk: routes every
  owner message, keeps `docs/TASKS.md`, reports back) and `docs/briefs/ERROR-FIX.md`
  (fixes bugs only when a chat asks). `docs/RELEASES.md` updated for five chats.
- 2026-10-10 · **FRAME: save a build per character** (branch `frame/build-store`).
  Build score on the character page: "Enter build" opens a form for level, weapon
  (picked from the game's list, with level and Superimposition / Phase), every gear
  piece (set, main stat, up to four extra stats) and skill levels. Empty fields stay
  empty; a wrong number is named and nothing saves. Saved builds sync, show on the
  page (level in the header), can be edited, and cleared with Undo. A screenshot scan
  saves level and weapon into the build. The score itself waits for LOGIC-CORE's
  `scoreBuild`. Browser tests: "every module opens" is one test per screen.
- 2026-10-10 · **FRAME: Enhanced / Agent Potential per character** (branch `frame/potential-field`).
  For LOGIC-CORE: the character page has an "Enhanced" (HSR: Not set / No / Yes) or
  "Agent Potential" (ZZZ: Not set / 0–6) picker, only for characters whose kit has pieces
  that need it. Saved with the roster and synced; team scores and Kit check read it
  through `TeamAccount.potential`. "Not set" keeps those pieces locked, as before.
- 2026-10-10 · **FRAME: faster check, shared release routine** (branch `frame/faster-checks-and-releases`).
  `docs/RELEASES.md`: the three chats agree together before anything goes live
  (READY / OK / WAIT, merge order, one at a time). CI: notes-only changes skip the
  code checks; browser tests split over four machines; a newer push stops the older
  run; the long browser tests are one test per screen and theme (same checks), so they
  run side by side. About 5 minutes instead of 11.
- 2026-10-10 · **LOGIC-CORE: HSR scoring, build guide with pictures, shorter team lists** (branch `logic-core/roster-polish-hsr-scoring`).
  - HSR now scores like ZZZ: synergy % with Why (every point with its quote),
    Line-ups, Who fits, If you pull, and best teams by kit check. Rules:
    `docs/logic/hsr-theory.md` (v2, tightened), calls in
    `docs/logic/hsr-decisions.md`. All 99 HSR kits read into
    `src/games/hsr/kitcheck/sheet/` (groups A–I, quotes tested word for word).
    Teams of four, no order; each teammate counts each stat once; a team with
    a healer or shield always beats one without ("no sustain" is shown).
  - Aeon ★ Aha (not released) kit text imported from beta files, marked beta.
    "Nihilux" is not in any game data (rumour only), so nothing to import.
  - Character page: "How to build" card, step by step: relic/disc sets with
    picture and 2/4-piece text, weapon with picture and effect, main stat per
    slot, sub stats in order, skills first. Materials (page and Farm) show
    their pictures. Pictures from nanoka.cc, only ones that really load.
  - Teams: search, ready-to-play first, 6 shown then "Show 12 more".
    Character page Team fit: 3 teams, then "Show N more teams with …".
    Nothing is removed. Best-team searches are cached (both games).
  - Weapon banners listed no weapon names or pictures (the app had no weapon
    list). Now `weapons.json` (172 Light Cones, 103 W-Engines, every one with
    a picture) and each weapon on a banner shows its picture, name and who
    it's made for, with your roster fit. SCHEDULER's banner art stays.
  - Next: HSR character EXP (no source yet), Enhanced kits need a saved
    "Enhanced" flag (shown as locked until then), build score needs FRAME's
    build store.
- 2026-10-10 · **SCHEDULER step 2: server times, weapon banner art** (branch `scheduler/server-times-weapon-art`).
  Uses FRAME's new fields (#40): every banner and event time the game gives in "server
  time" now carries `serverTime { base: 8, start/end }`, so screens show it on the user's
  own server (America and Europe no longer see ends 13 / 7 h early). Light Cone and
  W-Engine banners get their picture (`Banner.art`, nanoka; each link checked).
  HSR Fate collaboration warps (Saber, Archer, Rin Tohsaka, Gilgamesh and their Light Cones)
  are in as `permanent` banners (FRAME #45): the game runs them "long-term"; `end` is how
  long the official notice is shown (2036).
  - **Rewards fixed:** a wiki page's own "Total Rewards" now wins over adding up its rows
    (The Final Callback was counted twice: 80 → 40), "/Rewards" sub-pages are read
    (Clink, Clank, Pinball Knight! 800, Diary of an Orbie Parent 300), multi-line reward
    cards count ("En-Nah" 10 Boopons), totals without the currency mean 0 (Fate Contract,
    Astral Imagea Park). Chronicles of the Hobbling Crow 360 from game8 (the wiki and the
    official notice show only pictures; `REWARD_OVERRIDE` in the script names the source).
    Only HSR "Interastral Peace Gala" (starts 21 Oct) stays unknown: sources say 500 or 60.
  - ZZZ 3.3 banners (21 Oct and 11 Nov) are in, now that the wiki has them; new W-Engines
    are matched to the game files through their agent (beta names differ).
  - Outfit sales ("discount" events) are no longer added; the two already listed stay
    (ids are never removed).
- 2026-10-10 · **LOGIC-CORE: every ZZZ agent read; materials for both games** (branch `logic-core/zzz-groups-f-i`).
  - ZZZ groups F (Aria, Promeia, Velina, Remielle, Grace, Nangong Yu, Pulchra),
    G (Ellen, Soukaku, Zhu Yuan, Qingyi, Nicole, Evelyn, Seth), H (Soldier 0 -
    Anby, Trigger, Orphie & Magus, Pyrois, Sigrid, Caesar, Koleda) and I (Anby,
    Nekomata, Soldier 11, Corin, Billy, Ben, and Severian and Phoenix from beta
    text). All 62 agents: Kit check tags, scores, Who fits, If you pull.
  - Engine: Aftershock DMG stat, assist-type conditions, one Ether Veil:
    Delusion Reprise at a time. Decisions 39–50 in `docs/logic/zzz-decisions.md`.
  - Step 4 started: `npm run data:costs` (nanoka.cc) fills ascension, skill,
    Core Skill and Trace costs for every ZZZ agent and HSR character, and ZZZ
    Agent EXP. Farm and the character page's "Materials to max" now show real
    amounts, with a note saying what they cover. HSR character EXP isn't
    counted yet (no source found that HLITH can read).
  - Recommended builds: `npm run data:builds` reads the game's own
    recommendation for every character (ZZZ: Drive Disc sets, main and sub
    stats, the agent's own W-Engine, which skills to level first; HSR: relic
    and planar sets, main and sub stats, Light Cones). Shown on the character
    page (Recommended build) and in Farm (Gear to farm), source named.
  - HSR kit text for every released character (98), imported group by group
    (A, then one group per path). Kit check shows it; tags and scores wait for
    the owner's OK on `docs/logic/hsr-theory.md`.
  - ZZZ recommended teams from the kit check: the best squad per damage dealer
    from every agent at Mindscape 0, two alternatives per place, each scored
    against your roster (a team is scored for its first member).
  - HSR recommended teams: the game's own (first team per character, 93),
    each place with its backups. Their scores wait for the HSR theory OK.
- 2026-10-10 · **LOGIC-CORE: ZZZ groups B to E, HSR kit text and theory** (branch `logic-core/zzz-groups-d-e`, replaces PR #41).
  - ZZZ group D read (Yixuan, Ju Fufu, Yidhari, Manato, Claret, Astra Yao,
    Yuzuha) and group E (Miyabi, Yanagi, Burnice, Jane, Vivian, Alice, Piper).
    New stat "Anomaly DMG": Disorder / Assault / Attribute Anomaly buffs count
    only for damage dealers whose own text proves they deal it. 33 of 62 ZZZ
    agents are read now.
  - ZZZ group B read (Lycaon, Lighter, Roxy, Hugo, Sunna, Ye Shunguang, Zhao) and
    group C (Banyue, Norma, Cissia, Harumasa, Lucy, Seed, Rina, Anton). Tests
    from the method: Ye + Sunna + Zhao = 9, Lighter's Ice/Fire buffs don't reach
    a Physical damage dealer, Dialyn's and Roxy's +2s Stun don't stack.
  - Importer: Agent Potential (base text "Replaced" once Potential is saved),
    live text for released agents (beta only for unreleased), blank glossary
    words filled from zzz.gachabase.net, every formula shape.
  - HSR: `npm run data:hsr-kits` imports group A's kit text (13 characters:
    Feixiao, Topaz, Robin, Aventurine, Acheron, Jiaoqiu, Pela, Silver Wolf,
    Firefly, Ruan Mei, Harmony Trailblazer ×2, Lingsha), with Traces,
    Eidolons, memosprites and Enhanced kits. Kit check shows it.
  - `docs/logic/hsr-theory.md`: the HSR theory, waiting for the owner's OK.
    No HSR scoring code until then.
- 2026-10-10 · **LOGIC-CORE steps 2–3 for group A: Kit check tags and team scores** (branch `logic-core/zzz-kit-check-a`).
  - Cheat sheet (Part A) for Starlight Billy, Dialyn, Lucia, Pan Yinhu:
    `src/games/zzz/kitcheck/sheet/groupA.ts`. Every entry answers the seven
    questions; tests check each quote is word for word in the game text and
    every kit piece is read.
  - The check (Part B, nine steps): `src/games/zzz/kitcheck/check.ts`. The
    method's worked examples are tests: Billy > Dialyn > Lucia = 9,
    Billy > Pan Yinhu > Lucia = 10, 9 ÷ 10 = 90% Excellent.
  - On the site (ZZZ): Kit check shows tags with the proving words underlined;
    team cards show synergy % with a tappable "Why" (every point with its quote);
    Ideas show real Line-ups and "If you pull…" %; the character page shows Who
    fits and what a missing agent adds; Characters → Sort → Best fit for me.
    Agents not read yet say "not rated yet" / "No data yet".
  - Open calls written down for the owner: `docs/logic/zzz-decisions.md`.
- 2026-10-10 · **SCHEDULER step 1: every time-gated list filled for HSR and ZZZ** (branch `scheduler/versions`).
  - Run again any time: `npm run data:nanoka`, then `npm run data:schedule` (in that order:
    the second one turns announced leaks into upcoming characters). Both only add or
    update; no id is ever removed.
  - **Versions** (HSR 26, ZZZ 19): start, maintenance length and end from the official
    update notices on hsr.hoyoverse.com / zenless.hoyoverse.com.
  - **Banners**: current, ended in the last 60 days, and announced phase-2 banners. Times
    from the in-game notice board when it names the banner (it wins over the wiki),
    otherwise from the wiki page, which links its official HoYoLAB post. Featured
    characters and Light Cones / W-Engines by the game's own ids.
  - **Events**: in-game, login (with day count), web and double-drop events, plus endgame
    cycles (HSR from the official notices, ZZZ from the wiki's cycle pages; a ZZZ cycle that
    has opened but has no page yet is added on the official two-week rhythm and printed).
    Rewards: premium currency summed from the wiki's reward tables or stated in the notice;
    pull items when an event gives no premium currency; `null` when only "Polychrome" is
    named without a number.
  - **Characters**: art and portrait for every character (nanoka; wiki copies of the
    official reveal art for announced agents nanoka has no picture of), release date for
    every released character (nanoka, else the wiki), leaks from nanoka's newer build
    (HSR: Aeon ★ Aha). Leaks named on an officially announced banner become upcoming
    characters (ZZZ: Phoenix 21 Oct, Severian 11 Nov).
  - **Backlog**: only the main story, chapters in order as steps (HSR 26, ZZZ 27);
    reward `null` (no source lists all chapter rewards).
  - **Game records**: endgame amounts per full clear (HSR 800 each, ZZZ Critical Node 780,
    Deadly Assault 300), ZZZ weekly 220, Bangboo Channel 1 % base, cycle start dates
    (all but Memory of Chaos, which runs 5 weeks then 6 this version). Sources in
    each contract's `sources` list.
  - Times: "server time" is stored at the Asia server (UTC+8), the earliest of all servers,
    so nothing shows as open after it closed. **For FRAME:** America and Europe see those
    ends 13 / 7 hours early; a per-server time would need a field on Banner/GameEvent.
  - **For FRAME:** Light Cone / W-Engine banners show no art (there is no weapon list
    with pictures); Today's banner tiles show art only for examples (`artFor` in
    Today.tsx); HSR collaboration warps (Fate) have no banner type, so they're left out;
    the endgame rows at the bottom of Events repeat "every N days" next to the real cycles.
  - Not filled yet because no source has it yet: ZZZ 3.3 banners and events (wiki pages
    and notices appear on 21 Oct), HSR 4.7 (not announced), rewards of events whose
    wiki pages only list item names.
- 2026-10-10 · **LOGIC-CORE step 1: ZZZ kit text, group A** (branch `logic-core/zzz-kits-group1`).
  - The owner's ZZZ method saved word for word: `docs/logic/zzz-method.md`.
  - `npm run data:kits` (`scripts/import-nanoka-kits.ts`) reads nanoka.cc
    (game data 3.3.4): profiles for all 62 agents (specialty, attribute, faction,
    assist type → `profiles.json`) and the full kit text for group A only:
    Starlight Billy, Dialyn, Lucia, Pan Yinhu (every skill, Core Passive at Core
    Skill level 7, Additional Ability, Mindscapes 1–6 → `kits.json`). Button
    icons and level formulas become plain words; unknown markup stops the script.
  - Kit check on those four agents' pages (and on teams with them) shows each
    piece with its game text, the source, and "Not read yet" until tags come.
  - Next: read group A into the cheat sheet (the seven questions, tags with
    quotes), then group B (needs Agent Potential reading, e.g. Lycaon).
- 2026-10-10 · **Live stamina, code login, roster leaks** (branch `frame/live-stamina`).
  - Today's stamina tiles read HoYoLAB for every game with a linked account
    (server or device): once on open, kept 5 minutes, counted forward only when
    the game record's rate agrees with HoYoLAB's "full in"; errors show the
    reason and Try again. Device-only copies keep "No data yet · Connect account".
  - Codes "login expired": the saved Star Rail code login mixed two HoYoverse
    accounts (account_id_v2 of the other saved account). The server now refuses
    such a code login and reports a saved one instead of sending it; the app
    checks account_id_v2 before saving, explains which three values to copy, and
    "Replace code login" opens the paste box. Needs the hoyolab and
    hoyolab-daily functions deployed; then paste fresh code logins for both.
  - Roster: "Show leaked" (off by default) for characters with a leak source,
    marked UNVERIFIED; wanted but never owned. Newest first stays the default.
- 2026-10-10 · **Owner console does real work** (branch `frame/owner-console`).
  - Lists tab: pick a game and a list (Events, Banners, Backlog, Characters,
    Versions), see the game files' items (LIST) and yours (OWNER); add, change,
    retire and bring back items. Saved to `catalog_items`; everyone sees it after
    reload. Every screen now reads lists through one wrapper (`withCatalog` in
    `src/main.tsx`), so people's own changes and hides still sit on top.
  - Findings: Approve adds a complete event, banner, character or leak to the
    list; an incomplete one opens the Lists form pre-filled. "Move back to new"
    retires it again.
  - Announcements tab (migration 0008, table `announcements`): write, schedule,
    end now. A strip shows at the top of the app; each person can hide one.
  - Overview: real numbers from `owner_stats()` (accounts, active in 7 days,
    HoYoLAB accounts, findings waiting, last run per job); "No data yet" if the
    call fails. Migration 0008 tested on local Postgres (non-owners can't write,
    everyone signed in reads, `owner_stats` refuses non-owners).
- 2026-10-10 · **Themes and background art** (branch `frame/themes`, not pushed).
  - Six themes in Account → Theme, each a full colour set plus its own art:
    Glacier (the old Dark, still the default), Candlelight (owner's palette A),
    Crimson Rose (palette B), Bifröst (starry night), Ascendant (light marble and
    gold) and Light. Cards with a live preview; applies at once; synced.
  - Background art drawn in code (wings, halo, rays, rings, runes, the nine
    worlds, ravens, thorns, roses, sigil, stars), behind the page, very faint.
    Tests check every theme's text contrast, including over the art.
  - Sidebar account row is now a profile card: your banner fading into the
    sidebar, a bigger picture, your name. Falls back to initials and the theme glow.
  - Account → Profile: the banner melts into the card and glows softly past it.
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
