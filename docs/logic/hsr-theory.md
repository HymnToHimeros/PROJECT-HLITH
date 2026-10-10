# HSR Kit Check: a theory (proposal, waiting for the owner's OK)

Written by LOGIC-CORE in the spirit of the owner's ZZZ method
(`zzz-method.md`), fitted to Honkai: Star Rail. **No HSR scoring code is
written until the owner says OK.** Kit text for group A is already in the app
(`src/games/hsr/data/kits.json`, Kit check shows it).

## What it is

Same as ZZZ: fixed rules, no guessing, no damage numbers, every claim backed
by an exact quote from the game. Two jobs:

1. **Reading** (slow, once per character and patch): cut each kit into
   abilities and answer the questions below.
2. **Checking** (fast, any time): look the four team members up and apply the
   checklist.

The result is a **count**: how many of the four kits connect with the damage
dealer. A higher count means more connects, not more damage.

## What changes from ZZZ, and why

| | ZZZ | HSR |
| --- | --- | --- |
| Team | 3, in an order (A > B > C) | 4, **no order** (almost nothing in HSR depends on position) |
| Who someone is | specialty, attribute, faction | **path, element**, and a *damage profile* (what kinds of damage they deal) |
| What limits a buff | attribute, specialty, position | element, path, and **damage kind** ("Follow-Up ATK DMG", "Break DMG", "Ultimate DMG", "DoT") |
| Events | Quick Assist, Chain Attack, Ultimate, Ether Veil | **follow-up attack, extra attack by a summon or memosprite, debuff applied, Weakness Break, Ultimate, action advance, shield / heal** |
| Upgrades | Mindscape 1–6, Agent Potential | **Eidolon 1–6**, Traces, the **Enhanced** kit |

The damage kind is the big one. In HSR most strong buffs only work for one
kind of damage: Topaz's "Proof of Debt" only raises **Follow-Up ATK DMG**,
Lingsha's "Befog" only raises **Break DMG**. So the check has to know what
kinds of damage the damage dealer actually deals.

## Part A: reading one character

1. **Get the real game text**: Basic ATK, Skill, Ultimate, Talent, Technique,
   any extra skills (Firefly's Enhanced Basic ATK and Skill, Feixiao's Ultimate
   hits), memosprite skills, the three major Traces, Eidolons 1–6, and the
   Enhanced kit when the game has one. *(Done for group A.)*
2. **Profile**: path and element (from the character list).
3. **Cut the text into abilities**: one piece per thing that works on its own.
   Copy its sentence word for word. That sentence is the proof.
4. **Answer the seven questions for every piece** (below).
5. **For damage dealers, write the damage profile**: which kinds of damage
   they deal (Basic ATK, Skill, Ultimate, Follow-Up ATK, DoT, Break, Super
   Break, Additional DMG, memosprite) and which stats their damage uses beyond
   the usual (Break Effect, DEF, HP, Effect Hit Rate). Each one with a quote.
6. **Prove it**: the same tests as ZZZ (every quote word for word, every piece
   read, setup answered).

### The seven questions, for HSR

| # | Question | What to write down | Examples |
| --- | --- | --- | --- |
| 1 | When is it on? | A team condition: a path or element count, or "a teammate who …". Things you can't check from profiles are unknown and never count. | Acheron: "When there are 1 or 2 Nihility characters other than Acheron in the team" |
| 2 | What does it give? | The stat and the kit's own number | +50% DMG · +20.0% CRIT DMG · DEF −40% · +25.0% RES PEN · SPD +10.0% · Super Break |
| 3 | Who gets it? | Self, one chosen ally, all allies, teammates (not self), the enemy, a summon or memosprite | Robin's Ultimate: "all teammates (i.e., excluding this unit)" |
| 4 | Any limits? | Element, path, **damage kind** | Topaz: "Follow-Up ATK DMG" · Lingsha: "Break DMG" · Jiaoqiu's Zone: "Ultimate DMG" |
| 5 | Does it cause or react to an event? | Follow-up attack, extra attack (summon, memosprite), debuff applied, Weakness Break, Ultimate, action advance. Whose: any ally, teammates, one ally, or not said (never counted). | Feixiao: "After Feixiao's teammates attack an Enemy target, Feixiao immediately launches Follow-Up ATK" |
| 6 | What must you set up? | Weakness Broken enemy, debuffed enemy, shield, HP or stat threshold, a resource | Firefly: "Break Effect that is equal to or greater than 200%/360%" |
| 7 | Which level, does it stack? | Base, Trace, Eidolon 1–6, Enhanced. HSR rule: the same buff from two sources with the same name does not stack. | Two Ruan Meis can't be in one team, but "Weakness Break Efficiency" from two kits does stack |

## Part B: checking a team

1. **Pick the damage dealer.** Destruction, Hunt or Erudition first; otherwise
   anyone whose damage profile says they carry (Acheron, a DoT or
   memosprite carry). Two candidates (Feixiao and Topaz): try each, keep the
   better.
2. **No order** for four members, except the few kits that name a position
   ("the first character in the team lineup", Silver Wolf's Enhanced Skill).
3. **Status of every ability**: locked (Eidolon or Enhanced too low), on, off,
   unknown, replaced (the Enhanced version is on).
4. **Does each buff reach the damage dealer?** Who gets it, element and path
   limits, and **damage kind**: a buff for "Follow-Up ATK DMG" only counts if
   the damage dealer deals Follow-Up ATKs; a "Break DMG" buff only if they deal
   Break DMG. Speed and action advance count as buffs (more turns is the main
   currency in HSR).
5. **Find the chains**: a teammate's kit makes an event happen (a follow-up
   attack, an extra attack by a summon, a debuff, a Weakness Break, an extra
   action) and the damage dealer's kit reacts to it. A teammate's plain Basic
   ATK or Skill is **not** a chain, or every teammate would always chain:
   only events the kit makes on purpose count.
6. **Cross out duplicates** (same-name buffs, "does not stack").
7. **Weak fit**: a teammate who brings nothing counted for the damage dealer.
8. **Count**: +1 per buff that reaches the damage dealer, +1 per ability of
   theirs the team switches on, +1 per chain to them; −1 per ability off, per
   duplicate, per weak fit. Team support (energy, Skill Points, healing,
   shields, cleanse, enemy delay) only breaks ties.
9. **Sustain check** (new, see "your calls"): does the team have a
   Preservation or Abundance character, or a kit that heals or shields the
   team? If not, the score shows "No sustain" next to the number.

## Worked example 1: Feixiao + Topaz + Robin + Aventurine (follow-up), count 9

At Eidolon 0, nobody Enhanced. Damage dealer: Feixiao (Hunt). Her damage
profile: Follow-Up ATK ("After Feixiao's teammates attack an Enemy target,
Feixiao immediately launches Follow-Up ATK"), and her Ultimate counts as one
too ("When using Ultimate to deal DMG to an enemy target, it is considered as a
Follow-Up ATK.").

| Kind | Who | Quote | Counts |
| --- | --- | --- | --- |
| Buff | Topaz | "increasing the Follow-Up ATK DMG it receives by 50%" (Feixiao deals Follow-Up ATKs) | +1 |
| Buff | Robin | "Increase DMG dealt by all allies by 50%" | +1 |
| Buff | Robin | "increases all allies' ATK by 22.8% of Robin's ATK plus 200" | +1 |
| Buff | Robin | "Increase all allies' CRIT DMG by 20.0%." | +1 |
| Buff | Robin | "the CRIT DMG dealt when all allies launch Follow-Up ATK increases by 25%" | +1 |
| Buff (turns) | Robin | "makes all teammates (i.e., excluding this unit) immediately take action" | +1 |
| Buff | Aventurine | "When an ally hits an "Unnerved" enemy target, the CRIT DMG dealt increases by 15.0%." | +1 |
| Chain | Topaz → Feixiao | Numby "launches Follow-Up ATKs" → Feixiao's Talent reacts to teammates' attacks | +1 |
| Chain | Aventurine → Feixiao | "launch a 7-hit Follow-Up ATK" → Feixiao's Talent | +1 |
| Team support | Robin, Aventurine | Robin's Additional DMG, Aventurine's shields | tie-break |
| Locked | | Feixiao E2 (more "Flying Aureus" from allies' Follow-Up ATKs), Topaz E1, Robin E1, E2, Aventurine E1, E2 | not counted |
| **Total** | | | **9** |

Sustain: Aventurine (Preservation) ✓.

## Worked example 2: Acheron + Jiaoqiu + Pela + Aventurine (debuff), count 9

Damage dealer: Acheron (Nihility, carries: her Ultimate is her damage). Her
Trace switches on with Nihility teammates, and her Talent reacts to debuffs.

| Kind | Who | Quote | Counts |
| --- | --- | --- | --- |
| Switched on | Acheron | "When there are 1 or 2 Nihility characters other than Acheron in the team" — one Nihility teammate (115%) | +1 |
| Switched on | Acheron | the same Trace, two Nihility teammates (160%) | +1 |
| Buff | Jiaoqiu | "At 1 stack, increases DMG received by the enemy by 15.0%." | +1 |
| Buff | Jiaoqiu | "enemy targets receive 15.0% increased Ultimate DMG" (Acheron deals Ultimate DMG) | +1 |
| Buff | Pela | "When Exposed, enemies' DEF is reduced by 40% for 2 turn(s)." | +1 |
| Buff | Aventurine | "the CRIT DMG dealt increases by 15.0%" (Unnerved) | +1 |
| Chain | Jiaoqiu → Acheron | inflicts "Ashen Roast" → "When any unit inflicts debuffs on an enemy target while using their ability, Acheron gains 1 point of Slashed Dream" | +1 |
| Chain | Pela → Acheron | inflicts Exposed → the same Talent | +1 |
| Chain | Aventurine → Acheron | inflicts "Unnerved" → the same Talent | +1 |
| Not counted | Pela | "all allies' Effect Hit Rate increases by 10%" — Acheron's damage doesn't use Effect Hit Rate | 0 |
| **Total** | | | **9** |

Swap Pela for a non-Nihility character and the second "The Abyss" tier turns
**off** (−1) and her chain goes away.

## Worked example 3: Firefly + Ruan Mei + Harmony Trailblazer + Lingsha (Super Break), count 8

Damage dealer: Firefly (Destruction). Damage profile: Break and Super Break
("convert the Toughness Reduction of this attack into 1 instance of 35%/50%
Super Break DMG"), uses Break Effect.

| Kind | Who | Quote | Counts |
| --- | --- | --- | --- |
| Buff | Trailblazer | "Allies with the Backup Dancer effect have their Break Effect increased by 30%." | +1 |
| Buff | Trailblazer | "the Toughness Reduction of the attack will be converted into 1 instance of Super Break DMG" | +1 |
| Buff | Ruan Mei | "all allies' DMG increases by 32.0% and Weakness Break Efficiency increases by 50%" (two stats) | +2 |
| Buff | Ruan Mei | "all allies' All-Type RES PEN increases by 25.0%" | +1 |
| Buff (turns) | Ruan Mei | "Increases SPD by 10.0% for all teammates" | +1 |
| Buff | Ruan Mei | "Increases Break Effect by 20% for all allies." | +1 |
| Buff | Lingsha | "targets receive 25% increased Break DMG" (Firefly deals Break DMG) | +1 |
| Team support | Ruan Mei, Trailblazer, Lingsha | Thanatoplum Rebloom (longer Break), "delays the action of the enemy target by 30%", Lingsha's healing | tie-break |
| **Total** | | | **8** |

The same team with a Follow-Up damage dealer instead would lose Lingsha's
and the Trailblazer's buffs (wrong damage kind): that is the rule doing its job.

## Synergy %, Line-ups, Who fits, If you pull

Exactly as in ZZZ, with teams of four:

- **Synergy %** = this team's count ÷ the best count for the same damage
  dealer from your characters × 100. Labels: 85%+ Excellent, 65–84 Good, 45–64
  Partly, under 45 Weak, fewer than four members Incomplete.
- **Line-ups**: your best teams, no character twice (with a big roster, the 10
  best partners in pairs first, then teams of four from them).
- **Who fits**: everyone whose kit really connects, saying how.
- **If you pull…**: as a damage dealer and as a teammate, the better of the two.

## Your calls (please say OK or change them)

1. **Damage kind** is part of question 4 (above). Without it HSR scores would
   be wrong in the most common teams.
2. **Speed and action advance count as buffs**, not only tie-breaks.
3. **Plain Basic ATK / Skill is never a chain**; only events the kit makes on
   purpose (follow-ups, summon attacks, debuffs, breaks, extra actions).
4. **Sustain check** shown next to the score (not in the count). HSR teams
   without sustain are a real problem in a way ZZZ teams are not.
5. **Traces count as unlocked** (the app doesn't track character level yet).
6. **Upgrades**: in ZZZ an upgrading Mindscape counts as its own +1 (as your
   method is written). For HSR the same, unless you want the fix from your
   method's "rebuild" list (an upgrade counts as part of what it upgrades).
7. **No weights yet**, like ZZZ: "+5% Max HP" counts like "+50% DMG". Weights
   could come later for both games at once.

## Limits (same honesty as ZZZ)

- No damage numbers; Prydwen and similar guides are still better at "which
  team hits hardest".
- Text that doesn't say whose event it is stays "possible", never counted.
- Characters not read yet: "not rated yet".
