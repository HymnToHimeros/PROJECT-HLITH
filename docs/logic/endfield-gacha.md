# Arknights: Endfield pull rules (E3)

Code: `src/games/endfield/gacha.ts`. Tests: `tests/endfieldPity.test.ts`.
Sources (read 2026-10-15): endfield.wiki.gg [Headhunting](https://endfield.wiki.gg/wiki/Headhunting)
and [Arsenal Exchange](https://endfield.wiki.gg/wiki/Arsenal_Exchange), which quote the game's rules text;
the wiki's banner list (each banner's limited operators); thegamer.com's launch banner guide (Laevatain's
first banner).

## Operators
- 6★ 0.8%, 5★ 8%. A 5★ or better at least every 10 (not used: it doesn't change 6★ odds).
- From the 66th pull without a 6★, +5% a pull (5.8%, 10.8%, …); the 80th is a 6★. The counter
  carries over between banners of the same type. Treated as the game's published rules, so both
  odds modes use it.
- Chartered (limited): 50/50 for the featured operator, **no guarantee after a loss**. Once per
  banner, the 120th pull is the featured operator if it hasn't come. Every 240th pull on the banner
  gives a copy (Potential token). Both counters reset when the banner ends.
- **What a lost 50/50 gives:** a standard 6★ *or* one of the limited operators on that banner's own
  roster. A Chartered operator is "added to the roster of available 6★s of the next two Chartered
  Headhunting banners" (Headhunting page), so you can lose the 50/50 to an earlier limited operator.
  The wiki banner list shows it: Rejuvenation (Si) also has Typhoeus and Liino; The Hearth Fire
  Beckons the Starry Flow (Argent Flow) also has Si and Typhoeus. At launch, Laevatain's banner had no
  earlier banners, so its roster held the next two of the patch, Gilberta and Yvonne (thegamer.com
  guide; the owner pulled on it). The banner data lists them in `alsoAvailable` (SCHEDULER, from the
  wiki banner list; never hard-coded here). The 50% and the 120 guarantee don't change.
- **History:** Endfield's history doesn't say which banner a pull came from, and there's no single
  standard list, so a 6★ on a Chartered or RE-Factor banner is matched to the one banner of that type
  open at the time (tools/pulls/featuredByBanner): its featured operator = a won 50/50; anything else,
  an earlier limited operator included, = a lost 50/50 (Typhoeus on Si's banner is a loss). Unknown,
  never guessed: no banner open, two open at once, or the banner's own 120th pull (a sure pull, not a
  50/50).
- Urgent Recruitment: after 30 pulls on the banner, a free 10-pull at base rates. It counts toward
  nothing and can't use up the 120 guarantee, but what it gives is yours (counted as copies).
- Headhunting Dossier: after 60 pulls, the next banner's first 10-pull is free and counts normally.
  The Planner adds those 10 to a banner's "Have now" and "By end" when history shows 60+ pulls on the
  banner before it and none on it yet (`carryOver` in the model, `carryIn` in tools/pity).
- RE-Factor (rerun): the same, with free 10-pulls after 30, 60 and 90.
- Basic (standard): the same 6★ odds, and a 6★ of your choice at 300 pulls (once).
- New Horizons (beginner): a 6★ within 40 pulls.
- Arsenal Tickets per operator: 2000 / 200 / 20 for 6★ / 5★ / 4★. For sure: at least 38 a pull on
  average (nine 4★ and one 5★ in every 10). The Calculator counts only that floor, under its own
  "Arsenal Issue" line: tickets you have and will earn, plus at least 38 for each operator pull.

## Prices (contract currencies)
- Oroberyl: 500 a pull on operator banners. Permits: 1 each on their banners.
- Arsenal Tickets: 198 a weapon pull (1980 an issue); weapon pulls only count in whole issues.
- Origeometry (paid): 75 Oroberyl (6.67 a pull) or 25 Arsenal Tickets (7.92 a weapon pull).
- The weapon banner takes only Arsenal Tickets and Origeometry (`currencies` on its banner type).

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
- RE-Factor (rerun): its 120 guarantee and free pulls happen once per banner name across reruns;
  the model treats each run as new, so a second run of the same banner may give less than shown.
- Joint banners: rules not confirmed; FRAME's placeholder stays (standard 6★ odds, no featured rule).
- The beginner banner's own rate isn't published: worst case 40 is shown, chances say "no data".
