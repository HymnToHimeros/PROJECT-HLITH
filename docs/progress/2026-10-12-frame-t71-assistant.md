# 2026-10-12 · FRAME · T71 Assistant upgrades

Owner: "the ai asitant should be able to add abcklog things and also be able to recvie jsn
files or md etc."

- New proposal tools (strict schemas without minimum/maximum, the T69 rule; limits are checked
  on the card): add_backlog_item (game, title, category, total, reward or unknown, note, why),
  edit_backlog_item (rename and/or new total; progress above the new total is lowered),
  hide_backlog_item. Approve applies them through Edit mode's own-items path; Undo hides an
  added item (nothing is deleted), puts an edit back (progress too), or shows a hidden item
  again. Undo refuses when you changed the item since.
- Files in the chat: paperclip (several at once) or drag and drop onto the composer. .json, .md,
  .txt and .csv go to Claude as text documents titled with the file name; .pdf as a base64
  document. Limits: 500 KB per text file, 4 MB per PDF, 5 files per message; clear messages for
  too big, empty, fake PDF or the wrong kind. The server accepts only text/plain and PDF
  documents (no links to fetch) and at most 5 per message. Files are never stored by HLITH;
  the chat keeps only names and sizes.
- Bonus: an attached UIGF/SRGF pull export shows "Import into History" (the same importer as
  Pulls → History) with Undo, instead of Claude retyping it.
- System prompt: knows about attached files, add_backlog_item for checklists, and the Import
  button for pull exports.
- Privacy policy: the Assistant paragraph now names files and says they're never stored.
- After merge: deploy the `assistant` function and confirm the version.
- Screenshots: docs/owner-reports/2026-10-12/t71-assistant/.
