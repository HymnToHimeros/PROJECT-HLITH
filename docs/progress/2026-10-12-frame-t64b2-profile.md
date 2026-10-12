# 2026-10-12 · FRAME · T64 Part B2: profile customization for everyone

- **Card**: pull numbers per game (total, average pity, 50/50 won x of y, or "no data yet");
  luckiest pull (✔ from imported history; only provable counts: the count before the first
  top result in the history is left out); best team; badge shelf (pin 3, held badges only);
  earned titles (a ✔ title that comes with a badge, only while you hold it; typed titles stay);
  favourite game; a public theme's art behind the card; bio behind its own switch (off).
- **Slur check**: name, bio and title use the username list word by word (`textBlocked`, server
  `text_blocked`); blocked text can't be saved and never shows on a card.
- **Silenced**: what others see can't change (server trigger keeps the old values; the editor
  says so); pinned characters and privacy switches still save.
- **Owner look picker**: one tile per set (plus Classic); tap opens its variants (a row on PC,
  a sheet from the bottom on phone); "Wear full set" keeps the chosen variant.
- **Migration 0018**: `pull_numbers()` (nobody can call it directly), `text_blocked()`,
  `profiles_silence_guard`, and `profile_card()` = 0017's plus the new parts, each behind its
  switch. Tested on local Postgres (numbers match the app; switches hide each part; the silence
  guard holds; an unsilenced change goes through).
- Privacy: the profile-card line lists the new parts (clarification of an opt-in feature, no
  version bump, agreed with MANAGER).
- Screenshots: docs/owner-reports/2026-10-12/t64b2-profile-card/.

## Grouped owner-look picker screenshots
- grouped-picker-collapsed-{pc,phone}: one tile per set plus "Classic"; a tile with variants
  says which one you wear and how many there are.
- grouped-picker-sol-mani-open-{pc,phone} and grouped-picker-classic-open-{pc,phone}: tapping a
  tile opens its choices, as a row under the tiles on PC and a sheet from the bottom on a phone.
- Fix found while shooting: the phone sheet was trapped inside the page (a moving parent box
  kept it off screen). It now opens at the page's end, so it always rises from the bottom. The
  phone switch is the app's own (below 820 px).
