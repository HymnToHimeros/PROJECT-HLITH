# PROJECT-HLITH · ROADMAP

Everything HLIÐSKJÁLF needs before it's finished, in build order.

**This list checks itself off.** Each item names the file(s) that prove it's
done. `npm run roadmap` ticks a box when all of its proof files exist and
unticks it if one goes missing. The build fails if this page is out of date,
so it can't drift from the real code. Never tick a box by hand; add the proof.

★ = new screen with no design yet: shown to you before moving on (CLAUDE.md Override 5).
Who builds what: see `docs/WORKSTREAMS.md`.

<!-- roadmap:summary -->
**70 of 77 done** `██████████████████░░` 91%

**Next up:** R67 The HLIÐSKJÁLF Discord inside the Community page (WidgetBot)

| Phase | Progress | Done |
|---|---|---|
| Phase 0 · Foundation | `██████████` | 5 / 5 |
| Phase 1 · Look | `██████████` | 3 / 3 |
| Phase 2 · Skeleton | `██████████` | 11 / 11 |
| Phase 3 · Accounts and data | `██████████` | 5 / 5 |
| Phase 4 · Engines | `██████████` | 4 / 4 |
| Phase 5 · Modules | `██████████` | 17 / 17 |
| Phase 6 · Connections and extras | `██████████` | 17 / 17 |
| Phase 7 · Launch | `██████████` | 6 / 6 |
| Phase 8 · Community (planned: the owner wants members first) | `██░░░░░░░░` | 2 / 9 |
<!-- /roadmap:summary -->

## Phase 0 · Foundation
- [x] R01 Plan and progress files · proof: `docs/PLAN.md`, `docs/PROGRESS.md`
- [x] R02 Project setup and online checks (CI) · proof: `package.json`, `.github/workflows/ci.yml`
- [x] R03 Structure test: core/ and tools/ never import games/ · proof: `tests/architecture.test.ts`
- [x] R04 Never-wipe test for database changes · proof: `tests/migrations.test.ts`
- [x] R05 Self-checking roadmap and workstreams · proof: `scripts/roadmap.ts`, `tests/roadmap.test.ts`, `docs/WORKSTREAMS.md`

## Phase 1 · Look
- [x] R06 Colour, type and spacing tokens (ink.5 lightened) · proof: `src/core/theme/tokens.css`
- [x] R07 Shared components (stat tile, progress bar, no data yet…) · proof: `src/core/ui/index.ts`
- [x] R08 Component preview page · proof: `src/core/ui/Preview.tsx`

## Phase 2 · Skeleton
- [x] R09 Game contract (the shape every game fills in) · proof: `src/core/contract/game-contract.ts`
- [x] R10 Module, feature and game registries · proof: `src/core/registry/modules.ts`, `src/core/registry/features.ts`, `src/core/registry/games.ts`
- [x] R11 Layout rules (order, hidden, phone bar, All games) · proof: `src/core/registry/layout.ts`
- [x] R12 Game template folder · proof: `src/games/_template/contract.ts`
- [x] R13 Honkai: Star Rail record · proof: `src/games/hsr/contract.ts`
- [x] R14 Zenless Zone Zero record · proof: `src/games/zzz/contract.ts`
- [x] R15 Made-up test game proves new games need no core change · proof: `tests/fixtures/fake-game/contract.ts`
- [x] R16 Server resets, local time, local date and number formats · proof: `src/core/time/reset.ts`
- [x] R17 Shell: PC sidebar, phone bars, More sheet, game switcher · proof: `src/core/shell/Shell.tsx`
- [x] R18 Edit layout (drag, hide, restore, reset) · proof: `src/core/shell/EditLayout.tsx`
- [x] R19 Server picker per game · proof: `src/core/shell/ServerPicker.tsx`

## Phase 3 · Accounts and data
- [x] R20 Database tables with per-user walls · proof: `supabase/migrations/0001_init.sql`
- [x] R21 Login: Google, Discord, email link · proof: `src/core/auth/SignIn.tsx`
- [x] R22 Local copy and sync status · proof: `src/core/data/sync.ts`
- [x] R23 Built-in lists that never touch your progress · proof: `src/core/data/catalog.ts`
- [x] R24 Nightly backups · proof: `supabase/functions/backup/index.ts`

## Phase 4 · Engines
- [x] R25 One pull budget engine · proof: `src/tools/budget/budget.ts`
- [x] R26 Pity engine: official and community odds, worst case · proof: `src/tools/pity/pity.ts`
- [x] R27 History import from UIGF / SRGF files · proof: `src/tools/import/uigf.ts`
- [x] R28 History import from the in-game link · proof: `supabase/functions/gacha-import/index.ts`

## Phase 5 · Modules
- [x] R29 Events (open / done / skipped, login days) · proof: `src/tools/events/Events.tsx`
- [x] R30 Backlog (categories, rewards, switches) · proof: `src/tools/backlog/Backlog.tsx`
- [x] R31 Pulls · Bank log · proof: `src/tools/pulls/BankLog.tsx`
- [x] R32 Pulls · Calculator · proof: `src/tools/pulls/Calculator.tsx`
- [x] R33 Pulls · Planner · proof: `src/tools/pulls/Planner.tsx`
- [x] R34 Pulls · History with Luck report card · proof: `src/tools/pulls/History.tsx`, `src/tools/pulls/LuckReport.tsx`
- [x] R35 Roster · Characters grid · proof: `src/tools/roster/Characters.tsx`
- [x] R36 Roster · Character page · proof: `src/tools/roster/CharacterPage.tsx`
- [x] R37 Roster · Teams tab · proof: `src/tools/roster/Teams.tsx`
- [x] R38 Kit check (any game with kit data) · proof: `src/tools/roster/KitCheck.tsx`
- [x] R39 Banners (fit, leaks, plan pulls) · proof: `src/tools/banners/Banners.tsx`
- [x] R40 Farm (materials, stamina plan, gear) · proof: `src/tools/farm/Farm.tsx`
- [x] R41 Calendar · proof: `src/tools/calendar/Calendar.tsx`
- [x] R42 Today · proof: `src/tools/today/Today.tsx`
- [x] R43 ★ Today · tonight's run · proof: `src/tools/today/TonightsRun.tsx`
- [x] R44 ★ Today · wishlist · proof: `src/tools/today/Wishlist.tsx`
- [x] R45 Intel · proof: `src/tools/intel/Intel.tsx`

## Phase 6 · Connections and extras
- [x] R46 ★ Edit mode (my own events, banners, backlog items) · proof: `src/tools/edit-mode/EditMode.tsx`
- [x] R47 ★ HoYoLAB link (stamina, check-in, characters, endgame) · proof: `src/tools/account-links/LinkAccount.tsx`, `supabase/functions/hoyolab/index.ts`
- [x] R48 ★ Assistant: own key, chat, cost per message · proof: `src/tools/assistant/Assistant.tsx`, `supabase/functions/assistant/index.ts`
- [x] R49 ★ Assistant proposals with approve / undo · proof: `src/tools/assistant/Proposals.tsx`
- [x] R50 ★ Screenshot scan of a character screen · proof: `src/tools/scan/Scan.tsx`
- [x] R51 ★ Evening message as phone notification · proof: `supabase/functions/evening-message/index.ts`
- [x] R52 ★ Calendar feed · proof: `supabase/functions/ics-feed/index.ts`
- [x] R53 ★ Evening message and calendar feed settings · proof: `src/tools/feeds/FeedSettings.tsx`
- [x] R54 ★ Share a team · proof: `src/tools/share/ShareTeam.tsx`
- [x] R55 ★ Setup checklist and Guide · proof: `src/tools/account/SetupChecklist.tsx`, `src/tools/account/Guide.tsx`
- [x] R56 ★ Export my data · proof: `supabase/functions/export-data/index.ts`
- [x] R57 ★ Delete my account · proof: `supabase/functions/delete-account/index.ts`
- [x] R58 Owner console · proof: `src/tools/owner/OwnerConsole.tsx`
- [x] R62 ★ HoYoLAB: several accounts, one import and scan button, automatic daily check-in and codes · proof: `supabase/migrations/0003_hoyolab_links.sql`, `supabase/functions/hoyolab-daily/index.ts`, `src/tools/account-links/accounts.ts`, `tests/hoyolabAuto.test.ts`
- [x] R63 ★ Scheduler frame: one cron job runs every fixed job, findings inbox for the external routine, Owner console Scheduler and Findings tabs · proof: `supabase/functions/scheduler/index.ts`, `supabase/functions/findings-intake/index.ts`, `src/tools/owner/Scheduler.tsx`, `src/tools/owner/Findings.tsx`
- [x] R64 Time-gated lists for HSR and ZZZ (versions, banners, events, endgame, main story, release dates, art, leaks) with sources · proof: `scripts/import-schedule.ts`, `scripts/schedule/text.ts`, `scripts/schedule/wiki.ts`, `tests/scheduleImport.test.ts`
- [x] R65 ★ Owner console tools: edit the built-in lists for everyone, approved findings go into the lists, announcements, real numbers · proof: `src/tools/owner/Lists.tsx`, `src/tools/owner/Announcements.tsx`, `src/core/shell/AnnouncementStrip.tsx`, `supabase/migrations/0008_owner_console.sql`, `src/tools/owner/Lists.live.test.tsx`

## Phase 7 · Launch
- [x] R59 Accessibility and phone pass · proof: `tests/e2e/accessibility.spec.ts`
- [x] R60 Live on the web (Cloudflare Pages) · proof: `docs/DEPLOY.md`
- [x] R61 Light theme (after it's designed) · proof: `src/core/theme/tokens-light.css`
- [x] R75 ★ First run: accept the Terms and Privacy policy, choose a username (unique, reserved names refused, change once every 30 days) · proof: `supabase/migrations/0016_first_run.sql`, `src/core/auth/FirstRun.tsx`, `src/tools/account/UsernameCard.tsx`, `tests/firstRun.test.ts`
- [x] R76 ★ The owner's look: owner badges 0–8, frames 1–20, name styles 1–20, eight full sets with “Wear full set” (owner only, animated) · proof: `src/tools/account/ownerArt/art.ts`, `src/tools/account/ownerArt/OwnerLookEditor.tsx`, `supabase/migrations/0017_owner_look.sql`, `tests/ownerLook.test.ts`
- [x] R77 ★ Profile customization: pull numbers, luckiest pull, best team, badge shelf, earned titles, favourite game, card background, bio switch, slur check, silenced lock · proof: `src/tools/account/cardExtras.ts`, `src/tools/account/titles.ts`, `supabase/migrations/0018_card_extras.sql`, `tests/cardExtras.test.ts`

## Phase 8 · Community (planned: the owner wants members first)
- [x] R66 ★ Community groundwork: tester role on the server, one-time invite links, Owner console → Members, members-only Community page · proof: `supabase/migrations/0014_community_members.sql`, `src/tools/community/CommunityPage.tsx`, `src/tools/owner/Members.tsx`, `tests/community.test.ts`
- [x] R74 ★ Owner console → Users: everyone who joined (no emails), silence, ban, remove with undo, action log · proof: `supabase/migrations/0015_moderation.sql`, `src/core/auth/Suspended.tsx`, `src/tools/owner/Users.tsx`, `tests/moderation.test.ts`
- [ ] R67 The HLIÐSKJÁLF Discord inside the Community page (WidgetBot) · proof: `src/tools/community/DiscordEmbed.tsx`
- [ ] R68 Share to Discord: cards for teams, pulls and profiles · proof: `src/tools/community/ShareToDiscord.tsx`
- [ ] R69 Discord Linked Roles from HLITH (tester, badges) · proof: `supabase/functions/discord-linked-roles/index.ts`
- [ ] R70 HLITH bot for the community server · proof: `supabase/functions/discord-bot/index.ts`
- [ ] R71 Earned picture rights (upload rights unlocked by taking part) · proof: `src/tools/community/PictureRights.tsx`
- [ ] R72 Leaderboards (opt-in) · proof: `src/tools/community/Leaderboards.tsx`
- [ ] R73 Polls · proof: `src/tools/community/Polls.tsx`
