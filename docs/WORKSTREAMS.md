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

## Who's who
| Name | Branches | Builds | Roadmap items |
|---|---|---|---|
| **FRAME** | `frame/…` | The base and the interface: look, shell, contract, registries, saved data, every module screen as a frame (layout, components, example data, "No data yet" slots). Not the deeper logic behind them. | R01–R61 (the screens) |
| **LOGIC-CORE** (brief: `docs/briefs/LOGIC-CORE.md`; code comments still say ROSTER-LOGIC) | `logic-core/…` | Roster logic: full character data and builds, kit check data and parsing, team scoring, who-fits. Fills the slots FRAME's Roster screens leave. | logic behind R35–R38, plus any new items it adds |
| **SCHEDULER** (brief: `docs/briefs/SCHEDULER.md`) | `scheduler/…` | Now: every time-gated thing (versions, banners, events, endgame, backlog, new characters) onto the site with sources. Later: the schedules, once every chat is done. | data behind R39–R45 |

## Chat sessions (for `send_message`)
| Name | Session id |
|---|---|
| FRAME | `session_01JhX321c2CZBUjDK5Z6yXKX` |
| LOGIC-CORE | `session_01BA3zSGcxmptiKVhzJkBkaP` |
| SCHEDULER | `session_01AYGjoovgX3AtCHtQ3TvW5T` |

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
