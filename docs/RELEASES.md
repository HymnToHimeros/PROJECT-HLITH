# PROJECT-HLITH · how updates go live

Owner's rule (2026-10-10): the chats (FRAME, SCHEDULER, LOGIC-CORE, ERROR-FIX;
MANAGER keeps watch) agree together when an update goes live, so our work lines up and nobody breaks another chat's work.
Efficiency counts as much as getting it right.

Every merge to `main` goes live within minutes, so **merging is releasing**.
Talk with `send_message` (session ids in `docs/WORKSTREAMS.md`).

## The routine
1. **Work on your own branch** (`frame/…`, `scheduler/…`, `logic-core/…`) as long
   as you like. Pushing your branch and opening a PR is free and needs no one's OK.
2. **Ready?** When your PR is green and done, message the other building chats
   (FRAME, SCHEDULER, LOGIC-CORE, ERROR-FIX) and copy MANAGER:
   `READY #<pr>: <one line what it does>. Touches: <shared files, or "only my area">.`
3. **They answer within their next turn:** `OK`, `WAIT <reason>` (e.g. "I'm about to
   merge something that touches the same file") or `ME TOO #<pr>` (theirs is ready too).
4. **Merge when every building chat said OK.** If several are ready, they go in one
   go, one after another, in this order unless the thread agrees otherwise:
   ERROR-FIX (a fix for something broken) → SCHEDULER (data) → LOGIC-CORE (logic)
   → FRAME (screens). Docs-only PRs (MANAGER's `docs/TASKS.md` too) go first:
   their check takes seconds.
5. **After each merge** the next one in line merges `main` into its branch, runs
   `npm run check`, pushes once, waits for green, then merges.
6. **The last one checks the live site** and tells the others `LIVE`, MANAGER
   included. MANAGER tells the owner about the batch once, in plain words (if the
   owner was talking to a chat directly, that chat tells them).

## Shortcuts (efficiency)
- **Nobody else has anything open?** (`list_pull_requests` shows only your PR.)
  Send `READY` anyway, then merge straight away; nothing can clash.
- **A sibling is silent for its whole turn** (it may be working on something long):
  merge if your PR touches only your own area; if it touches shared files, wait.
- **Urgent fix for a broken live site:** merge first, tell the others right after.

## Never
- Merge while another chat's merge is still waiting for its check (one at a time).
- Edit a file another chat owns without telling it first. Shared files need a
  heads-up before editing: `src/core/contract/`, `src/core/registry/`,
  `src/main.tsx`, `.github/workflows/`, `docs/WORKSTREAMS.md`, `docs/ROADMAP.md`.
- Write in another chat's part of `docs/PROGRESS.md`.

## The check (CI)
- Notes-only changes (`docs/`, `*.md`) skip the code checks and pass in seconds.
  `docs/ROADMAP.md` still runs them (a test reads it).
- Code changes run style, types, unit tests and build on one machine and the
  browser tests on four machines at once: about 5 minutes instead of 11.
- A newer push to the same PR stops the older check.
- The single result to read is **check**: green means everything passed.
