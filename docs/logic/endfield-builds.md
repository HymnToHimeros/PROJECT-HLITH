# Endfield builds: HLITH's own picks from the kit

Code: `src/games/endfield/build/` (weights in `weights.ts`, set rules in `sets.ts`, picks in `pick.ts`,
merge in `index.ts`). Data: `npm run data:endfield-gear` and `npm run data:endfield-builds`.

## Which source a field comes from
Per field, the first that has it: **the game's recommendation** (weapons) > **community guides where two or
more agree** (gear set, skill order; `community-builds.json`) > **HLITH's pick from the kit**. When a guide
names something different from what is shown, the card shows it as a note; it is never hidden.

## How HLITH picks
1. **Gear set.** Each endgame set's 3-piece effect is written once as rules (`sets.ts`), each quoting the effect
   word for word. A rule counts only if the kit does what it needs, proven by a Kit check line (e.g. Hot Work's
   Heat DMG +50% needs the kit to apply Combustion). Points depend on who wears it (damage dealer or support)
   and on how much of the kit's damage the buff reaches. The set with the most points wins; its pieces' stats
   only break ties.
2. **Off-piece.** Three set pieces switch the effect on. The fourth slot takes the best piece for this kit from
   any set, named only when it beats a fourth piece of the set.
3. **Stats to look for.** The stats endgame pieces offer, ranked: main attribute, secondary attribute, the
   damage stat of their element, the skill-damage stat of the skills carrying their damage, Arts Intensity if
   the kit applies Arts Inflictions, then the rest; supports' damage stats count less, healing and defence
   stats only for kits that heal or protect.
4. **Skill order.** A damage dealer's skills by their share of the kit's estimated damage a minute: each
   skill's level-12 multipliers per use × uses a minute *estimated* from its SP cost, cooldown or Ultimate
   Energy cost (every reason names the estimate). A support's skills first by the kit lines the Kit check counts
   for the team. Skills within the tie ratio share a tier.
5. **Weapon order.** The game's list stays the list; HLITH orders it by the weapon's attribute boost against the
   main / secondary attribute and its skill text against the kit (element, skills, statuses). Ties keep the
   game's order.

No damage calculation: points compare picks for one kit, nothing more.

## Decisions (judgement calls; the owner can change any of them in `weights.ts`)
- **B1** Endgame = sets made at level 70 (`ENDGAME_LEVEL`); only those are compared, and the card's "Why" says
  so. Lower sets (Aburrey's Legacy 50, Catastrophe 50, AIC Fieldwork 60, Mordvolt, MSGR, Miner…) are stepping
  stones. Level-70 sets with no set effect (Redeemer, Rift Trekker) have no rules; their pieces still count as
  off-pieces.
- **B2** A timed buff counts at 70% of its size (`TIMED_UPTIME`).
- **B3** Who values what: a damage dealer values team buffs at 1× and buffs that reach only the others at
  0.3×; a support values its own damage at 0.3× and team buffs at 1.5×.
- **B4** Defensive effects (HP, DMG Reduction, Treatment) count only for Defenders or kits that heal or protect,
  at 0.6×; +1000 HP = 10 points.
- **B5** Exchange rates: 1% ATK = 1 point, 1% Critical Rate = 0.75, 1 Arts Intensity = 0.3 (only for kits
  that apply Arts Inflictions), 1% combo cooldown cut = 1 × the combo's share, 1% Stagger = 0.3.
- **B6** Stat weights (`STAT_WEIGHT`): main attribute 10, secondary 6, element DMG 8, skill DMG 8 × share × 2,
  ATK 6, Arts Intensity 5, Critical Rate 5, …; supports' damage stats × 0.4; at most 6 listed, none under 25%
  of the top; piece stats add 10% to a set's points (tie-break).
- **B7** The estimate's fight: 8 basic chains a minute, 400 SP a minute (a 100-SP battle skill 4 times), at
  most 4 combos a minute, 200 Ultimate Energy a minute, 3 seconds a basic chain.
- **B8** Skills within 80% of each other share a tier; a support's skill gets 25 points per team kit line.
- **B9** Weapon order: main-attribute boost 3 points, secondary 1, each kit match in its skill text 2.
- **B10** Situational hits (Finisher, Dive) are left out of a skill's damage per use; battle-skill lines
  "During Ultimate" belong to the ultimate's window and are left out of the battle skill.
- **B11** Set effects with stacks count at full stacks (Æthertech 4 × 8%, MI Security 5 × 5%, Qingbo 2 × 20%,
  Type 50 Yinglung 3 × 20%, Xiranflow 3 × 15%, Deep Rampart 3 × 16, Grizzled Edge 4 Vulnerable stacks).
- **B12** A kit "applies Vulnerability" for Æthertech when it applies Vulnerable or any Physical Status (each
  adds Vulnerable stacks); "a Nature or Cryo Burst" for Deep Rampart when it applies Nature or Cryo Infliction.
