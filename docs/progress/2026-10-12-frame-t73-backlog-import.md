# 2026-10-12 · FRAME · T73 Backlog files: import from the old app, export, format

Owner: "this is for my account in specific", and "that data in full has to be in my accounts
backlog … im not recounting and naming and writing everything out", "or allow ppl to add json
files in a specific format".

- Backlog → Import from old app: pick the file once. Every row becomes one of YOUR OWN backlog
  items (the Edit-mode path), in full: name, category (a new name makes a new category), total,
  progress, reward (rewardEach × total; rewardUnknown → no reward, "No data yet"), unit, step
  (new `step` on backlog items: how much − / + changes a counter), where (shown as the place) and
  note. Only in the account that imports it; nothing goes into the built-in lists.
- Preview first: "197 items to add · 96 with progress · progress from Oct 2 (the file's date)",
  plus the file's own notes. Apply, then Undo for the whole import (hides what it added, never
  deletes, and puts progress back).
- The same file again: the row id is kept in the item's id (own-old-<game>-<id>), so nothing is
  added twice and progress only goes up.
- The format is documented for anyone ("File format" with an example and Download a template;
  a line in the Guide). Export my backlog writes the same format; a full row round-trips
  (tested), so items can move between accounts.
- An attached backlog file in the Assistant chat gets the same preview and Apply (the system
  prompt is untouched: supabase/functions changes need MANAGER's live test first).
- Counters now show a word unit with a space ("/ 40 chest") and use the item's step.
- Screenshots (the real 197-row list, done values added on 96 rows for the test):
  docs/owner-reports/2026-10-12/t73-backlog-import/.
