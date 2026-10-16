# 2026-10-16 · LOGIC-CORE · Endfield recommended builds

Done:
- `npm run data:endfield-builds` writes src/games/endfield/data/builds.json and gear-sets.json.
- Weapons, all 35 operators: the game's own "Recommended Weapons" (Matching Skills, then Matching Stats), as
  endfield.wiki.gg copies them onto each operator page, with the page revision. The game doesn't rank them,
  so the card shows no "best first" and no numbers (`RecommendedBuild.ranked: false`).
- Gear sets and skill order: community guides, read by hand into community-builds.json (Game8, GameWith,
  endfield.gg, 18183; each entry with its page and date). Kept only where two or more sources agree:
  gear set for 14 operators, skill order for 15. Everything else says "No data yet".
- Gear sets (30): names and 3-piece effects from the wiki's GearSets table, each with its revision.
- Character page, every game: a step with nothing in it now shows "No data yet" instead of disappearing
  (HSR now shows "Skills: level first · No data yet", since its source has no skill order). Endfield has
  no Main stats step (its gear has none to pick). Steps with their own source say so under the step.

Not used: Prydwen and Icy Veins (no access from here), 17173 (translations of English guides), vendor blogs.
