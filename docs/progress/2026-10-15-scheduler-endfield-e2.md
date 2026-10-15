# 2026-10-15 · SCHEDULER · Endfield E2: game data

- Done: `npm run data:endfield` (scripts/import-endfield.ts, rules in scripts/endfield/map.ts, tests/endfieldImport.test.ts) fills src/games/endfield/data from endfield.wiki.gg's Cargo tables (CC BY-SA), with versions checked against the official Gryphline update notes:
  - 7 versions; current 1.6 "Sanctuary of Ink".
  - 29 operators (6★/5★; the 4★ ones wait for the 'low' tier).
  - 78 weapons.
  - 39 banners (chartered, rerun, joint, basic, beginner, weapon).
  - 90 events (Contingency Contract = endgame).
- Server times are marked like HSR/ZZZ (Asia UTC+8, Americas / Europe UTC-5). The contract now lists sources for servers and resets.
- Rhythm: Endfield's notice offsets are learned from Gryphline posts (pre-download notice 48 h, guide page about 208 h before the patch). Each game's version length now comes from its own history. The due check covers every game with a versions list.
- The data refresh runs the import. The research routine reads Endfield's official news (no leak job for Endfield).
- Left out honestly (notes in the import):
  - Event rewards: prose only, so null.
  - Events without dates, and one wiki row with its end before its start.
  - The Argent Flow banner, until the wiki has her.
  - 4★ operators and 3★ weapons, until the rarity tier exists.
