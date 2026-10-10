# PROJECT-HLITH · TASKS

MANAGER's list of the owner's open jobs. States: **sent** · **working** ·
**waiting on owner** · **blocked** · **live**. A job is live only after the chat
doing it said `LIVE`. Newest jobs at the bottom; live jobs move to Done.

## Open
| # | Job | Who | State | Note |
|---|---|---|---|---|
| T39 | Leaked characters in teams + "If you pull" for leaks, marked "? UNVERIFIED", follows Show leaked / Hide leaks (#87 rules, #89 screens) | LOGIC-CORE + FRAME | 2026-10-10 |
| T35 | Target stats card on the character page: you vs target, game quote + working, totals by hand or scan (#86 rules, #88 screens) | LOGIC-CORE + FRAME | 2026-10-10 |
| T33 | Blind test checked by LOGIC-CORE against game lists + owner teams: 3 match, 4 mostly (sustain slot swapped for damage, newer characters), Feixiao 1 of 3 (explained from kits) | LOGIC-CORE | 2026-10-10 |
| T34 | Switch in Roster → Teams: assume signature + average build when none is saved (#84 rules, #85 switch) | LOGIC-CORE + FRAME | 2026-10-10 |
| T37 | BUG fixed: typing in the build form (and every pop-up form) keeps the cursor in the field (#83) | ERROR-FIX | 2026-10-10 |
| T36 | README made attractive for public visitors (#82) | FRAME | 2026-10-10 |
| T5 | HSR "Interastral Peace Gala" reward (starts 21 Oct) | SCHEDULER | blocked | Sources say 500 or 60; filled from the official notice when the event opens 21 Oct. |
| T6 | Keep the game lists current on a schedule | SCHEDULER | later | Owner: a task for the end, when everything else is done. |
| T7 | Schedules for the research routine (leaks, events, game data) | SCHEDULER | later | Owner: a task for the end. |
| T8 | Live checks with real logins: HoYoLAB link, in-game history link, Assistant with own key | FRAME | waiting on owner | Needs the owner to sign in and try each. |
| T9 | Phone push keys (VAPID) so the evening message is really sent | FRAME | later | Owner: phone notifications are a task for the end. |
| T10 | Resend for sign-in mail at scale | FRAME | later | Owner: a last thing to add, low importance. |
| T11 | Finish account deletions after 30 days | FRAME | sent | Listed as "later" in PROGRESS.md. |
| T13 | ZZZ 3.3 (21 Oct): event dates, A-rank featured agents, version end date | SCHEDULER | blocked | Nothing published yet; rerun `data:nanoka` + `data:schedule` on 21 Oct. |
| T14 | HSR 4.7 (starts 11 Nov): versions, banners, events | SCHEDULER | blocked | Waits for the announcement (special program around late Oct). |
| T15 | HSR leak "Nihilux": confirm official name | SCHEDULER | blocked | Probably Aeon ★ Aha (already marked as a leak); confirm when announced. |
| T18 | Make my own teams (pick the members myself, get them scored) | FRAME leads, LOGIC-CORE scores | working | LIVE: My teams picker (#59), account suggestions (#67), signature weapons (#69), build wants (#73). Next: every equipped weapon (#74). |
| T28 | Standing rule: every logic rule is the same in HSR and ZZZ, except game-specific facts; ZZZ counts builds like HSR | LOGIC-CORE | working | In #73 (ZZZ counts builds like HSR; standing mirror rule in decisions files). |
| T30 | HSR scoring still doesn't understand kits (owner's own Aventurine • Waveflair team 47%, "best" again Tingyun + Sparkle). Owner: teams do NOT need a sustain/healer. Wants scoring that understands buff size, conditions, how kits interact | LOGIC-CORE | live | Kit-number scoring (#90) + Phainon/Dan Heng PT Bondmate in his domain (#91, owner's rule). All 3 owner teams best found. |
| T38 | ZZZ teams: two supports doing the same job (Lucia + Pan Yinhu for Starlight Billy) scored above a complementary team (Dialyn + Lucia). Scoring must handle overlap and role coverage | LOGIC-CORE | working | Covered by T30. Owner: no "Stun needed" rule (Anomaly teams want none); roles needed only when the carry\'s kit asks. |
| T40 | Recommended teams wrong while My teams scores right (Phainon: only Cerydra + Cyrene + Dan Heng PT at 36%). Same scoring for both; check every recommended team in both games is up to date | LOGIC-CORE | live | #92: Cyrene's Odes count; each card slot takes the best owned pick; Phainon card 36% → 91%. |
| T41 | Carries who sustain themselves (Aventurine • Waveflair) free the sustain slot; "Best found from your characters" card when a card is under 90% | LOGIC-CORE (+ FRAME OK on Teams.tsx) | live | #93: "Best found from your characters" cards (Waveflair, Silver Wolf LV.999, 7 ZZZ); Castorice counts as her own healer. |
| T42 | Character page "Builds their teams want": refresh on switches/team lists/leaks; use the members the card shows | LOGIC-CORE | sent | After FRAME's #94 (stale team results fix). |

## Done
| # | Job | Who | Live on |
|---|---|---|---|
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
