# PROJECT-HLITH · how updates go live

Owner's rule (2026-10-10): the chats (FRAME, SCHEDULER, LOGIC-CORE, ERROR-FIX;
MANAGER approves and merges) agree together when an update goes live, so our work lines up and nobody breaks another chat's work.
Efficiency counts as much as getting it right.

Every merge to `main` goes live within minutes, so **merging is releasing**.
Talk with `send_message` (session ids in `docs/WORKSTREAMS.md`).

## The routine
**MANAGER merges (owner, 2026-10-10).** MANAGER oversees and approves every PR and
does every merge to `main`. The other chats never merge their own PRs.

1. **Work on your own branch** (`frame/…`, `scheduler/…`, `logic-core/…`,
   `error-fix/…`, `manager/…`) as long as you like. Pushing your branch and opening
   a PR is free and needs no one's OK.
2. **Ready?** When your PR is green and done, send MANAGER and the other building
   chats (FRAME, SCHEDULER, LOGIC-CORE, ERROR-FIX):
   `READY #<pr>: <one line what it does>. Touches: <shared files, or "only my area">.`
   Say which owner job it is (`T<n>` from `docs/TASKS.md`) and whether the owner has
   to see it first (a new screen or a redesign: Override 5).
3. **The others answer within their next turn:** `OK`, `WAIT <reason>` (e.g. "I'm
   about to finish something that touches the same file") or `ME TOO #<pr>`. They
   send the answer to MANAGER as well.
4. **MANAGER approves and merges** when: the check is green on the latest commit,
   there's no merge conflict, the PR does what the owner asked (and the owner has
   seen it if it needed that), and no building chat said `WAIT`. A chat silent for
   its whole turn counts as OK if the PR touches only the author's own area. If
   something is wrong, MANAGER says what on the PR's thread or to the chat, and the
   chat fixes it and sends `READY` again.
5. **One at a time, in this order** unless MANAGER says otherwise: docs-only PRs
   (seconds) → ERROR-FIX (a fix for something broken) → SCHEDULER (data) →
   LOGIC-CORE (logic) → FRAME (screens). After each merge MANAGER tells the next one
   in line to merge `main` into its branch, run `npm run check` and push once; MANAGER
   merges it when that check is green.
6. **After the merge** the chat whose PR it was checks the live site and sends `LIVE`
   to MANAGER (and the others). MANAGER moves the job to Done in `docs/TASKS.md` and
   tells the owner about the batch once, in plain words.

## Shortcuts (efficiency)
- **Nothing else open?** (`list_pull_requests` shows only this PR.) MANAGER merges
  as soon as the check is green; nothing can clash.
- **Urgent fix for a broken live site:** ERROR-FIX (or the chat that owns it) sends
  `READY URGENT #<pr>`; MANAGER merges it first, before anything else in line. If
  MANAGER doesn't answer within its turn, the author merges it and tells MANAGER
  right after.

## Never
- Merge your own PR (MANAGER merges; the one exception is the urgent case above).
- Merge while another merge is still waiting for its check (one at a time).
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
