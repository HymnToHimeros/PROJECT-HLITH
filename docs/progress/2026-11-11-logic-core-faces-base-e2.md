# 2026-11-11 LOGIC-CORE: Faces of Elation at base level, Aeon ★ Aha's Eidolon 2 on top

#237 read the HSR 4.7 "Faces of Elation" traces at level 2. Level 2 is what Aeon ★ Aha's Eidolon 2 grants ("Enhances the Elation Path Ascension effects"); level 1 is the base. So teams with an E0/E1 Aha were scored with E2 numbers. SCHEDULER's #240 makes the import read level 1 for any skill an Eidolon raises. This change re-reads the sheets on top of it.

**Base numbers (traces), with Aha in the team:**

| Trace | Base | With Aha at E2 |
|---|---|---|
| Sparxie: allies' DEF ignore | 15% | 20% |
| Yao Guang: "Great Boon" multiplier | +20% | +40% |
| Aventurine • Waveflair: allies' SPD | +15% | +25% |
| Trailblazer · Elation: Ultimate CRIT DMG | +70% for all allies | +80% |

**Aha's Eidolon 2:**
- It used to be read as "nothing can be read yet". It now gives the step up from base to level 2, only for a teammate whose trace it is, and only when Aha is E2 or higher (the check locks Eidolon pieces below that).
- It gives only the difference (e.g. +5% DEF ignore), so the base line and this one add up without a "does not stack" line.

**Test:** `tests/facesOfElation.test.ts` pins base vs E2 for Sparxie and Yao Guang. With Aha below E2 the base lines apply and the step is locked. At E2 the step counts on top.
