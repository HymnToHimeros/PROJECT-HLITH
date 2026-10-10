# PROJECT-HLITH · TASKS

MANAGER's list of the owner's open jobs. States: **sent** · **working** ·
**waiting on owner** · **blocked** · **live**. A job is live only after the chat
doing it said `LIVE`. Newest jobs at the bottom; live jobs move to Done.

## Open
| # | Job | Who | State | Note |
|---|---|---|---|---|
| T2 | MANAGER and ERROR-FIX chats (PR #51) | FRAME | 2026-10-10 |
| T1 | Save a build per character (PR #50): character page → Build score → "Enter build" | FRAME | 2026-10-10 |
| T3 | Build score (`scoreBuild`) | LOGIC-CORE | working | Done in PR #55; needs main merged in (conflict) and FRAME's OK (contract types). |
| T4 | HSR character EXP in Farm amounts | LOGIC-CORE | working | Source found (the game's own EXP table: 1 → 80 = 290 Traveler's Guides). PR #53: needs main merged in (conflict) and a check run. |
| T5 | HSR "Interastral Peace Gala" reward (starts 21 Oct) | SCHEDULER | blocked | Sources say 500 or 60; filled from the official notice when the event opens 21 Oct. |
| T6 | Keep the game lists current on a schedule | SCHEDULER | waiting on owner | Owner decides how often (`data:nanoka` then `data:schedule`). |
| T7 | Schedules for the research routine (leaks, events, game data) | SCHEDULER | waiting on owner | Decided once SCHEDULER and LOGIC-CORE are done. |
| T8 | Live checks with real logins: HoYoLAB link, in-game history link, Assistant with own key | FRAME | waiting on owner | Needs the owner to sign in and try each. |
| T9 | Phone push keys (VAPID) so the evening message is really sent | FRAME | waiting on owner | Turns something on; owner's call. |
| T10 | Resend for sign-in mail at scale | FRAME | waiting on owner | May cost money; owner's call. |
| T11 | Finish account deletions after 30 days | FRAME | sent | Listed as "later" in PROGRESS.md. |
| T12 | Paste fresh HoYoLAB code logins for HSR and ZZZ (Account → Connected accounts) | owner | waiting on owner | Live stamina and check-in need them. |
| T13 | ZZZ 3.3 (21 Oct): event dates, A-rank featured agents, version end date | SCHEDULER | blocked | Nothing published yet; rerun `data:nanoka` + `data:schedule` on 21 Oct. |
| T14 | HSR 4.7 (starts 11 Nov): versions, banners, events | SCHEDULER | blocked | Waits for the announcement (special program around late Oct). |
| T15 | HSR leak "Nihilux": confirm official name | SCHEDULER | blocked | Probably Aeon ★ Aha (already marked as a leak); confirm when announced. |
| T16 | Live banners card (Today): art scales wrong. Screenshot `docs/owner-reports/2026-10-10/1-live-banners-scaling.png` | FRAME | working | Fixed in PR #56 (every art box the same size, PC and phone). Not live yet. |
| T17 | Kit check / Roster teams don't explain their reasoning ("Why 90%: count 9 of 10" is a number, not a reason). Screenshot `2-recommended-teams.png` | LOGIC-CORE leads, FRAME for the screen | sent | |
| T18 | Make my own teams (pick the members myself, get them scored) | FRAME leads, LOGIC-CORE scores | sent | FRAME: a preset editor exists in Teams; finding out why the owner can't see or use it. Shown to the owner first. |
| T19 | HSR recommended teams make no sense (e.g. built around March 7th); mixes whatever is possible instead of real teams | LOGIC-CORE | sent | |
| T20 | Several screens are badly designed / crowded (owner: endgame may stay in Events; MANAGER to find which). MANAGER's list: Today, Events, Calendar, Backlog, Banners (see note to FRAME) | FRAME | sent | Owner left the choice of screens to MANAGER. Redesigns are shown to the owner before going live. |
| T21 | Banners screen looks like a card picker, not a banner tracker: redesign. Screenshot `3-banners-page.webp` | FRAME | sent | Show the owner the new look before it goes live. |
| T22 | Auto-tick dailies from HoYoLAB: remember when stamina/battery should have been full; if the next sync shows less, the stamina was spent, so tick the dailies that prove it | FRAME | working | PR #56. MANAGER sent it back: it must compare with what stamina should be after refilling, not just the last reading. |
| T23 | More themes (owner sent 8 palettes) | FRAME | working | Being built. |
| T24 | Tidy the GitHub repo so it looks sorted, and update the README (asked before, not done) | FRAME | sent | |
| T25 | MANAGER approves and merges every PR (owner's rule): written into `docs/RELEASES.md`, `docs/WORKSTREAMS.md` rule 9, MANAGER brief | MANAGER | working | In PR #54. |

## Done
| # | Job | Who | Live on |
|---|---|---|---|
| T2 | MANAGER and ERROR-FIX chats (PR #51) | FRAME | 2026-10-10 |
| T1 | Save a build per character (PR #50): character page → Build score → "Enter build" | FRAME | 2026-10-10 |
