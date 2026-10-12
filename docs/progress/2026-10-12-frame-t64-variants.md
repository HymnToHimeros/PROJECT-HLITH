# 2026-10-12 · FRAME · T64 variants built

Owner: "the vairants are all good", so every variant from the two batches is kept.

- Each of the eight sets has five frames and five name styles. A is the set's own; B–E are from
  docs/owner-reports/2026-10-12/t64-variants-batch1 and -batch2 (frame 16's five Eclipse
  frames stay as they were).
- Frames: exported from the sheet generators into art.ts (OWNER_FRAME_VARIANTS for frames
  13–20) with their motion in svgMotion.css. The existing drawings are unchanged (the diff
  only adds).
- Name styles: nameVariants.ts holds each variant's fixed markup with two marks (the name, and
  the name one letter per span); OwnerArt.tsx always escapes the name before it goes in.
  nameVariants.css: classes and keyframes prefixed (oa- / oan-), scoped under .oa-name, sizes
  in em so they follow the card's name size.
- Every animation follows Account → Theme → Animations: On moves, Reduced keeps only soft
  glows and colour, Off holds still (tested: no animation rule outside the motion switch).
- Grouped picker: each set's tile opens its five frames or five name styles (row on PC, sheet
  on phone), like frame 16. "Wear full set" keeps the variants you chose for that set.
- Owner only, shown to others when worn (profile_card already passes frameVariant and
  nameVariant), never grantable through Rewards (reward pictures must be "r-…" keys).
- Screenshots: docs/owner-reports/2026-10-12/t64-variants-built/.
