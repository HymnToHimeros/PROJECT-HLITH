# 2026-10-12 · FRAME · T70 Pulls → Planner banner cards

Owner: the Planner's banner cards only had the banner's name ("by the name alone idk who
what is"); show the character like the Banners tab does, and section by now, next and later.

- Each card now leads with the banner's art (BannerArt, the same as Banners): the featured
  character (a weapon banner: the weapon's picture, "Made for …"), its name and rarity, and the
  other rate-ups as small portraits. No art → "No art yet"; sample art only on example banners.
- Laid out exactly like Banners (owner: "the now next later was rly meant like the banner does
  it"): side-by-side columns NOW | NEXT | LATER, the same column notes ("Live · 9d 8h until the
  first one ends", "Oct 21 – Nov 10 · opens in 9d 8h", "Nothing further listed"), cards stacked
  in each column, and tabs on a phone. Both screens now use one shared component
  (banners/PhaseBoard.tsx), so they stay identical. The phase rule is shared too
  (`phaseOfBanner` in banners/fit.ts). Permanent banners have no end to plan by, so the Planner
  has no "Always open" rail.
- All numbers stay (Have now, By end / When it opens, Worst case, chances, pity) under the art.
- "Not counted: 1 rows" → "1 row".
- Screenshots: docs/owner-reports/2026-10-12/t70-planner/ (HSR and ZZZ, PC and phone).
