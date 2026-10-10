# ZZZ kit check: decisions the method leaves open

`zzz-method.md` is the law. Where it was silent or two rules pulled apart,
LOGIC-CORE made the call below (the owner asked for no questions while away).
Each one can be changed: tell LOGIC-CORE which.

## Counting
1. **The count is built exactly as the formula is written.** The method also
   lists improvements for "the rebuild": weights by kind, role coverage, and
   upgrades counted as part of the ability they upgrade. No weights or role rules
   are written down, so they are **not** built; they stay listed as known
   limits. Result: Billy > Dialyn > Lucia = 9, Billy > Pan Yinhu > Lucia = 10,
   matching the method's own worked examples (tests:
   `src/games/zzz/kitcheck/check.test.ts`).
2. **An "ability" is one cheat-sheet entry.** The method says to cut a kit into
   "one piece per thing that works on its own", so Dialyn's Additional Ability
   is three entries (+40% DMG for the squad, her own EX CRIT DMG, extra damage
   from the previous member). Each entry that is off counts −1.
3. **Off counts for every member's entries**, not only the damage dealer's,
   because the formula says "abilities off" without limiting it.
4. **Teammates' buffs to themselves are team support** (tie-break only), as in
   the worked example ("Her own EX CRIT DMG … tie-break only").
5. **One chain per cause.** If one event (Dialyn's free Ultimate) sets off
   several reactions in the damage dealer's kit, it counts once, as in the worked
   example.
6. **A chain needs the damage dealer's reacting ability to be on.** If Billy's
   Starlight is off, the free Ultimate is not a chain to him.
7. **Weak fit** (step 7): a teammate is a weak fit when nothing they bring is
   counted for the damage dealer (no buff that reaches them, no chain to them,
   and they don't switch on one of their abilities).
8. **Stats only some damage dealers use** (Sheer Force, Sheer DMG, Max HP,
   Anomaly Proficiency, Anomaly buildup) count only when that damage dealer's
   notes (Part A step 5) say their damage uses it. Other damage stats count for
   everyone unless the notes say the damage ignores them (Billy ignores DEF).
9. **Two damage dealers of the same kind** (e.g. two Attack characters): the
   check tries each as the damage dealer and keeps the best result.

## Reading (Part A)
10. **Core Passive numbers are shown at Core Skill level 7** (the highest).
    Numbers never change the count.
11. **Level formulas** in the game text are written out the way the game
    computes them, e.g. "(34 + 3 × Special Attack level)".
12. **Lucia's Mindscape 1 RES ignore is unverified**: it says "when Dreamer's
    Nursery Rhyme deals additional DMG", but Nursery Rhyme raises the DMG others
    deal and never deals DMG itself. Shown, never counted. Its other half
    (Echo reapplies Nursery Rhyme) counts as an upgrade.
13. **Pan Yinhu's Meridian Flow goes to the character before him**, as the method
    says ("only to the character his Quick Assist brings in").
14. **"Whoever switches in"** (Dialyn's free Ultimate) counts as reaching the
    damage dealer, as in the worked example.

## Your account
15. **Mindscapes come from your roster** on the site (not owned = M0).
16. **Agent Potential isn't saved by the app yet.** Anything that needs a
    Potential level shows "locked: Potential isn't saved yet" and never counts,
    until a Potential field is added to the roster (FRAME's saved data).

## Synergy %, Line-ups, Who fits, If you pull
17. **Synergy %** compares with the best squad from your agents **plus the
    squad's own members**, so a preset that uses someone you don't own can't go
    over 100%.
18. **Only agents whose kits have been read take part.** A squad with an unread
    member says "not rated yet" instead of a number.
19. **"Connects with everyone"** in Who fits means: the suggestion brings
    something to the damage dealer, or, if the suggestion is the damage dealer,
    every other member brings them something.
20. **Big rosters**: with more than 10 possible partners, the 10 best in pairs
    go on to trios (method: Line-ups step 2). Line-ups keep each damage
    dealer's 5 best squads before picking the set with no character twice.
21. **Best fit for me** (Characters → Sort) ranks by the "If you pull…" %
    (for an owned agent: what your teams lose without them). Unread agents come
    last.

## Added with group B
22. **Released agents are read from the live game version** (nanoka.cc's
    manifest names it, 3.2 today); only unreleased agents use the newer beta
    files, marked beta. Roxy's beta file had blank pieces mid-rewrite.
23. **Glossary words the files leave blank** (Roxy's "Wind Energy", "Eye of the
    Storm", "Cleanse") are filled from the same game text on zzz.gachabase.net
    (another game-data site), matched by context and listed in the importer.
    An unknown one stops the importer.
24. **Agent Potential** has two versions of some pieces: the base text (until
    Potential I) and the Potential text. With Potential unknown, the base counts
    and the Potential version is locked; with Potential saved, the base shows as
    "Replaced" (method: a stronger version replaces the weaker one).
25. **Hugo's "1/2 Stun characters: ATK +300/900"** is read as two entries: +300
    with one Stun teammate, +900 (an upgrade) with two. As the method counts
    upgrades as their own entries, two Stun characters switch on both.
26. **Roxy's Mindscape 6 Wind RES ignore is unverified**: "The DMG dealt by
    attacks ignores 15% …" doesn't say whose attacks.
27. **Sunna's Cat's Gaze** counts as a buff for Attack and Anomaly damage
    dealers: the extra hit "is treated as DMG dealt by the triggering Agent".

## Added with group C
28. **"Their abilities switched on" only counts abilities that help the damage
    dealer.** Seed's Direct Strike goes to her "Vanguard" (an Attack teammate),
    so when Seed is the damage dealer it is shown but not counted; when the
    teammate is the damage dealer it counts as a buff. New recipient: "one
    teammate".
29. **Norma's Chain Attack and Mindscape 4 Decibels go to the character before
    her**: her Core Passive replaces "the Quick Assist" of Hat Trick, which the
    text gives to the previous character.
30. **Cissia's "1/2 Electric characters" counts herself**, so the first tier is
    always on and the second needs another Electric character.
31. **Numbers from the old app differ for some squads** (Harumasa + Norma + Lucy:
    7 then, 5 now; Cissia + Dialyn + Rina: 5 then, 6 now). The worked examples
    in the method (Billy 9 and 10, Banyue 9, Ye 9) all match exactly; the others
    came from the old app's own reading and can't be checked line by line.

## Added with group D
32. **One ability can react to several events** (Manato's Remnant Flame: his
    Ultimate and his Chain Attack).
33. **Claret's damage ignores ATK and CRIT DMG buffs**: "skill DMG Multipliers
    are based on DEF" and she "doesn't receive the CRIT DMG Bonus". The ATK
    part is a reading of the DEF sentence.
34. **Some kits score high because their Additional Ability is several
    entries** (Yixuan: four). That is decision 2 as the method is written; the
    method's own "rebuild" list (weights by kind) is the real fix.
35. **Text that says "attacks ignore … RES" without saying whose is
    unverified** (Yixuan M2, Claret M2), as Roxy M6.
36. **Abilities that work "within Ether Veil: Wellspring"** (Yidhari) are not
    reactions to every Ether Veil: other characters' Veils have other names.
