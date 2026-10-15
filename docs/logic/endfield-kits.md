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
- kits.json stays game text only (`does` is empty there); the tags come from the cheat sheets
  (src/games/endfield/kitcheck/sheet/), and operators without a sheet say "Not read yet".

## Progress
- E6b (done): the Endfield Kit check engine and method (docs/logic/endfield-method.md); group A:
  Chen Qianyu, Da Pan, Catcher, Antal, Endministrator (both), Lifeng.
- E6c (done): group B: Laevatain, Akekuri, Wulfgard, Ember, Yvonne, Last Rite, Ardelia, Gilberta.
  Reactions from two elements' Inflictions are now worked out (method decision 5).
- Next, about 8 per PR: Pogranichnik, Rossi, Zhuang Fangyi, Mi Fu, Arcane, Camille, Typhoeus, Liino,
  Si, Tangtang, Perlica, Arclight, Xaihi, Avywenna, Snowshine, Alesh, Estella, Fluorite, Purrchena.
