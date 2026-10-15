# Arknights: Endfield kits (E6)

## E6a: kit text (done)
- `npm run data:endfield-kits` (scripts/import-endfield-kits.ts) writes `src/games/endfield/data/kits.json`
  for every operator in `characters.json`.
- Source: each operator's page on endfield.wiki.gg (CC BY-SA 4.0). Every kit names its page and the
  page revision it was read from. The wiki's Abilities Cargo table covers only 2 operators, so the
  script reads the page templates instead: `{{Combat skill}}`, `{{Operator talent}}` and the
  `pot1`–`pot5` fields of `{{Operator data}}`.
- Each kit holds:
  - Basic Attack, Battle Skill, Combo Skill, Ultimate, with their numbers at level 12 (the highest:
    9 + 3 Specializations). A page that shows a skill set per tab (Arcane's Array Arcana: INT / WILL)
    keeps each tab apart, its name in the id and the label.
  - Talents: the highest Elite text. Gear unlocks (Outfitting) are left out.
  - Potentials 1–5, unlocked at their level.
- Markup becomes plain words; anything the script doesn't know stops it, so nothing is guessed.
- Nothing is read yet (`does` is empty): the character page says "Not read yet".

## Next
- E6b: the Endfield Kit check engine, the same method as ZZZ (docs/logic/zzz-method.md): entries
  with word-for-word quotes, Endfield's stats (Physical / Arts DMG, Susceptibility, Vulnerability,
  inflictions, Stagger, SP, Ultimate Energy, combo triggers), classes and elements as conditions.
- E6c+: the sheets, about 8 operators per PR.
