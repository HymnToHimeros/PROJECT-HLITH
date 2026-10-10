# PROJECT-HLITH · WORKSTREAMS

Several chats build HLITH at once. Each one has a name, and every branch it
creates starts with that name, so you can always tell who made what.

## Rules for every chat
1. Pick a name that says what the chat does (e.g. `frame`, `roster-logic`), not a
   fantasy name, and add yourself to the table below.
2. Name every branch `<name>/<job>`, e.g. `frame/step-02-tokens`.
3. Stay inside your area. Shared files (`src/core/contract/`, `src/core/registry/`)
   change only through the chat that owns them, or with a note here.
4. Tick roadmap items by adding their proof files, then run `npm run roadmap`.
   Never tick by hand.
5. Before starting, read `CLAUDE.md`, `docs/PLAN.md`, `docs/ROADMAP.md` and this file.
6. **Talk to each other directly (owner, 2026-10-10).** The chats are one ecosystem. When
   you find something another chat owns that is broken, missing or would help your work,
   message that chat yourself with `send_message` (Claude Code Remote tools) instead of
   waiting for the owner: say what, where (file, PR) and what you need. Answer messages
   you get, do the fix if it is yours, and reply when it is done. Still write anything
   lasting into `docs/PROGRESS.md`. Session ids are in the table below; `list_sessions`
   finds a chat whose id changed.
7. **MANAGER is the owner's front desk (owner, 2026-10-10).** The owner writes to
   MANAGER; MANAGER sends each job to the chat it belongs to (routing table below).
   A job MANAGER forwards carries the owner's own words in quotes: treat it as the
   owner's request. Report back to MANAGER when it's done or blocked; MANAGER tells
   the owner. If the owner writes to you directly, that still counts, and you tell
   MANAGER so its list stays right.
8. **ERROR-FIX fixes bugs only when a chat asks (owner, 2026-10-10).** Found a bug?
   If it's in your own area, fix it yourself. If it's someone else's, tell that chat.
   Send it to ERROR-FIX when the owning chat is busy or asks for help, when it spans
   several areas, or when the live site or `main` is broken. ERROR-FIX doesn't go
   looking for work on its own.

9. **MANAGER approves and merges every PR (owner, 2026-10-10).** Open your PR and
   send `READY` as `docs/RELEASES.md` says; MANAGER checks it, merges it in order and
   tells you when to bring `main` into your branch. Don't merge your own PR (only
   exception: an urgent fix for a broken live site when MANAGER doesn't answer).

## Who's who
| Name | Branches | Builds | Roadmap items |
|---|---|---|---|
| **FRAME** | `frame/…` | The base and the interface: look, shell, contract, registries, saved data, every module screen as a frame (layout, components, example data, "No data yet" slots). Not the deeper logic behind them. | R01–R61 (the screens) |
| **LOGIC-CORE** (brief: `docs/briefs/LOGIC-CORE.md`; code comments still say ROSTER-LOGIC) | `logic-core/…` | Roster logic: full character data and builds, kit check data and parsing, team scoring, who-fits. Fills the slots FRAME's Roster screens leave. | logic behind R35–R38, plus any new items it adds |
| **SCHEDULER** (brief: `docs/briefs/SCHEDULER.md`) | `scheduler/…` | Now: every time-gated thing (versions, banners, events, endgame, backlog, new characters) onto the site with sources. Later: the schedules, once every chat is done. | data behind R39–R45 |
| **MANAGER** (brief: `docs/briefs/MANAGER.md`) | `manager/…` | The owner's front desk: takes every message from the owner, splits it into jobs, sends each to the right chat, keeps the list of open jobs (`docs/TASKS.md`), and tells the owner in plain words when things are done. Writes no app code. | none |
| **ERROR-FIX** (brief: `docs/briefs/ERROR-FIX.md`) | `error-fix/…` | Bug fixes anywhere in the app, only when another chat (or MANAGER) asks: finds the cause, fixes it with a test, tells the chat whose area it was. | none |

### Where a job goes (MANAGER's routing table)
| The job is about… | Goes to |
|---|---|
| How something looks or works on screen, a new screen or button, settings, sign-in, sync, saved data, the Assistant, HoYoLAB link, backups, the server functions, the check (CI), hosting | FRAME |
| Game dates and lists: versions, banners, events, rewards, endgame, backlog, new or leaked characters, art, release dates, server times; game record numbers (income per source, endgame and weekly rewards, pull rates in each game's `contract.ts`); keeping the lists current (`data:nanoka`, `data:schedule`, the leaks and events routine, Findings) | SCHEDULER |
| What characters do and how well they fit: kits, Kit check, team scores, "who fits", builds and build scores, materials, Farm amounts; the weapon list and item pictures (Light Cones / W-Engines, gear sets, materials) | LOGIC-CORE |
| Something that worked and now doesn't, an error message, a crash, wrong numbers from working code, a red check on `main` | the chat whose area it is; ERROR-FIX if that chat asks, it spans areas, or the live site is broken |
| Unclear, or it needs a decision from the owner | MANAGER asks the owner first, in one short question |

## Chat sessions (for `send_message`)
| Name | Session id |
|---|---|
| FRAME | `session_01JhX321c2CZBUjDK5Z6yXKX` |
| LOGIC-CORE | `session_01BA3zSGcxmptiKVhzJkBkaP` |
| SCHEDULER | `session_01AYGjoovgX3AtCHtQ3TvW5T` |
| MANAGER | `session_01GimxkMJzEydgMJauGc9J4o` |
| ERROR-FIX | `session_01HQ51Y69kZRzfNsM6jQyQ7j` |

## Interface vs logic (owner's rule, 2026-10-09)
FRAME builds the interface and the base, not the logic. A screen FRAME builds
shows where logic will plug in (a "No data yet" or EXAMPLE slot, with a comment
naming the workstream that fills it). Logic workstreams fill those slots without
redesigning the screen.

## Scheduler (2026-10-09)
The scheduler frame is FRAME's: the `scheduler` and `findings-intake` functions,
`supabase/functions/_shared/jobs.ts` (the job list), migration 0005 and Owner
console → Scheduler / Findings. Job logic belongs to a data workstream: the
"find new info" jobs (leaks-scan, events-scan, game-data-refresh) run in a
separate scheduled routine chat that delivers findings as described in
`docs/ROUTINES.md`. Approving a finding writes it into the built-in lists
(`onApprove` in `src/tools/owner/schedulerData.ts`, payload rules in
`src/tools/owner/approve.ts`, FRAME 2026-10-10); data workstreams may refine
those rules.

## Built-in lists (2026-10-10)
Every game's list loaders (events, banners, backlog, characters, versions) are
wrapped once in `src/main.tsx` with `withCatalog` (`src/core/data/catalog.ts`):
the seed JSON with the owner's rows from `catalog_items` laid over it, read once
per signed-in session. The owner edits them in Owner console → Lists. Seed JSON
stays the base; never rename an id that is already in a list.

## Shared files
- `src/core/contract/` and `src/core/registry/`: owned by FRAME. The `Kit` and
  `TeamPreset` types in `src/core/contract/entities.ts` are placeholders for
  ROSTER-LOGIC to extend; say so here when you change them.
  - 2026-10-10 · LOGIC-CORE extended `Kit`: new `KitSkill` type with optional
    `kind` and `unlock` (dupe or potential level), and optional `source`,
    `version`, `beta` on `Kit`. Nothing existing changed meaning.
  - 2026-10-10 · LOGIC-CORE added optional `proof` and `note` to `KitSkill`,
    and optional `GameRules.teams` (`TeamRules`: verdict, whoFits, lineUps,
    ifYouPull, rated) with its types in `game-contract.ts`. Roster screens use
    it when a game has it; otherwise they show what they showed before.
  - 2026-10-10 · LOGIC-CORE added `RecommendedBuild` (entities.ts), optional
    `data.builds` and `GameRules.materialsNote` (game-contract.ts), and
    `replacedAt` on `KitSkill`. Farm and the character page use them.
  - 2026-10-10 · LOGIC-CORE added optional `icon` to `Material`, optional
    `items` (`BuildItem`: picture, rarity, effects) to `RecommendedBuild`, and
    optional `unordered` to a rated `TeamVerdict` (HSR teams have no order).
    Farm, the character page ("How to build") and Why % use them.
  - 2026-10-10 · LOGIC-CORE added `FitOptions` (`includeUnowned`), optional `percent`,
    `fromAccount` and `theory` on `FitSuggestion`, and optional `TeamAccount.weapon`
    (filled from the saved build in TeamParts.tsx) for T18.
  - 2026-10-10 · LOGIC-CORE added `TeamExplain` and optional `explain` on a rated
    `TeamVerdict` (plain-words reasons, T17), filled by `src/core/rules/teamExplain.ts`;
    the team "Why" (TeamParts.tsx) shows it first, the proof list one tap below.
  - 2026-10-10 · LOGIC-CORE added optional `build` to `TeamAccount` (the saved build,
    owned characters only), the `TeamWant` type and optional `wants` on a rated
    `TeamVerdict` (builds a team wants, T18; points already in the count). Each game's
    gear slots moved to `src/games/<game>/gear.ts` (the contract uses them as before).
  - 2026-10-10 · LOGIC-CORE added optional `role` (path / specialty) and `effect` to
    `Weapon` (every weapon's effect text, T18 step 4; `npm run data:builds`).
  - 2026-10-10 · LOGIC-CORE added optional `fill(preset, account)` to `TeamRules`: a game
    team's members as you'd field them (first owned per slot, game order). Roster Teams and
    the character page's Team fit use it (one line each).
  - 2026-10-10 · LOGIC-CORE added optional `teamList(presetId)` to `TeamAccount`: the owner's
    own slot lists for a game team (FRAME stores them with the account as `teamLists`), and
    optional `skip(id)`: characters the owner hid (FRAME fills it with `hiddenBy(game)`); no
    team, suggestion, best team or card ever uses them.
  - 2026-10-10 · LOGIC-CORE added optional `set`, `rolls`, `weapon.refine` and
    `skills` to `CharacterBuild`, the `BuildScorePart` type, and optional `parts`
    and `basis` on `scoreBuild`'s result; the character page's Build score card
    shows them. The game-free scoring lives in `src/core/rules/buildScore.ts`
    (games pass their facts; rules: `docs/logic/build-score.md`).
  - 2026-10-10 · LOGIC-CORE added the `Weapon` entity and optional
    `data.weapons` (Light Cones, W-Engines with picture and "made for"), from
    `npm run data:builds` (`weapons.json`, both games). LOGIC-CORE changed
    FRAME's Banners screen so weapon banners show them instead of "NO ART YET".
  - 2026-10-10 · FRAME added optional `GameContract.potential` (`{ name, max }`:
    HSR `Enhanced` max 1, ZZZ `Agent Potential` max 6) and `potential?` on the
    saved `RosterEntry`. The character page sets it for characters whose kit has
    `unlock.potential` or `replacedAt` pieces; `TeamAccount.potential` returns it
    for owned characters (undefined = not set or not owned).
  - 2026-10-10 · FRAME added the build store: `SavedBuild` (entities.ts; level,
    weapon with level and refine, gear per slot with set, main and subs, skills,
    source), `GameContract.build` (`BuildRules`: level caps, refine name, slots
    with main stats, sub stats, skills) for HSR and ZZZ, and `builds?` in user
    data. The character page's Build score card saves, edits and clears it (with
    Undo); a scan saves level and weapon into it. `scoreBuild` gets the existing
    `CharacterBuild` mapped from it until LOGIC-CORE says what it needs.
- `src/games/zzz/data/kits.json` and `profiles.json` are generated by
  `npm run data:kits` (LOGIC-CORE). Kit text is added group by group (`GROUPS`
  in `scripts/import-nanoka-kits.ts`); profiles cover every agent.
  `src/games/hsr/data/kits.json` is generated by `npm run data:hsr-kits`, the same way.
  `costs.json` and `materials.json` (both games) come from `npm run data:costs`;
  `builds.json` (both games) and HSR's `teams.json` from `npm run data:builds`.
  (LOGIC-CORE changed one line of FRAME's `tests/games.test.ts`: HSR now has kit
  data, so Kit check is on for HSR; the fake game still shows it off.)
- `docs/logic/`: the scoring rules. `zzz-method.md` is the owner's method, word
  for word; never edit it without the owner.
- `versions.json`, `banners.json`, `events.json` and the main-story item in `backlog.json`
  are generated by `npm run data:schedule` (SCHEDULER), after `npm run data:nanoka`.
  Fix the script, not the JSON.
- `src/games/<id>/data/*.json`: anyone adding game data. Ids never change once added.
  `characters.json` is generated by `npm run data:nanoka` (nanoka.cc, with permission);
  edit the script's tables, not the JSON by hand.

A new chat that adds roadmap items gives them the next free R-number and a proof file.
