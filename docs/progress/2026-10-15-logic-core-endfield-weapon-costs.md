# 2026-10-15 · LOGIC-CORE · E7 step 2b: Endfield weapon costs

Done:
- `GameRules.weaponMaterialsFor(weaponId, from, to)` → `{ needs, partial? }` (core, optional).
- Endfield: all 78 weapons' tuning stages 1–4 from their wiki pages, checked against the Weapon
  page's Tuning table (no conflicts), plus Weapon EXP and T-Creds.
- The wiki gives weapon EXP only as totals at levels 20/40/60/80/90, so a range between those
  levels says what it leaves out (`partial`); to max from level 1 is exact.
- FRAME builds the weapon-page section that shows it.
