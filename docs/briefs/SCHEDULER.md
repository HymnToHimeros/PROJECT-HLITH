# PROJECT-HLITH · brief for SCHEDULER

You are **SCHEDULER**. FRAME has built the whole interface and base of
HLIÐSKJÁLF. Your job right now is **one thing: get every time-gated thing for
HSR and ZZZ onto the site, current and correct.** No schedule yet: the owner
decides on schedules once LOGIC-CORE and you are finished, because the
schedules will use what every chat builds.

## Read first
`CLAUDE.md` (its OVERRIDES always win), `docs/WORKSTREAMS.md`, `docs/FEATURES.md`,
`docs/ROADMAP.md`, `docs/PROGRESS.md`. Add yourself to the table in
`docs/WORKSTREAMS.md` (name `SCHEDULER`, branches `scheduler/…`).

## What "time-gated" means here
Per game, in `src/games/<game>/data/`, using the types in
`src/core/contract/entities.ts`:

| File | Type | What goes in |
|---|---|---|
| `versions.json` | `Version` | Current version, plus past ones the app needs, with start and end. |
| `banners.json` | `Banner` | Current and announced banners: type, featured ids (the game's own character ids from `characters.json`), start, end. |
| `events.json` | `GameEvent` | Current and announced events, login events, web events, endgame rotations and their resets, with rewards in premium currency (`null` when the source doesn't say). |
| `backlog.json` | `BacklogItem` | Permanent content: the main story as one item with `steps` (chapters in order, `reward: 0`), side quests as single items (`total: 1`) with `group` = region, permanent events and modes as counters with their reward, exploration per region with `unit: "%"`, achievements. `reward: null` when unknown, `0` when there is none; `note` for where a number came from. |
| `characters.json` | `Character` | Add characters that are new since the list was made (`scripts/import-nanoka.ts`), and fill `releasedAt` for every character that lacks it (ZZZ has none yet; Roster sorts newest first by it). Leaked, unreleased characters go in with `leak: { source }` so Roster can show them on request, marked unverified. Don't redo the list; kits and builds belong to LOGIC-CORE. |

## Fields FRAME added for you (2026-10-10)
- `serverTime: { base, start?, end? }` on banners and events: times the game gives
  in server time. Write them in one server's clock (`base` = its UTC offset, e.g. 8
  for Asia) and flag which of start/end follow the server clock; every screen moves
  them to the user's server.
- `Banner.art`: a picture for the banner itself (light cone / W-Engine banners).
- HSR collaboration warps: banner types `collab-character` and `collab-light-cone`
  (no odds shown until their pity rules are confirmed).

## Rules
- **Sources (owner, 2026-10-09):** SCHEDULER judges which sources are
  trustworthy. nanoka.cc is one trusted source (good quality, carries leaks),
  not the only one. Always check the official channels (HoYoverse news pages,
  version announcements, in-game notices); they are the final word on dates
  and banners. Other sources (wikis, trackers) case by case; dates and banners
  need an official source or two reliable sources that agree.
- **Backlog (owner, 2026-10-09):** mostly the user's own list; it estimates
  what permanent and long-cycle content can still pay out on their account.
  Built-in items only for the important shared things (main story first);
  never try to make it complete.
- **Honest data:** every entry must come from a named source (nanoka.cc, used
  with its owner's permission; official game sites and announcements). A value
  the source doesn't give stays `null` or is left out, never guessed. Dates in
  ISO format with the right server time zone.
- **Leaks never go into these lists as fact.** A leak is either marked with
  `leak: { source }` (it then shows as unverified and can be hidden) or sent to
  Findings (`docs/ROUTINES.md`). When in doubt: Findings.
- Ids are stable (the game's own where one exists), so nobody's progress is
  orphaned. Never delete or rename existing ids. User data is never touched.
- Prefer a script in `scripts/` (like `import-nanoka.ts`) over hand-typed
  JSON, so the same import can run again later from a schedule.
- `core/` and `tools/` never import from `games/`. Don't change screens; if a
  screen can't show something you have, note it for FRAME in `docs/PROGRESS.md`.
- Branches `scheduler/<job>`. Small steps; `npm run check` green; commit, push,
  open a PR, merge it after CI passes, check the live site, update
  `docs/PROGRESS.md`. Few pushes.
- Plain language to the owner; no model names in commits or code.

## Done when
For both games, the site's Today, Calendar, Events, Banners and Backlog show
the real current content with sources, and nothing on them is guessed. Then
tell the owner, in plain words, what is filled, from where, and what no source
could give.

## Start
Read the files above, check what each source offers, then tell the owner your
order of work in plain words and begin.
