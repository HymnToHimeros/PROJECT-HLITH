# PROJECT-HLITH · TASKS

MANAGER's list of the owner's open jobs. States: **sent** · **working** ·
**waiting on owner** · **blocked** · **live**. A job is live only after the chat
doing it said `LIVE`. Newest jobs at the bottom; live jobs move to Done.

## Open
| # | Job | Who | State | Note |
|---|---|---|---|---|
| T5 | HSR "Interastral Peace Gala" reward (starts 21 Oct) | SCHEDULER | blocked | Sources say 500 or 60; filled from the official notice when the event opens 21 Oct. |
| T7 | Research routine: several checks a week, more in first/last 2 weeks; self-adjusting | SCHEDULER | working | Daily 10:45 UTC trigger with start check (self-re-arm not possible); test delivered; #108 #111 merged. Hakushin gone (DNS), HSR second source DimbreathBot. First real run 14 Oct. |
| T8 | Live checks with real logins: HoYoLAB link, in-game history link, Assistant with own key | FRAME | waiting on owner | Needs the owner to sign in and try each. |
| T9 | Phone push keys (VAPID) so the evening message is really sent | FRAME | later | Owner: phone notifications are a task for the end. |
| T10 | Resend for sign-in mail at scale | FRAME | later | Owner: a last thing to add, low importance. |
| T11 | Finish account deletions after 30 days | FRAME | live | LIVE 2026-10-11: purge-accounts v1 active, migration 0013 applied, account-purge job daily (first run ok). |
| T13 | ZZZ 3.3 (21 Oct): event dates, A-rank featured agents, version end date | SCHEDULER | blocked | Nothing published yet; rerun `data:nanoka` + `data:schedule` on 21 Oct. |
| T14 | HSR 4.7 (starts 11 Nov): versions, banners, events | SCHEDULER | blocked | Waits for the announcement (special program around late Oct). |
| T55 | Go public: privacy policy + terms pages, links + not-affiliated notice, public homepage; then Google OAuth publish (owner steps), sign-in email at scale (T10), deletions (T11) | FRAME (+ owner) | working | #121 LIVE (pages static, 200 without sign-in). #121 merged: /about /privacy /terms, Discord-first sign-in (Google/email greyed, tester unlock), purge after 30 days, backups 30 days. Contact email received (hlidskjalf.contact@gmail.com), sent to FRAME to fill in. Google published by owner 2026-10-11 (In production, basic scopes only); #123 merged: contact email on pages, Google button on for everyone, privacy Google section, LICENSE. LIVE 2026-10-11 (verified: contact email on all 3 pages; owner tested Google sign-in with several accounts). Discord app has terms/privacy links (no verify needed). Left: domain + Resend later. |
| T56 | Tight licence: LICENSE "All rights reserved" (view only as GitHub requires; no copying/hosting/derivatives/AI training; names + emblem protected), package.json, copyright footer, docs/COPYRIGHT.md takedown templates | FRAME | live | Owner 2026-10-11: repo stays public (Actions minutes). Add contact email hlidskjalf.contact@gmail.com to LICENSE. |
| T57 | Owner checklist on PC: new email made (hlidskjalf.contact@gmail.com, FRAME fills it in); move GitHub/Cloudflare/Supabase/Discord/Google Cloud to it; GitHub protection (secret scanning + push protection, Dependabot alerts, main branch rule, private vulnerability reporting); Google OAuth publish later | owner + MANAGER | working | 2026-10-11: accounts moved, Google published, Discord app links set, Code security on (alerts, security updates, secret scanning, push protection), ruleset "protect main" (default branch only: no deletions, no force push, check required, no approvals). #122 merged under the ruleset OK. Data refresh auto-merge needs T59. |
| T58 | Help to push HLITH into the public eye (TikTok, showcase, posts) | MANAGER | later | Owner will ask. |
| T59 | Data refresh auto-merge blocked by the ruleset (a check from workflow_dispatch does not count for the PR; #124 refused with "check is expected") | SCHEDULER + owner | live | #122 merged (dispatch approach, not enough). #125 merged (uses the token, falls back to waiting for MANAGER). Fix: owner makes a fine-grained token, repo secret DATA_REFRESH_TOKEN; SCHEDULER switches data-refresh.yml to it. #124 (2 ZZZ events, green) waits. Owner added the token 2026-10-11 (no expiry); Test run 38149552920: PR CI ran on pull_request, check counted, #124 merged itself 15:15 UTC. Fully automatic again. |
| T60 | Community groundwork: real server-side tester role, invite links, owner Members panel, tester-only Community placeholder page (owner, 2026-10-11: "only want the frame for it build until we actual flesh it out i want some members first") + Users panel (owner, 2026-10-11: "see who also joined ... instant ban/remove or silence ... not iron fist but as option"): all accounts (no emails), silence/ban (timed or permanent)/remove (= ban + 30-day purge, undo), action log, Terms + Privacy text | FRAME | live | #126 LIVE (members, invites, Community page; 0014 applied, functions deployed). #127 merged (Users + moderation, banned users can still export; storage + jobs covered). LIVE 2026-10-11 16:50 (0015 applied, 10 functions redeployed). |
| T61 | Community, full version (PLANNED, after first members): own invite-only Discord server embedded in HLITH (WidgetBot: full page and/or chat bubble), share teams/builds/pulls to Discord with verified mark, leaderboards, polls, profiles; Discord Linked Roles (tester, earned picture rights from HLITH or Discord activity), HLITH bot with slash commands; moderation via Discord AutoMod + bots; later maybe own chat screen. Names still open (offered: Bifröst, The Ravens, Althing, Einherjar for testers, Yggdrasil; owner: "none hit" for Mead Hall/Valhalla) | MANAGER + FRAME | later | Open: owner Discord server? full page / bubble? earned pictures from Discord or HLITH activity? name. |
| T62 | First-run gate: accept Terms + Privacy (required checkbox) and choose a unique username before using the app; re-prompt on new terms version; existing accounts once (owner, 2026-10-11) | FRAME | live | #129 merged (owner shown screens; mod = whole word; owner exempt from reserved names). LIVE 2026-10-11 23:19 (0016 applied, functions redeployed). |
| T63 | New games feasibility: Genshin Impact, Wuthering Waves, Arknights: Endfield (pull history, live data, data sources, kits/teams/builds, effort, order) | SCHEDULER + LOGIC-CORE | later (LAST task) | LOGIC-CORE note in (WuWa → GI → Endfield; WuWa closest to ZZZ; GI needs reactions layer + build source decision; Endfield no data source yet). Full report merged #128 (docs/research/2026-10-11-new-games.md). Owner decisions later: order (data: GI first; logic: WuWa first), GI build source + reaction numbers, Endfield history rule. Owner 2026-10-11: "the new games is a last last task". |
| T64 | Profile customization (showcase, earned titles, frames, name styles, badge shelf, stats card, bio + favourite game, background, privacy switches) + option sheets: app icon (6–8), owner badge, owner frame, owner name style (owner ones animated). Owner 2026-10-11: "I do want the ones for me animated ... everything else I agree" | FRAME | B1 #130 + B2 #135 live; variants: owner 2026-10-12 "the vairants are all good" -> build all A-E for sets 1-8 (frame/t64-variants, after #137) | Owner kept all (badges 0–8, frames 1–20, names 1–20, icon + jobs, full sets). Frame 16: keep ALL 5 (A–E). Owner: 5 frame + 5 name variants for EVERY set (sheets first). Picker: one tile per set, tap opens its 5 variants (pop-out/bottom sheet). Owner look visible to everyone. B1 #130 merged (2c5a9fa; frame 16 = 5 variants A–E; look visible to others on the card). B2 #135 LIVE (0018 applied; profile parts for everyone + grouped picker). T70 #134 LIVE. Variant sheets sets 1–8 sent to owner, picks pending. T67 building. |
| T65 | Owner makes TikTok + Discord server; then add links (About, footer, Community page) | owner | waiting on owner | |
| T66 | Main red: calendar on PC has sideways scroll (33 px, date-dependent: last week label past the edge); 3 e2e fail | ERROR-FIX | live (#131 merged 9165212) | Fix: .scroller overflow-x: clip (PC block, calendar.module.css). FRAME ports the same line into #130. |
| T67 | Owner panel "Rewards": grant exclusive badges/frames/name styles for events (to users or via claim link/code, expiry, revoke, logged); owner items never grantable; server-enforced ownership (owner, 2026-10-12) | FRAME | LIVE: merged #136 (e1aa0ad), 0019 applied, RLS checked | After T64 variants. Screenshots before merge. |
| T68 | CodeQL: 24 High alerts on main: #22 HoYoLAB login stored in clear in localStorage (hoyolab.ts:79); ~23 incomplete HTML sanitization (app + import scripts). Not Copilot Autofix: ERROR-FIX fixes + tests | ERROR-FIX | merged #132 (7a2dd99); owner saw 8 still open (#1-4 ci.yml permissions, #5/#6 DOM-as-HTML ImageAdjust/Scan, #23/#24 regex range importGuides) -> ERROR-FIX round 2, errorfix/t68-codeql-remaining | Migrate stored logins without losing links; one shared sanitize helper. |
| T69 | Assistant fails on every message: Anthropic API answers 400 ("Claude could not read this request"); find the real reason (likely low credit or a bad param), log error type/message (never the key), map 400s to clear texts, fix params if ours | ERROR-FIX | live | ROOT CAUSE (MANAGER reproduced with owner test key): strict tools reject "minimum" → 400 on every request. Fix: drop minimum + schema test. Owner: test key is for MANAGER to test with; never passed to chats or files. LIVE 2026-10-12: assistant v105 deployed 01:24; MANAGER sent main's exact request for Opus, Sonnet, Haiku with the test key: all 200. |
| T70 | Pulls → Planner banner cards: show banner art (featured + 4★ like the Banners module), sections Now / Next / Later, art leads + numbers under; fix "1 rows" plural (owner, 2026-10-12) | FRAME | live (#134 merged cc19ccf, Banners column layout, shared PhaseBoard) | After B2, before variant sheets. Screenshots before merge. |
| T71 | Assistant: propose adding backlog items (approve/undo) + attach .json/.md/.txt/.csv (+pdf) files as document blocks, never stored; UIGF/SRGF JSON → offer History import (owner, 2026-10-12) | FRAME | merged #137 (9dda22a); deploy HELD: live test 400 'compiled grammar is too large' on Opus/Sonnet with web search -> T72 | After/alongside T67. Deploy assistant after merge; MANAGER live test. |
| T72 | Assistant 400 after #137: Opus/Sonnet + web search (default on) -> 'compiled grammar is too large' (3 new strict backlog tools). Found by MANAGER live test | ERROR-FIX | working (errorfix/t72-assistant-grammar) | Fewer/looser strict tools, cards validate; test pins strict count; errorText maps it. MANAGER live-tests before merge; FRAME deploys after. |

## Done
| # | Job | Who | Live on |
|---|---|---|---|
| T39 | Leaked characters in teams + "If you pull" for leaks, marked "? UNVERIFIED", follows Show leaked / Hide leaks (#87 rules, #89 screens) | LOGIC-CORE + FRAME | 2026-10-10/11 |
| T35 | Target stats card on the character page: you vs target, game quote + working, totals by hand or scan (#86 rules, #88 screens) | LOGIC-CORE + FRAME | 2026-10-10/11 |
| T33 | Blind test checked by LOGIC-CORE against game lists + owner teams: 3 match, 4 mostly (sustain slot swapped for damage, newer characters), Feixiao 1 of 3 (explained from kits) | LOGIC-CORE | 2026-10-10/11 |
| T34 | Switch in Roster → Teams: assume signature + average build when none is saved (#84 rules, #85 switch) | LOGIC-CORE + FRAME | 2026-10-10/11 |
| T37 | BUG fixed: typing in the build form (and every pop-up form) keeps the cursor in the field (#83) | ERROR-FIX | 2026-10-10/11 |
| T36 | README made attractive for public visitors (#82) | FRAME | 2026-10-10/11 |
| T6 | Keep the game lists current on a schedule | SCHEDULER | 2026-10-10/11 |
| T15 | HSR leak "Nihilux": confirm official name | SCHEDULER | 2026-10-10/11 |
| T18 | Make my own teams (pick the members myself, get them scored) | FRAME leads, LOGIC-CORE scores | 2026-10-10/11 |
| T28 | Standing rule: every logic rule is the same in HSR and ZZZ, except game-specific facts; ZZZ counts builds like HSR | LOGIC-CORE | 2026-10-10/11 |
| T30 | HSR scoring still doesn't understand kits (owner's own Aventurine • Waveflair team 47%, "best" again Tingyun + Sparkle). Owner: teams do NOT need a sustain/healer. Wants scoring that understands buff size, conditions, how kits interact | LOGIC-CORE | 2026-10-10/11 |
| T38 | ZZZ teams: two supports doing the same job (Lucia + Pan Yinhu for Starlight Billy) scored above a complementary team (Dialyn + Lucia). Scoring must handle overlap and role coverage | LOGIC-CORE | 2026-10-10/11 |
| T40 | Recommended teams wrong while My teams scores right (Phainon: only Cerydra + Cyrene + Dan Heng PT at 36%). Same scoring for both; check every recommended team in both games is up to date | LOGIC-CORE | 2026-10-10/11 |
| T41 | Carries who sustain themselves (Aventurine • Waveflair) free the sustain slot; "Best found from your characters" card when a card is under 90% | LOGIC-CORE (+ FRAME OK on Teams.tsx) | 2026-10-10/11 |
| T42 | Character page "Builds their teams want": refresh on switches/team lists/leaks; use the members the card shows | LOGIC-CORE | 2026-10-10/11 |
| T43 | Leak kit sheets go "stale" (not scored, says so) when the beta kit text changes; data updates not blocked | LOGIC-CORE | 2026-10-10/11 |
| T44 | Roster: leaked characters (any source) always at the top, newest first | FRAME | 2026-10-10/11 |
| T45 | Installable app on phone + PC (PWA: manifest, icons, offline, Update ready, install hint) | FRAME | 2026-10-10/11 |
| T46 | BUG: findings-intake answers 401 to the Data refresh Action and to the routine's proxy key | ERROR-FIX | 2026-10-10/11 |
| T47 | More themes (3 public) + owner-only BL themes: private bucket, owner-only loading, upload a picture per theme | FRAME | 2026-10-10/11 |
| T48 | BUG: leak tiles in Roster had a "? UNVERIFIED" tag + source text under the tile | ERROR-FIX | 2026-10-10/11 |
| T49 | BUG: banner card art cropped badly (legs, weapon parts); art must fit each frame on its own, both games | ERROR-FIX | 2026-10-10/11 |
| T50 | App feels fluid (page/tab transitions, hover/press, toasts, sliders) + every theme gets a small signature animation like Glacier's spinning emblem; Animations on/reduced/off switch; reduced-motion respected | FRAME | 2026-10-10/11 |
| T51 | Outsider test of the live site: new test account, fill everything, use every function (PC + phone), fix every error found, one final report | ERROR-FIX | 2026-10-10/11 |
| T52 | Customise everything (look, layout, roster, banners/calendar, formats, feedback; one Customise hub) + profile and badges; unique owner badge ("above the high seat, watching from the sky"), lore badge for all, earned badges from real data only | FRAME | 2026-10-10/11 |
| T53 | Standard 5★ pools for HSR + ZZZ (historyMapping.standardTop) so the Luck report can tell 50/50 wins from losses | SCHEDULER | 2026-10-10/11 |
| T54 | Build score card said "no recommended build" when the build just has too few parts (Kafka); fix wording + test all released have builds; beta builds for Severian/Phoenix marked "beta, may change" | LOGIC-CORE | 2026-10-10/11 |
| T29 | HSR teams: only each carry's own game team (#75), owner-editable team lists with reset (#81) | LOGIC-CORE + FRAME | 2026-10-10 |
| T32 | Nihilux in HSR Roster as a leak character (#79) | SCHEDULER | 2026-10-10 |
| T27 | Pick your Trailblazer; their entries auto-marked owned (#72) | FRAME | 2026-10-10 |
| T31 | Owner's Gmail removed from git history (76 → 0, all branches) | owner + MANAGER | 2026-10-10 |
| T12 | HoYoLAB linked and working: HSR Main (EU, lv 68) and ZZZ MAIN (EU, lv 56), check-ins claimed; first automatic check-in shows tomorrow | owner + FRAME | 2026-10-10 |
| T17 | Teams explain themselves in plain words (PR #61) | LOGIC-CORE | 2026-10-10 |
| T20 | Calmer Calendar, Events, Today, Backlog (PRs #63–#66) | FRAME | 2026-10-10 |
| T21 | Banners as a timeline board, every banner a big card (PR #68) | FRAME | 2026-10-10 |
| T26 | Builds a team wants, both games (PR #73) | LOGIC-CORE | 2026-10-10 |
| T16 | Live banner art the same size (PR #56) | FRAME | 2026-10-10 |
| T22 | Dailies tick from HoYoLAB, strict (PR #56) | FRAME | 2026-10-10 |
| T19 | HSR teams from the game's real teams (PR #60) | LOGIC-CORE | 2026-10-10 |
| T24 | Repo tidy, docs index, README (PR #57) | FRAME | 2026-10-10 |
| T23 | 8 new themes (PR #58) | FRAME | 2026-10-10 |
| T2 | MANAGER and ERROR-FIX chats (PR #51) | FRAME | 2026-10-10 |
| T3 | Build score (PR #55): character page → Build score card, graded against the game's own build, with Why | LOGIC-CORE | 2026-10-10 |
| T25 | MANAGER approves and merges every PR (PR #54) | MANAGER | 2026-10-10 |
| T4 | HSR character EXP in Farm and "Materials to max" (PR #53) | LOGIC-CORE | 2026-10-10  |
| T1 | Save a build per character (PR #50): character page → Build score → "Enter build" | FRAME | 2026-10-10 |
