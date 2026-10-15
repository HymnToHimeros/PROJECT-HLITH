# Arknights: Endfield pull rules (E3)

Code: `src/games/endfield/gacha.ts`. Tests: `tests/endfieldPity.test.ts`.
Sources (read 2026-10-15): endfield.wiki.gg [Headhunting](https://endfield.wiki.gg/wiki/Headhunting)
and [Arsenal Exchange](https://endfield.wiki.gg/wiki/Arsenal_Exchange), which quote the game's rules text.

## Operators
- 6★ 0.8%, 5★ 8%. A 5★ or better at least every 10 (not used: it doesn't change 6★ odds).
- From the 66th pull without a 6★, +5% a pull (5.8%, 10.8%, …); the 80th is a 6★. The counter
  carries over between banners of the same type. Treated as the game's published rules, so both
  odds modes use it.
- Chartered (limited): 50/50 for the featured operator, **no guarantee after a loss**. Once per
  banner, the 120th pull is the featured operator if it hasn't come. Every 240th pull on the banner
  gives a copy (Potential token). Both counters reset when the banner ends.
- Urgent Recruitment: after 30 pulls on the banner, a free 10-pull at base rates. It counts toward
  nothing and can't use up the 120 guarantee, but what it gives is yours (counted as copies).
- Headhunting Dossier: after 60 pulls, the next banner's first 10-pull is free and counts normally
  (`freePulls()`; the Calculator adds it when wired).
- Basic (standard): the same 6★ odds, and a 6★ of your choice at 300 pulls (once).
- New Horizons (beginner): a 6★ within 40 pulls.
- Arsenal Tickets per operator: 2000 / 200 / 20 for 6★ / 5★ / 4★.

## Weapons (Arsenal Issue)
- Sold in issues of 10 for 1980 Arsenal Tickets; the engine counts whole issues only.
- Each weapon: 6★ 4%, of which 25% are the featured weapon.
- No 6★ in 3 issues in a row → the 4th issue has one (featured 25% of the time).
- Once per banner, the 8th issue has the featured weapon if it hasn't come.
- A featured copy at issue 18, then every 16 (a selection box at 10, 26, … is not counted).

## Worst case
Only the sure things count: the 120 guarantee (if still open) and the 240 copies for operators;
the 8th issue and the 18 + 16k copies for weapons; hard pity and the 300 pick on the standard banner.

## Not verified (say so if the game shows otherwise)
- The weapon copy cycle (18, then every 16) is our reading of "the cycle follows on every 8 issues".
- Whether the beginner banner has the soft pity (modelled without).
- RE-Factor (rerun) banners: free pulls at 30/60/90 and the 120 guarantee once per name. Not modelled yet.
