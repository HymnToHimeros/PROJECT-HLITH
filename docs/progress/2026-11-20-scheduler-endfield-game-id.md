# 2026-11-20 · SCHEDULER · Endfield imports find operators by their in-game id

- The data refresh check went red on 19 Nov: Argent Flow's 14 days to get a
  wiki kit ran out, and the import still said "no wiki page".
- The wiki had her all along under her in-game id (chr_0037_minghe). Our list
  keeps a stable id (chr_argent-flow, so nobody's saved data changes) and
  stores the game's id as gameId. The kit, cost and build imports looked up
  only our id.
- They now look up gameId first, then our id. Argent Flow now has kit text,
  costs and attributes (35 of 35 operators). The same run also brought the
  wiki's newer revisions for other operators' builds and material sources.
- Weapons had the same gap: Lunar Calling was first listed from an official
  notice (id wpn_lunar-calling) and the wiki lists it as wpn_sword_0025. The
  Endfield list import now keeps the wiki's id as gameId when ours differs
  (as for operators), and the cost import looks it up. Lunar Calling now has
  costs and weapon skills.
- Two tests that said "Argent Flow / Lunar Calling have no costs yet" now
  check that they have them, plus an unlisted id that still gives nothing.
