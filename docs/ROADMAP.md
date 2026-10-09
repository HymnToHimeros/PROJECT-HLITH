# PROJECT-HLITH · ROADMAP

Everything HLIÐSKJÁLF needs before it's finished, in build order.

**This list checks itself off.** Each item names the file(s) that prove it's
done. `npm run roadmap` ticks a box when all of its proof files exist and
unticks it if one goes missing. The build fails if this page is out of date,
so it can't drift from the real code. Never tick a box by hand; add the proof.

★ = new screen with no design yet: shown to you before moving on (CLAUDE.md Override 5).
Who builds what: see `docs/WORKSTREAMS.md`.

<!-- roadmap:summary -->
**26 of 61 done** `█████████░░░░░░░░░░░` 43%

**Next up:** R24 Nightly backups

| Phase | Progress | Done |
|---|---|---|
| Phase 0 · Foundation | `██████████` | 5 / 5 |
| Phase 1 · Look | `██████████` | 3 / 3 |
| Phase 2 · Skeleton | `██████████` | 11 / 11 |
| Phase 3 · Accounts and data | `████████░░` | 4 / 5 |
| Phase 4 · Engines | `█████░░░░░` | 2 / 4 |
| Phase 5 · Modules | `░░░░░░░░░░` | 0 / 17 |
| Phase 6 · Connections and extras | `░░░░░░░░░░` | 0 / 13 |
| Phase 7 · Launch | `███░░░░░░░` | 1 / 3 |
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
- [ ] R24 Nightly backups · proof: `supabase/functions/backup/index.ts`

## Phase 4 · Engines
- [x] R25 One pull budget engine · proof: `src/tools/budget/budget.ts`
- [x] R26 Pity engine: official and community odds, worst case · proof: `src/tools/pity/pity.ts`
- [ ] R27 History import from UIGF / SRGF files · proof: `src/tools/import/uigf.ts`
- [ ] R28 History import from the in-game link · proof: `supabase/functions/gacha-import/index.ts`

## Phase 5 · Modules
- [ ] R29 Events (open / done / skipped, login days) · proof: `src/tools/events/Events.tsx`
- [ ] R30 Backlog (categories, rewards, switches) · proof: `src/tools/backlog/Backlog.tsx`
- [ ] R31 Pulls · Bank log · proof: `src/tools/pulls/BankLog.tsx`
- [ ] R32 Pulls · Calculator · proof: `src/tools/pulls/Calculator.tsx`
- [ ] R33 Pulls · Planner · proof: `src/tools/pulls/Planner.tsx`
- [ ] R34 Pulls · History with Luck report card · proof: `src/tools/pulls/History.tsx`, `src/tools/pulls/LuckReport.tsx`
- [ ] R35 Roster · Characters grid · proof: `src/tools/roster/Characters.tsx`
- [ ] R36 Roster · Character page · proof: `src/tools/roster/CharacterPage.tsx`
- [ ] R37 Roster · Teams tab · proof: `src/tools/roster/Teams.tsx`
- [ ] R38 Kit check (any game with kit data) · proof: `src/tools/roster/KitCheck.tsx`
- [ ] R39 Banners (fit, leaks, plan pulls) · proof: `src/tools/banners/Banners.tsx`
- [ ] R40 Farm (materials, stamina plan, gear) · proof: `src/tools/farm/Farm.tsx`
- [ ] R41 Calendar · proof: `src/tools/calendar/Calendar.tsx`
- [ ] R42 Today · proof: `src/tools/today/Today.tsx`
- [ ] R43 ★ Today · tonight's run · proof: `src/tools/today/TonightsRun.tsx`
- [ ] R44 ★ Today · wishlist · proof: `src/tools/today/Wishlist.tsx`
- [ ] R45 Intel · proof: `src/tools/intel/Intel.tsx`

## Phase 6 · Connections and extras
- [ ] R46 ★ Edit mode (my own events, banners, backlog items) · proof: `src/tools/edit-mode/EditMode.tsx`
- [ ] R47 ★ HoYoLAB link (stamina, check-in, characters, endgame) · proof: `src/tools/account-links/LinkAccount.tsx`, `supabase/functions/hoyolab/index.ts`
- [ ] R48 ★ Assistant: own key, chat, cost per message · proof: `src/tools/assistant/Assistant.tsx`, `supabase/functions/assistant/index.ts`
- [ ] R49 ★ Assistant proposals with approve / undo · proof: `src/tools/assistant/Proposals.tsx`
- [ ] R50 ★ Screenshot scan of a character screen · proof: `src/tools/scan/Scan.tsx`
- [ ] R51 ★ Evening message as phone notification · proof: `supabase/functions/evening-message/index.ts`
- [ ] R52 ★ Calendar feed · proof: `supabase/functions/ics-feed/index.ts`
- [ ] R53 ★ Evening message and calendar feed settings · proof: `src/tools/feeds/FeedSettings.tsx`
- [ ] R54 ★ Share a team · proof: `src/tools/share/ShareTeam.tsx`
- [ ] R55 ★ Setup checklist and Guide · proof: `src/tools/account/SetupChecklist.tsx`, `src/tools/account/Guide.tsx`
- [ ] R56 ★ Export my data · proof: `supabase/functions/export-data/index.ts`
- [ ] R57 ★ Delete my account · proof: `supabase/functions/delete-account/index.ts`
- [ ] R58 Owner console · proof: `src/tools/owner/OwnerConsole.tsx`

## Phase 7 · Launch
- [ ] R59 Accessibility and phone pass · proof: `tests/e2e/accessibility.spec.ts`
- [x] R60 Live on the web (Cloudflare Pages) · proof: `docs/DEPLOY.md`
- [ ] R61 Light theme (after it's designed) · proof: `src/core/theme/tokens-light.css`
