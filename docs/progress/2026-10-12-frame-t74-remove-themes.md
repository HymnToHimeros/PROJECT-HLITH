# 2026-10-12 · FRAME · T74 Remove owner themes

Owner: "I also can't remove the ones that exist now I want them gone."

- Owner console → Owner themes: every theme has a clear Remove button with a confirm step
  ("Yes, remove …" / "Keep it") and an Undo that puts it back in its place (for this session).
- "Remove the set themes" takes out exactly the themes the set-theme button added (marked
  `origin: 'set'` from now on; the first ten are known by the SHA-256 of their ids, so the code
  names none of them). The owner's own themes are never touched. Confirm step and Undo too.
- Removing the theme you wear switches back to the built-in theme worn before it
  (`prefs.themeBefore`, saved when you pick an owner theme), or Glacier.
- The old drafts must also leave `owner_theme_drafts` (the delete needs a person to approve it).
