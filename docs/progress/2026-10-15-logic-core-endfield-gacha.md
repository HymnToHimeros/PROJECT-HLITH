# 2026-10-15 · LOGIC-CORE · E3 Endfield pity and odds (part 1)

Done:
- The pity engine takes a game's own rule as "every result of the next pull"
  (contract `custom` PityModel), so Endfield needs nothing in tools/.
- Endfield rules in src/games/endfield/gacha.ts: limited, standard and beginner
  operators; weapon issues. Written down in docs/logic/endfield-gacha.md.
- Planner, History, Luck report, badges and the character page read pity
  through hardPityOf / featuredOf / stepOf, and know a 50/50 with no guarantee.
- HSR and ZZZ results pinned (tests/pityPinned.test.ts): unchanged.

Next (after FRAME's E1): put these models in the Endfield contract's banner
types, the weapon tickets in its currencies, and the Dossier in the Calculator.
