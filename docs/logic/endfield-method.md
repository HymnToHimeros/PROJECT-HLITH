# Arknights: Endfield Kit Check: the method (E6b)

LOGIC-CORE's method for Endfield, built the same way as the ZZZ Kit Check (docs/logic/zzz-method.md) so the
two games mirror each other. The owner left Endfield to LOGIC-CORE ("this is ur job"), so every choice the
game's text doesn't settle is written down below as a numbered decision, for the owner to correct.

Sources: the operators' kit text (data/kits.json, from endfield.wiki.gg, cited per kit) and the wiki's
combat pages: Combat Mechanic, Damage calculation, Arts Infliction, Arts Reaction, Physical Status,
Vulnerable, Susceptibility, Amp, Link, Stagger (read 2026-10-15).

## What a kit check is

The same as ZZZ: fixed rules, no guessing, no damage numbers beyond what the kits state, and every point
backed by a word-for-word quote. Reading turns each operator's kit into a cheat-sheet entry once per patch;
checking applies the rules to a team any time.

## How Endfield fights (what the check has to know)

- A team has 4 operators. You control one; the others attack on their own, and you cast their Battle
  Skills (they cost SP), Combo Skills (free, but need their trigger and have a cooldown) and Ultimates.
- **Combo triggers are the chains.** A Combo Skill appears only when its trigger happens: "when an enemy
  becomes Vulnerable", "when Nature Infliction is applied", "when the controlled operator performs a
  Final Strike". Who makes that happen is the team's job.
- **Physical side:** Physical Statuses (Lift, Knock Down, Crush, Breach). On an enemy that isn't
  Vulnerable a status only adds a Vulnerable stack (up to 4); on a Vulnerable enemy it takes effect.
  Crush and Breach consume the stacks.
- **Arts side:** Arts Inflictions (Heat, Cryo, Electric, Nature). The same element again is an Arts Burst;
  a different one is an Arts Reaction: Combustion (Heat), Solidification (Cryo), Electrification (Electric),
  Corrosion (Nature). Some skills "forcibly apply" a reaction without the inflictions.
- **Damage** (wiki, Damage calculation) multiplies these groups, which become the zones of the kit value:
  ATK, DMG Bonus, critical hits, Amp, Stagger, Finisher, Link, Weakness, Susceptibility, Increased DMG
  Taken, DMG Reduction, Protection, DEF, Resistance.

## Part A: reading one operator

1. Use the kit text in data/kits.json: the four combat skills, the talents and Potentials 1–5.
2. The **profile** comes from the game data: element (characters.json), class (characters.json) and
   weapon type (the wiki infobox, when a condition needs it).
3. Cut the text into pieces; copy each sentence word for word. That sentence is the proof.
4. Answer the seven questions for each piece (below).
5. For a damage dealer, note what their damage is (Physical or an Arts element), which skills deal it, and
   what it uses or ignores.
6. Tests check every quote word for word against the kit text, that every piece is read (entries or a
   "nothing for the team" reason), and that setups that need an answer have one.

### The seven questions (Endfield)

| # | Question | What to write down | Examples |
| --- | --- | --- | --- |
| 1 | When is it on? | A team condition (another member of a class or element, Physical or Arts), a count, a named operator, or unknown. | "with another Guard"; "2 or more Heat operators" |
| 2 | What does it give? | The stat and the kit's own number. | Arts Susceptibility 20%; ATK +30%; Link; 10 Ultimate Energy |
| 3 | Who gets it? | Themselves, the team, the controlled operator, or the enemy (a debuff everyone gains from). | Ardelia's Susceptibility goes on the enemy |
| 4 | Any limits? | A damage type (Physical, Arts, one element) or a skill type (Battle Skill DMG, Ultimate DMG). | "Physical DMG Taken +10%" only helps Physical damage |
| 5 | Does it set up or react to an event? | Sets up: Vulnerable, a Physical Status, an Arts Infliction, a reaction, a Final Strike, Stagger. Reacts: a Combo trigger or an effect that needs the event. | Chen's Combo: "When an enemy becomes Vulnerable" |
| 6 | What must you set up in the fight? | A state, a stack count, an action, or why nothing is needed. | "on an enemy with Corrosion" |
| 7 | Which level, and does it stack? | Base kit or Potential 1–5; "does not stack" or "only the highest applies" counts once; unclear text is marked unverified. | Protection: only the strongest applies |

## Part B: checking a team

1. **Damage dealer:** every member whose sheet has damage notes is tried as the damage dealer; the best
   reading is kept (decision 1).
2. **Status of every piece:** locked (Potential too low), on, off (condition not met) or unknown.
3. **Does each buff that is on reach the damage dealer?** Who gets it, its damage-type and skill limits, and
   whether their damage uses that stat.
4. **Chains:** a teammate's piece sets up an event (Vulnerable, an infliction, a reaction…) and a piece of
   the damage dealer's that is on reacts to it (their Combo trigger, or an effect that needs it).
5. **Duplicates** the kits say don't stack count once.
6. **Weak fits:** a teammate who brings the damage dealer nothing (no buff, chain or switched-on ability)
   is a weak fit (decision 6).
7. **Count:** +1 per buff that reaches the damage dealer, +1 per ability of theirs the team switches on,
   +1 per chain to them; −1 per ability that is off, per duplicate and per weak fit. Team support (SP,
   Ultimate Energy, Stagger, healing, shields, Protection) only breaks ties.
8. **Kit value**, as in HSR and ZZZ (T30): every counted buff has a size from its kit text and a zone from
   the damage formula; sizes add inside a zone, zones multiply. A buff without a stated percentage counts as
   the game's typical buff.

There is no squad order in Endfield, so no step tries orders (decision 2).

## Decisions (Endfield)

1. **Damage dealers are the operators whose sheets have damage notes.** Endfield has no "Attack"
   specialty; Striker, Caster and Guard operators can all be the main damage, and some Supporters deal a lot
   too. The sheet says who is read as a damage dealer, with the quotes that show it.
2. **No order.** Nothing in the kits depends on team order. "The controlled operator" is read as the damage
   dealer: you control your main damage. A buff or trigger "for the controlled operator" reaches them, and a
   Combo trigger "when the controlled operator performs a Final Strike" is met by them.
3. **Zones** come from the wiki's damage formula: ATK, DMG Bonus (all "… DMG Bonus" lines add up), CRIT
   Rate, CRIT DMG, Amp, Link, Susceptibility, Increased DMG Taken, Resistance, and Arts Intensity (only for
   damage dealers whose damage is reactions or statuses).
4. **Physical and Arts.** "Arts" covers Heat, Cryo, Electric and Nature. Arts Susceptibility or Arts Amp
   reaches any Arts damage dealer; Heat Susceptibility only a Heat one.
5. **Inflictions and reactions as setups.** Applying an infliction of an element sets up "an Arts
   Infliction" and "<element> Infliction"; two different elements set up the reaction of the second one
   (wiki: Arts Reaction). A forced reaction sets up that reaction directly.
6. **Weak fit for every damage dealer.** In a team of 4, each teammate should bring the damage dealer
   something. A teammate who brings only team support (SP, Energy, healing) is not a weak fit; one who
   brings nothing at all is.
7. **Potentials** unlock at the Potential saved for the operator (the game's dupes); not owned = 0.
8. **Team Position 01 is the damage dealer.** Some kits name the operator in Team Position 01 (Si:
   "Heat Infliction if a Heat element operator is in Team Position 01"). As with decision 2, you put your
   main damage first, so Position 01 is read as the damage dealer. Such either/or text is no loss when
   it doesn't apply (the other half applies instead).
9. **Build-dependent modes are shown, never counted.** Arcane's kit switches between Array Arcana: INT
   and WILL by her Intellect against her Will, which HLITH doesn't know. What both modes do counts; what
   only one mode does is shown as "depends on her build" and adds nothing.
10. **Weakness** ("apply Weakness") raises the damage the enemy takes from any damage type, so it counts
   with Increased DMG Taken and reaches every damage dealer (Susceptibility stays per element).
