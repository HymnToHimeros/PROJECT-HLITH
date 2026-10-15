# Arknights: Endfield level-up costs (E7)

Code: `src/games/endfield/costs.ts` (`materialsFor`, `skillsOf`). Data: `data/costs.json` and
`data/materials.json`, written by `npm run data:endfield-costs` (scripts/import-endfield-costs.ts).
Tests: `tests/endfieldCosts.test.ts`.

## Sources (endfield.wiki.gg, CC BY-SA 4.0, read 2026-10-15)
- **Operator page:** EXP and T-Creds for every level 1→90; EXP items (Combat Records for levels 1–60,
  Cognitive Carriers for 61–90); the level each promotion needs (20, 40, 60, 80); the "Cost Summary"
  to max one operator (talents excluded), used by the tests.
- **AbilityMatrixUpgrades table:** Promotions I–IV per operator, checked against each page's `e1`…`e4`.
- **Each operator's page** (revision kept per operator): combat skills 2→12 (`Skill upgrade cell`:
  levels 2–9 shared, 10–12 per skill), attribute increases, talents, gear outfitting and base skills
  (`Operator talent cost`).
- **Items table:** id, name, type and picture of every item named.
- **Each item's page** ("Acquisition"): where it comes from, one line per place (`Material.sources`):
  top-level bullets, and each Protocol Space drop row as "<stage> (<Sanity> Sanity, <drop rate>)".
  Exchange prices (sub-bullets) are left out. Farm gets them on each row (`NeedRow.sources`).

## Weapons (`weaponMaterialsFor(weaponId, from, to)` → `{ needs, partial? }`)
- **Tuning:** stages 1–4 from each weapon's page (`Weapon data` t1…t4), needed at levels 20, 40, 60
  and 80 (the Weapon page's Tuning table: caps 40, 60, 80, 90). Every weapon's page is checked
  against that table: stages 1–3 must match it, stage 4 its shared items plus two weapon-specific
  items (16 and 8). A mismatch stops the import until it has a ruling. Today none differ.
- **Weapon EXP and T-Creds:** the Weapon page says all weapons cost the same, but gives only totals
  from level 1 at levels 20, 40, 60, 80 and 90 (no per-level table). So whole stretches between
  those levels are counted, in Arms INSP Sets (10,000 EXP each), and a range that starts or ends
  between them names what it leaves out in `partial`. To max from level 1 is exact.
- Lunar Calling has no wiki page yet; re-running the import adds it.

## What "to max" counts
Level 1→90, Promotions I–IV, all four combat skills to 12, and the Ability Matrix nodes: attribute
increases, both talents, both base skills, gear outfitting. Operator EXP is counted in the 10,000-EXP
items (Advanced Combat Records up to level 60, Advanced Cognitive Carriers above), as the wiki's own
Cost Summary does. Without talents, every operator with base skills matches the wiki's Cost Summary
exactly (a test checks it).

## Not on the wiki (shown as "No data yet")
- Amount per run: the item pages give the Sanity of each Protocol Space and its drop rate (fixed,
  random…) but not how many drop, so Farm shows amounts and where to get them, while runs, Sanity and
  days stay empty.
- Argent Flow: no wiki page yet; added by re-running the import once it exists.

## Conflicts (settled by MANAGER / the owner, never by the import)
The import stops on any disagreement between wiki sources that has no ruling in `RULINGS`
(scripts/import-endfield-costs.ts). Each ruling names the source to use and when it was given.
- **Gear Outfitting I:** all 34 operator pages say 1,600 T-Creds; the Operator page says 1,800 (and
  its Cost Summary adds up with 1,800). Ruling (MANAGER, 2026-10-15): 1,800, from the Operator page,
  which states it twice; the 1,600 is one shared template value. Unverified in game; the owner may
  correct it. With this, every operator matches the wiki's Cost Summary exactly.

## Next
- Weapon costs: built (`weaponMaterialsFor`, below).
