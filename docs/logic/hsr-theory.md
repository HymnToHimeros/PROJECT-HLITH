# HSR Kit Check: the theory (v2)

Written by LOGIC-CORE in the spirit of the owner's ZZZ method
(`zzz-method.md`), fitted to Honkai: Star Rail. v1 was a proposal; the owner
asked for it to be tightened and built ("fix the logic for HSR, tighten it and
make it make sense"). v2 is what the code does
(`src/games/hsr/kitcheck/`). Every rule below is applied the same way to every
kit; where v1 was loose, v2 says exactly what counts.

## What it is

Same as ZZZ: fixed rules, no guessing, no damage numbers, every claim backed
by an exact quote from the game. Two jobs:

1. **Reading** (slow, once per character and patch): cut each kit into
   abilities and answer seven questions. The answers are the cheat sheet
   (`src/games/hsr/kitcheck/sheet/group*.ts`), tested word for word against the
   game text.
2. **Checking** (fast, any time): look the four team members up and apply the
   checklist.

The result is a **count**: how many of the four kits connect with the damage
dealer. A higher count means more connects, not more damage.

## What differs from ZZZ, and why

| | ZZZ | HSR |
| --- | --- | --- |
| Team | 3, in an order (A > B > C) | 4, **no order** (nothing in HSR scoring depends on position) |
| Who someone is | specialty, attribute, faction | **path, element** |
| Who carries | the specialty decides | the **kit** decides: only characters whose sheet has damage notes can carry |
| What limits a buff | attribute, specialty, position | element, path and **damage kind** ("Follow-Up ATK DMG", "Break DMG", "Ultimate DMG", DoT) |
| Events | Quick Assist, Chain Attack, Ultimate, Ether Veil | Follow-Up ATK, summon/memosprite attack, debuff, DoT, HP loss, Elation Skill, extra turn |
| Upgrades | Mindscape 1–6, Agent Potential | **Eidolon 1–6**, the **Enhanced** kit (Traces count as unlocked) |
| Weak fit | only for Rupture, Armorer, Anomaly | for **every** damage dealer: four slots, each must bring something |
| Extra | | **Sustain check**: a team with no healer or shield says so |

## Part A: reading one character (the rules every reader follows)

1. **Text**: Basic ATK, Skill, Ultimate, Talent, Technique, extra skills
   (Enhanced Basic ATK, Elation Skill…), memosprite skills, the three major
   Traces, Eidolons 1–6, and the Enhanced kit when the game has one. Every
   piece is either read into entries or listed under "nothing" with a reason.
2. **Profile**: path and element come from the character list, never typed by
   hand.
3. **Damage notes** (who can carry). Written for every Destruction, Hunt and
   Erudition character, and for anyone else only when their kit makes their
   own damage the point (Acheron, Kafka, Black Swan, Castorice…). Supports who
   also deal some damage (Robin, Jiaoqiu, Sunday) get none: they are never
   picked as the damage dealer. (Topaz is Hunt, so she has notes; in a team
   with Feixiao, Feixiao is the lead.) Each note lists:
   - **kinds** of damage they deal as their main damage (Basic ATK, Skill,
     Ultimate, Follow-Up ATK, DoT, Break, Super Break, Additional DMG,
     memosprite, Elation, True DMG). "Considered as a Follow-Up ATK" adds
     Follow-Up.
   - **uses**: the specific stats their damage scales with or needs (HP, DEF,
     Break Effect, Weakness Break Efficiency, Effect Hit Rate, Elation, Energy
     Regeneration, Skill Points), only with a quote that says so.
   - **ignores**: general stats that do nothing for them (CRIT for a DoT or
     Break carry whose damage cannot crit; ATK for a carry whose damage is
     based on HP or DEF only).
   - the quotes that prove each.
4. **One entry per effect.** One sentence that gives one buff (even with two
   stats, "DMG +32% and Weakness Break Efficiency +50%") is one entry. An
   Eidolon that strengthens a buff is its own entry (it has its own lock).
5. **The seven questions for every entry:**

| # | Question | The rule |
| --- | --- | --- |
| 1 | When is it on? | Only a **team** condition counts: a number of characters of a path or element (Acheron: "1 or 2 Nihility characters other than Acheron" = at least 1 other Nihility). Anything else that is about the team but not path or element is "unknown" and never counts. HP thresholds, enemy states, stacks are **setup** (question 6), not conditions. |
| 2 | What does it give? | The stat and the kit's own number. |
| 3 | Who gets it? | self · all allies · teammates (all allies but the owner) · one chosen ally (the player picks the damage dealer) · the enemy (debuffs). |
| 4 | Any limits? | Element, path, **damage kind**. |
| 5 | Event? | **Causes**: the kit makes it happen on purpose (Follow-Up ATK, summon or memosprite attack, a debuff, DoT, allies' HP loss, Elation Skill, extra turn). A plain Basic ATK, Skill or Ultimate is never an event. A character is marked as causing each kind at most once (their main source), so one kit can't chain three times for the same thing. **Reacts**: the kit does something when someone makes that event, and says whose: their own only, teammates, or any ally / any unit. |
| 6 | Setup? | What must happen in the fight, or "nothing". |
| 7 | Level, stacking? | Base, Trace (assumed unlocked), Eidolon 1–6, Enhanced. Two sources of the same named buff count once. Unclear text is "unverified": shown, never counted. |

6. **Techniques** are used before a battle: always "nothing" for the team.
7. **Proof**: tests check every quote is word for word in its piece, every
   piece is read, every entry answers setup.

## Part B: checking a team

1. **The damage dealer.** Teams are built around **centres**: characters the
   game's own recommended teams are built around (a game team's first member,
   or the page's character when the first member can't carry). March 7th
   (Hunt), Topaz, Moze, Dr. Ratio, Herta, Serval, Jade and Black Swan can
   carry, but the game only ever pairs them with another carry (Feixiao, The
   Herta, Kafka), so they are partners, not centres. In a team, a centre in it
   is the damage dealer (a preset's lead when the lead is one); with no centre,
   each member who can carry is tried (Destruction, Hunt, Erudition first) and
   the better result is kept. No one can carry: "no damage dealer", not rated.
   **Teammates:** anyone who isn't a centre; another centre only when the
   game's own teams put the two together (Saber with Gilgamesh).
2. **No order.** The four are checked as a group.
3. **Status of every entry**: locked (Eidolon too low, or the Enhanced kit,
   which HLITH does not save yet), replaced (the Enhanced version is on), on,
   off (its team condition isn't met), unknown.
4. **Buffs**: an entry of a teammate's that is on reaches the damage dealer
   when it goes to all allies, teammates, a chosen ally or the enemy, passes
   element, path and damage-kind limits, and gives a stat their damage uses
   (general stats unless their notes say "ignores", specific stats only when
   their notes say "uses"). SPD and action advance are general: turns are HSR's
   main currency. A buff only for the giver never reaches anyone.
   **Each teammate counts each stat once**, however many sentences give it
   (Robin's "+20% CRIT DMG" and a second CRIT DMG line count once). A buff
   for one kind of damage ("CRIT DMG for Follow-Up ATKs") is its own stat:
   that is what makes a team fit, so it counts beside the plain one. This
   keeps the count about what a kit gives, not how its text is cut up.
5. **Switched on**: an ability of the damage dealer's own with a team
   condition that the team meets, +1, with the teammates who meet it.
6. **Chains**: a teammate's entry causes an event, and the damage dealer has a
   reaction that is on and takes teammates' or anyone's events of that kind.
   A reaction to their own events only is not a chain.
7. **Duplicates**: the same named buff twice, the second −1.
8. **Weak fit**: a teammate who brings no buff, no chain, no switch-on and no
   team support for the damage dealer, −1.
9. **Count**: +1 per buff, switch-on and chain; −1 per ability off, duplicate
   and weak fit. Team support (healing, shields, cleanse, energy, Skill Points
   for a carry who doesn't need them, enemy delay, taunt, revive) only breaks
   ties.
10. **Sustain check**: a Preservation or Abundance member, or an entry that is
    on and heals or shields allies. Without one the label says "no sustain".
    Not in the count, but when teams are compared (best team, Line-ups,
    recommended teams) **a team with sustain always beats one without**: an
    HSR team that can't heal or shield doesn't last, whatever it counts.

## Synergy %, Line-ups, Who fits, If you pull

Exactly as in ZZZ, with teams of four:

- **Synergy %** = this team's count ÷ the best count the check finds for the
  same damage dealer from your characters × 100. Labels: 85%+ Excellent, 65–84
  Good, 45–64 Partly, under 45 Weak, fewer than four members Incomplete.
- **Line-ups**: your best teams with no character twice (a big roster: the 10
  best partners by pair count, plus the 3 best who bring sustain, then every
  team of four from them).
- **Who fits**: everyone whose kit really connects with the team, saying how.
- **If you pull…**: as a damage dealer and as a teammate, the better of the two.
- **Recommended teams**: the game's own recommended teams, each built around
  its centre and scored by the check (with the game's backups per place). The
  check's own "best possible" search is used for your Line-ups, Who fits and If
  you pull, not as a list of made-up teams.

## Builds a team wants (T18, owner's rule, 2026-10-10)
The owner: "yes as the value of said character increases … if you run Robin with Phainon her value is taken as an
HP-only user for her build itself, which makes her scale differently than in a team with someone who wants a different
build on her … only a thing when she even is built … I want to have the option to see which [build fits which team]."
1. A cheat-sheet entry whose amount grows with the giver's own stat ("equal to 16% of Robin • Summeretto's Max HP")
   carries `scales: { stat, quote, gives? }`; the quote is word for word from the same piece (tested).
2. When that entry counts as a buff for this team's damage dealer, the team **wants** that build on the giver. Wants
   are per team: a buff that doesn't count for this damage dealer asks nothing.
3. The saved build is read roughly, in bands (`src/core/rules/buildFit.ts`): each main stat of that stat on a slot that
   could roll something else counts 5, each sub-stat roll of it 1; full marks = every such slot plus 5 rolls.
   80%+ of full marks = built for it (+2), 35%+ = partly (+1), less = not built for it (0), no build saved = 0
   ("no build saved, scored at base"). Only characters you own have a build read.
4. The best team found assumes every member built for what it wants, so 100% means the team is also built right.
5. On screen: every team's "Why" has "Builds this team wants" (what, yours, the fit, the kit line), and "To reach
   100%" names the builds still missing. The character page has "Builds their teams want": one line per stat with
   the teams that want it.
6. Effects with a hard threshold ("at 150% Break Effect") need real total stats, which builds don't hold. Where the
   team clearly wants that stat on the giver, the entry is read as a want too (decision 27); the threshold itself is
   not checked until totals are saved.

## Worked examples

The numbers the check gives for these teams are tested in
`src/games/hsr/kitcheck/team.test.ts` and listed in `docs/logic/hsr-decisions.md`
with the lines that earned them.

1. **Feixiao + Topaz + Robin + Aventurine** (follow-up), **count 9**:
   Topaz's "Proof of Debt" counts because Feixiao deals Follow-Up ATK DMG;
   Topaz's and Aventurine's Follow-Up ATKs chain into Feixiao's Talent
   ("After Feixiao's teammates attack…" reacts to teammates); Robin's five
   different stats; Aventurine's shields are team support.
2. **Acheron + Jiaoqiu + Pela + Aventurine** (debuff), **count 9**: both
   tiers of Acheron's Trace "The Abyss" are switched on (one per other
   Nihility); each teammate's main debuff chains into her Talent ("When any
   unit inflicts debuffs…"). Swap Pela for Robin: the second tier is off (−1)
   and one chain is gone.
3. **Firefly + Ruan Mei + Harmony Trailblazer + Lingsha** (Super Break),
   **count 8**: Lingsha's "Break DMG" buff counts because Firefly deals Break
   DMG; the same buff (and the Trailblazer's Super Break) does not reach
   Feixiao.

## Limits (same honesty as ZZZ)

- No damage numbers; Prydwen and similar guides are still better at "which
  team hits hardest".
- Traces count as unlocked (HLITH doesn't save character level yet).
- The Enhanced kit isn't saved yet: its pieces show as locked.
- Characters not read yet: "not rated yet".
