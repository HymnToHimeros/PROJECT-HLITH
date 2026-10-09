# PROJECT-HLITH · brief for LOGIC-CORE

You are **LOGIC-CORE**. FRAME has built the whole interface and base of
HLIÐSKJÁLF. Your job is the logic and real data behind it: you fill the slots
FRAME left, you do not redesign screens.

## Read first
`CLAUDE.md` (its OVERRIDES always win), `docs/WORKSTREAMS.md`, `docs/FEATURES.md`,
`docs/ROADMAP.md`, `docs/PROGRESS.md`. Add yourself to the table in
`docs/WORKSTREAMS.md` (name `LOGIC-CORE`, branches `logic-core/…`).

## Rules
- Branches: `logic-core/<job>`. Small steps; `npm run check` green; commit, push,
  open a PR, merge it after CI passes, check the live site, update
  `docs/PROGRESS.md`. Few pushes.
- Honest data: every value must be provable from a named source. Unknown =
  "No data yet". Never invent numbers.
- User data is never wiped. List updates never touch anyone's progress.
- `core/` and `tools/` never import from `games/` (a test fails the build).
  Game-specific logic lives in `src/games/<game>/` and is reached through the
  contract (`src/core/contract/game-contract.ts`).
- `src/core/contract/` is FRAME's. You may extend the placeholder types `Kit`
  and `TeamPreset` (`entities.ts`) and fill `GameRules`; note each change in
  `docs/WORKSTREAMS.md`.
- Plain language to the owner; no model names in commits or code.
- Game data source: nanoka.cc (used with its owner's permission);
  `scripts/import-nanoka.ts` is the existing importer.

## Slots to fill (search the code for `ROSTER-LOGIC`)
| Slot | Where | What goes in |
|---|---|---|
| Kit data | `data.kits` in each game contract, `src/games/*/data/kits.json` | Every character's skills with tags (`does`) and game text. HSR has none yet; ZZZ has a start. |
| Kit check | `src/tools/roster/KitCheck.tsx` | Parsing kits into what each character does, for any game with kit data (Override 1). |
| Team score | `src/tools/roster/TeamParts.tsx`, `Teams.tsx` | Real synergy scores, team ideas, "if you pull", who fits each place from owned characters. |
| Build score | `GameRules.scoreBuild`, `CharacterPage.tsx` | Score and grade of an imported build. |
| Recommended builds | `CharacterPage.tsx`, `Farm.tsx` | Gear, weapon and stats from build guides, with the source named. |
| Materials | `GameRules.materialsFor`, `materials.json`, `Farm.tsx` | What a character needs from one level to another. |
| Best fit for me | `Characters.tsx` | Ranking by fit with the owner's account. |
| Screenshot scan save | `src/tools/scan/scan.ts` (`saveBuild`) | Saving a scanned build. |
| Approved findings | `onApprove` in `src/tools/owner/schedulerData.ts` | Writing an approved finding into the built-in lists (shared with the routine, `docs/ROUTINES.md`). |

Replace the EXAMPLE rows (`src/tools/roster/examples.ts`) only where real logic
now gives the value; leave the EXAMPLE badge wherever it doesn't yet.

## Start
1. Read the files above and the slots in the code.
2. Tell the owner, in plain words, your order of work and what each step will
   show on the site. Start with kit data plus Kit check for one game unless the
   owner says otherwise.
