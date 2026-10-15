# 2026-10-15 · FRAME: weapon page with Materials to max

Branch `claude/zen-clarke-up2y9d`, commit `c980c44`.

Roster → Weapons tab now has a full weapon detail page (hero, effect card,
"Materials to max" section). The materials section shows "No data yet" until
a game implements `weaponMaterialsFor` on `GameRules`; when it does, amounts
appear the same way character materials do.

- **`GameRules.weaponMaterialsFor`**: new optional rule, same signature as
  `materialsFor` but for weapons.
- **`weaponFarmPlan()`** in `plan.ts`: mirrors `farmPlan()` using the new rule.
- **`WeaponPage.tsx`**: hero (art, rarity/role/source chips, signature note),
  effect card, materials-to-max card.
- **`Weapons.tsx`**: grid with search + sort (name / rarity), tile art, rarity
  edge.
- **`RosterScreen.tsx`**: wired weapons tab, weapon page navigation,
  `WeaponPageWrapper` helper.
- **`modules.ts`**: added `{ id: 'weapons', label: 'Weapons' }` to roster tabs.

All 50 roster tests pass. TypeScript typecheck clean.
