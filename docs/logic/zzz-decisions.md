# ZZZ kit check: decisions the method leaves open

`zzz-method.md` is the law. Where it was silent or two rules pulled apart,
LOGIC-CORE made the call below (the owner asked for no questions while away).
Each one can be changed: tell LOGIC-CORE which.

## Standing rule: both games mirror each other (owner, 2026-10-10)
The owner, word for word: "what goes for zzz or hsr goes for the other too logic core mirrors each other perfectly
up to the point where it gets game specific (aka elemtns or class or whatever u get my point no)".
So every logic rule (account notes, signature and equipped weapons, builds a team wants, the plain-words "Why",
best team found) is the same in HSR and ZZZ. Only game facts differ: elements / attributes, paths / specialties,
team size and order, and the owner's ZZZ method's own counting.

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

## Added with group E
37. **"Anomaly DMG" is a stat only some damage dealers use** (method question
    4: "a stat only some damage dealers use"). Buffs to Attribute Anomaly,
    Disorder, Assault, Burn or Corruption DMG count only when the damage
    dealer's own notes prove they deal it (Piper: "Piper's Physical Anomaly
    Buildup Rate increases"). Assault buffs stay Physical-only.
38. **Disorder and Attribute Anomaly buffs have no specialty limit** when the
    text sets none; the Anomaly DMG stat already keeps them from Attack and
    Rupture damage dealers.

## Added with groups F and G
39. **One Ether Veil: Delusion Reprise at a time.** Sunna, Aria and Nangong Yu
    all give "+50 ATK" from it, and the text says re-activating it cancels the
    existing one, so the second and third count as duplicates.
40. **Abloom-only buffs use the Anomaly DMG stat** (there is no separate
    Abloom stat yet), so they count for any Anomaly damage dealer, even one
    who never triggers Abloom. Known limit.
41. **A damage dealer gaining something from their own Quick Assist reacts to
    it** (Ellen's Quick Charge, Zhu Yuan's Shotshell, Evelyn's Binding Seal), so
    a teammate who gives them a Quick Assist makes a chain.
42. **Two different skills that each give a Quick Assist are two chains**
    (Seth), as "one chain per cause" (decision 5).

## Added with group I
43. **Shields count as team support** (stat "heal"): there is no Shield stat,
    and a shield doesn't raise damage. Ben's +16% CRIT Rate for shielded
    characters reaches the whole squad, because his Core Passive shields all.
44. **Phoenix (beta)**: her "Scorch" is read as a state on the enemy and
    counted; her text never says what applies it. Beta text can change: she is
    re-read on release, as the method says.

## Materials (step 4)
45. **Costs come from nanoka.cc** (ascension, every skill level, Core Skill,
    Traces), for every character at once: this is game data, not kit reading.
46. **ZZZ Agent EXP** is counted in Senior Investigator Logs (3,000 EXP each,
    from the item's in-game text as quoted by Icy Veins and ONE Esports).
    Checked: nanoka.cc's EXP table gives 900,000 for 1 → 60 = 300 Logs, the
    number Icy Veins lists.
47. **HSR character EXP is not counted yet**: neither nanoka.cc nor Yatta has
    the per-level table, and the wiki that has it blocks automated reading.
    The Farm says so instead of guessing.

## Added with group H: every agent is read
48. **Conditions can ask for an assist type** (Caesar: "another member who can
    activate Defensive Assist"), from the profiles.
49. **"Aftershock DMG" is a stat only some damage dealers use**, like Anomaly
    DMG (decision 37): it counts for Soldier 0 - Anby and Orphie & Magus, whose
    own text proves their damage is Aftershock DMG.
50. **Pyrois's Mindscape 6 is hidden in the game data** ("Mindscape Effect
    Hidden"); it is read when the game shows it.

## Recommended builds (step 4)
51. **Builds are the game's own recommendation** (nanoka.cc's copy of it), the
    only source that is game data rather than a guide. Guides (Prydwen and
    the like) can be added later as a second, named source.
52. **The ZZZ W-Engine shown is the agent's own**: the game files name it after
    them ("Weapon_S_<agent id>"). Agents without one show "No data yet".
53. **Build score and saving a scanned build** need a place to save builds,
    which the app doesn't have yet (FRAME's saved data). Until then the
    character page keeps saying "No build data yet".
54. **A team's first member is its damage dealer** when they can be one (the
    lead of a preset or recommended team); otherwise the method's step 1 picks.
    So "Cissia team" is scored for Cissia, not for Seed in the same squad.
55. **Recommended teams (ZZZ) come from the check itself**: for every damage
    dealer, the best squad from every agent at Mindscape 0, with the two best
    alternatives per place. Source named on each card.
56. **Builds count on top of the method (owner's ruling 2026-10-10).** `zzz-method.md` is unchanged. On top of its
    count, a squad member whose buff grows with their own stat adds points for the saved build (built +2, partly
    +1, none 0 and said), and the best squad found is scored fully built, exactly as in HSR
    (hsr-decisions.md 25–28). The method's worked examples hold at base builds: Billy > Dialyn > Lucia = 9,
    Billy > Pan Yinhu > Lucia = 10. Fully built (Pan Yinhu for ATK, Lucia for HP) the second is 14 of 14 = 100%,
    and the first is 9 of 14 = 64% with no builds saved.
57. **Every equipped W-Engine counts when its specialty is the wearer's** (T18 step 4, the standing rule): 55
    W-Engines that aren't signatures are read quote for quote; see hsr-decisions.md 29.
58. **Assume signature + average build (owner's job T34, both games, HSR decision 34 mirrors it).** With the owner's
    switch on, owned characters with no saved build are scored with their signature weapon and an average build made
    from the game's own recommendation (rules in `build-score.md`, "Assumed builds"). It is said in the Why; a saved
    build always wins; switch off = scored at base, as before.
59. **Target stats come only from numbers the game text states (owner's job T35, both games, HSR decision 35 mirrors it).**
    Kit, signature weapon and the recommended sets' own conditions, each quoted word for word with the working shown;
    no number in the text = "No data yet". Rules in `build-score.md`, "Target stats".
60. **Leaked characters in teams (owner's job T39, both games, HSR decision 36 mirrors it).** The owner: "leaked charchter cna
    also be used to build teams with. so u also know based on the leaked kit what charchter are good for it therfore u
    cna for exmaple pre upll a chacrhter". A leak (`Character.leak`) is read from its beta kit text like anyone else.
    Every team, Who fits suggestion and "If you pull" that names one says "Leak: X: unverified beta kit, may change
    (source)". A leaked carry has no game team list yet, so its teammates are whoever connects with its kit, and the
    Why says "No game team list yet". Leaks join every-character pools only when the owner shows leaks
    (`TeamAccount.showLeaks`: Roster's "Show leaked" on, Banners' "Hide leaks" off); never in the check's recommended
    teams. A released carry's own game lists don't name leaks, so a leak joins their team only if the owner adds it
    to the lists (decision 31). No new scoring.

61. **Kit value on top of the method (owner's job T30, both games, HSR decision 37 mirrors it).** zzz-method.md is
    unchanged: its count stands, worked examples included (Billy > Dialyn > Lucia counts 9). On top of it, as with
    builds (decision 56), the kit value ranks squads and gives the %: sizes from the kit text, one kind adds up,
    kinds multiply, a size without a % counts as the typical buff (rules in hsr-decisions.md 37). The owner's T38:
    Lucia's and Pan Yinhu's Sheer Force are one kind and add up, Dialyn's +40% DMG, Stun multiplier and free
    Ultimate are kinds of their own, so Billy > Dialyn > Lucia is Billy's best squad and Billy > Lucia > Pan Yinhu
    only "Partly". No role is needed unless a kit asks for it (an Anomaly squad without a Stun loses nothing).
    Same day, mirrored from HSR decision 37: like with like for a squad with a healer; a support's own damage counts,
    sized from its kit against the carry's own hit; Rupture carries get nothing from ATK buffs (owner: Astra Yao's
    ATK gives Starlight - Billy nothing).
