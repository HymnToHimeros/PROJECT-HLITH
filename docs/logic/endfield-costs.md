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

## What "to max" counts
Level 1→90, Promotions I–IV, all four combat skills to 12, and the Ability Matrix nodes: attribute
increases, both talents, both base skills, gear outfitting. Operator EXP is counted in the 10,000-EXP
items (Advanced Combat Records up to level 60, Advanced Cognitive Carriers above), as the wiki's own
Cost Summary does. Without talents, every operator with base skills matches the wiki's Cost Summary
exactly, apart from the conflict below (a test checks it).

## Not on the wiki (shown as "No data yet")
- Sanity per run and amount per run of each Protocol Space: Farm shows amounts, but runs, Sanity and
  days stay empty.
- Argent Flow: no wiki page yet; added by re-running the import once it exists.

## Conflicts (listed by the import, for a person to settle)
- **Gear Outfitting I:** all 34 operator pages say 1,600 T-Creds; the Operator page says 1,800 (and
  its Cost Summary adds up with 1,800). HLITH uses each operator's page until this is settled.

## Next (needs core changes, MANAGER's call)
- Where each item comes from (`Material.sources`, from the item pages and the Protocol Space page).
- Weapon costs (`weaponMaterialsFor`: tuning t1–t4 from each weapon page, weapon EXP).
