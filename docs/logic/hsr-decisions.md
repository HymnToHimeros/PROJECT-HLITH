# HSR Kit Check: decisions

Calls made while reading the kits and building the check, where the theory
(`hsr-theory.md`) left room. Each one is applied the same way to every kit.
Numbered so later changes can point at them.

## Standing rule: both games mirror each other (owner, 2026-10-10)
The owner, word for word: "what goes for zzz or hsr goes for the other too logic core mirrors each other perfectly
up to the point where it gets game specific (aka elemtns or class or whatever u get my point no)".
So every logic rule (account notes, signature and equipped weapons, builds a team wants, the plain-words "Why",
best team found) is the same in HSR and ZZZ. Only game facts differ: elements / attributes, paths / specialties,
team size and order, and the owner's ZZZ method's own counting.

## Engine

1. **A DoT is a debuff.** A reaction to debuffs (Acheron's Talent) also takes
   a teammate's DoT (Burn, Shock, Bleed, Wind Shear). A kit that marks its Burn
   as both is still counted once.
2. **One chain per teammate per reaction.** A teammate with two entries that
   feed the same reaction of the damage dealer's chains once; the second is
   shown as "already chains".
3. **Two options in one kit are not a duplicate.** When one kit has two
   effects of which only one applies at a time (March 7th (Hunt)'s "Shifu"
   bonus by path, Anaxa's Trace and her Eidolon 6 version), they share a
   no-stack key: the first that is on counts, the other is shown, never −1.
   An option that is off while its other version is on is not "off" either.
4. **Self-only buffs never reach the damage dealer** and are not team support
   (v1 counted them as tie-breaks; that let a second carry look useful).
5. **A teammate who brings only team support is not a weak fit.** Healers and
   shielders pass; a second damage dealer who only buffs themself is a weak
   fit (−1).
6. **The Trailblazer is one character**: at most one Trailblazer form in a
   team (Line-ups, Who fits, best teams).
7. **Sustain**: a team without a healer, shield, Preservation or Abundance
   character says "no sustain" next to its label.
8. **Each teammate counts each stat once** (theory Part B step 4). Readers
   cut kits differently (one sentence or three); counting stats, not
   sentences, makes the count the same either way. A stat limited to one
   damage kind is its own stat.
9. **Sustain first when comparing teams**; partners are shortlisted as the 10
   best by count plus the 3 best who bring sustain.
10. **Acheron's "The Abyss" has two tiers**, one per other Nihility, as two
    entries (her Eidolon 2 makes the full tier need only one).
11. **Best-team answers are kept** while the roster and levels stay the same
   (both games), so a screen full of teams doesn't redo the same search.

## Reading

12. **Events a kit makes on purpose, one per kind per character.** A kit's
   main source of each event is marked; its Enhanced version repeats it (the
   two are never on together).
13. **Freeze, Imprison, Entanglement** = a debuff the kit causes plus enemy
    delay (team support).
14. **Taunt** ("more likely to be attacked", Taunted) is team support.
15. **Skill Points given** are a buff only for carries whose notes say they use
    Skill Points (Archer, Dan Heng • Imbibitor Lunae, Qingque, Rin Tohsaka,
    Sparxie, Silver Wolf LV.999, Misha); team support for everyone else.
16. **Spending your own HP counts as HP loss** for kits that react to allies
    losing HP (Castorice, Mydei, Evernight, Jingliu's Enhanced Talent).
17. **Conditions on a named character** ("Saber is in the team", "Archer is in
    the team", Cyrene's Odes for one character) and "only / no other X
    character" are written as unknown: shown, never counted.
18. **Stats the sheet doesn't have** (damage reduction, Effect RES, enemy ATK or
    SPD down, removing enemy buffs) are read as nothing for the damage dealer.
19. **Damage notes are written only from quotes.** Aventurine • Waveflair's
    Elation Skill counts as a Follow-Up ATK only when he is the only Elation
    character, so his notes don't list Follow-Up ATK.
20. **Aeon ★ Aha** is read from beta game files (not released). Its Eidolon 2
    text is still a placeholder in the files, so it's listed as nothing.

## Teams players actually run (owner's report T19)

21. **Centres come from the game's own teams.** A character is a team's centre
    only when the game's own recommended teams are built around them. Cause of
    the report: every Hunt/Erudition character could be a centre, and the
    game's team for March 7th (Hunt) was imported with March 7th first, though
    the game builds that team around Feixiao.
22. **Game teams are shown in the game's own order, led by their centre**
    ("Feixiao team · with March 7th"); the same four first picks from several
    pages are shown once.
23. **No made-up "best by kit check" team list for HSR.** The search kept
    finding the same generic buffers for every carry. The game's teams are
    listed and scored instead; the search still powers Line-ups, Who fits and
    If you pull, and another centre is only a teammate where the game pairs
    them.

24. **Signature weapons are kit pieces, counted only when equipped (T18, both
    games).** Each signature Light Cone / W-Engine effect is read like any
    other piece, quote for quote. It is locked unless that exact weapon is in
    the character's saved build; the "Why" says which weapon was saved
    instead. Effects that only raise the wearer's own stats are listed as
    read with "nothing for the team" (a support's own Energy, Daze or Impact
    included). A weapon line that repeats an event the kit already causes
    is not a second event source. Pearl's Colors for Tomorrow has no effect
    text yet, so it isn't read; it will be once the text exists.
25. **A bigger stat on a teammate raises the team score, roughly (owner, T18).** Buffs that grow with the giver's
    stat carry `scales`; when they count, the team wants that build. The saved build is read in bands (built +2,
    partly +1, not 0, no build 0 and said), never as damage math. Per team: Robin • Summeretto is an HP build with
    Phainon because her "Deviated Chords" ATK buff is "(16% + Vibes × 0.4%) of Robin • Summeretto's Max HP".
26. **The best team found assumes ideal builds.** So 100% = the right members and built right; an unbuilt team says
    which builds would close the gap. A team you haven't built scores lower than before this rule; that is the
    owner's "the value increases" read from the other side.
27. **Thresholds count as wants when the stat is clearly the giver's.** Ruan Mei's and Lingsha's Light Cones (150%
    Break Effect), Fugue's 220% Break Effect, Cyrene's 180 SPD: the team wants that stat on them, so they are wants;
    whether the threshold is reached is not checked (no total stats saved yet).
28. **ZZZ counts builds too (owner's ruling 2026-10-10, see the standing rule above).** Same bands, same wants,
    same "Why"; ZZZ's 28 scaling lines (Astra Yao's ATK, Lucia's HP, Pan Yinhu's ATK…) count as HSR's do. The
    method's worked examples hold at base builds (zzz-decisions.md 56).
30. **Only a carry's own game team is a team; no mix-matching (owner's report 2026-10-10).** The owner: "the march
    team once again as example is bs no one runs march with phainon … I don't want random mix matching … if units
    exist that do a job better obviously they should be picked". Cause: every character's page in the game shows a
    starter line-up that forces that character beside today's top carry (March 7th's page: Phainon, March 7th, …);
    decision 22 showed them as the carry's teams. Now:
    - a team is shown only from its carry's own page (the page's character is a carry, in the team, and no other
      carry is fixed alone in a slot: that marks a partner's page, e.g. Topaz's "Feixiao | Topaz | …");
    - each slot is filled from your roster in the game's order: the first listed character you own, never one
      twice (`src/core/rules/fillTeam.ts`, both games); a slot with none of yours shows its first pick;
    - a carry's teammates are only the characters its own game team lists, in every place teams are made: best
      team found, Who fits, Line-ups, If you pull. A team you made yourself is compared with the best team that can
      also include its own members. 51 of 53 carries have an own team; Trailblazer · Destruction (Stelle) and
      Aeon ★ Aha fall back to the pairing rule (decision 21) until the game lists one.
    Acceptance test (team.test.ts): owning Phainon, Sunday, Cerydra and Dan Heng • Permansor Terrae, his one team
    is exactly those four; no March 7th / Asta / Bronya team, and none of them (nor Tingyun, Sparkle) is suggested.
    ZZZ has no game team lists in its data, so its squads stay from the check (zzz-decisions 55), filled the same way.

