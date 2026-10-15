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
exactly (a test checks it).

## Not on the wiki (shown as "No data yet")
- Sanity per run and amount per run of each Protocol Space: Farm shows amounts, but runs, Sanity and
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
- Where each item comes from (`Material.sources`, from the item pages and the Protocol Space page):
  approved by MANAGER, its own PR.
- Weapon costs: not now (no screen yet; new screens need the owner's design OK). Where the data is:
  - **Weapon page** (endfield.wiki.gg/wiki/Weapon, "Level"): Weapon EXP items Arms Inspector (200),
    Arms INSP Kit (1,000), Arms INSP Set (10,000); weapons used as material give 500 / 1,500 /
    10,000 / 30,000 EXP by rarity (3★–6★). Cumulative from level 1: level 20 = 8,890 EXP and 640
    T-Creds; 40 = 105,540 and 10,400; 60 = 290,540 and 29,010; 80 = 1,203,710 and 123,850;
    90 = 2,524,080 and 341,390 (a per-level table like the Operator page's is expected there too).
    Excess EXP above a cap is partly returned in 200-EXP steps.
  - **Weapon page, "Tuning":** every weapon starts at Tuning Stage 0 with level cap 20; each stage
    raises the cap.
  - **Each weapon's page** (`Weapon data`): tuning costs `t1`…`t4`, e.g. Amaranthine Tassel
    t1 = Cast Die 5, Kalkonyx 3, T-Creds 2,200 … t4 = Heavy Cast Die 30, Quadrant Fitting Fluid 16,
    Igneosite 8, T-Creds 90,000.
  - Weapon progression Protocol Spaces: Weapon EXP (Arms Inspector, INSP Kit, INSP Set) and
    Weapon Tune (Cast Die, Heavy Cast Die).
  - Shape when it's wanted: `GameRules.weaponMaterialsFor(weaponId, from, to)`, the same as
    `materialsFor`.
