# ZZZ Kit Check: the complete guide

Oct 10, 2026 · @Caelivan

## What a kit check is

A kit check reads every character's skill text from the game. For a squad of three in a given order, it works out which abilities switch on, which buffs reach the damage dealer, and which characters trigger each other. It is fixed rules, not AI: no guessing, no damage numbers, and the same squad always gets the same answer. Every claim it makes is backed by an exact quote from the game.

It has two jobs:

1. **Reading** (slow, once per character and patch): turn each character's kit into a cheat-sheet entry.
2. **Checking** (fast, any time): look the three squad members up in the cheat sheet and apply the rules.

Everything ZZZ in the app is built on the check: the line under each team, the synergy %, Line-ups, Who fits, the "If you pull…" % and How to play.

&#91;embedded content: kit check overview · reading once, checking any time\]

Reading happens once per character and patch. Everything on the right is worked out fresh from the check each time you open a team.

## The three ingredients

A check needs three things: what every kit says, who every character is, and what your account has.

| Ingredient | What it holds | Example |
| --- | --- | --- |
| Cheat sheet | Every character cut into abilities (Core Passive, Additional Ability, skills, Mindscapes 1–6, Agent Potential). Each piece carries its exact game text and the answers to the seven questions in Part A. | Dialyn's Overwhelmingly Positive: the whole squad gets +40% DMG |
| Profiles | Specialty, attribute, faction and assist type, for every character, including ones nobody has read yet | Dialyn: Stun, Physical, Krampus Compliance Authority |
| Your account | Mindscape and Potential level per character (not owned = M0), plus stats you typed in, such as CRIT Rate | Starlight Billy M1, Lycaon at Potential VI |

The kit text comes from the game's own data (the app uses Nanoka), never from guides or search snippets. Early mistakes came from snippets: Lycaon's "+30% DMG from other attributes" was missed, and Aria and Promeia were mixed up.

## Part A: reading one character into the cheat sheet

Reading means cutting a kit into abilities and answering the same seven questions for each one. It is the slow, careful part, done once per character and again when a patch changes the text.

1. **Get the real game text:** Core Passive, Additional Ability, every skill (Quick Assist, Chain Attack, EX Special, Ultimate and so on), all six Mindscapes, and the Agent Potential if there is one.
2. **Write the profile:** specialty, attribute, faction, assist type. Every character needs one, because other characters' conditions look at it. Billy's Starlight asks "is a teammate Stun, Defense or Support?"
3. **Cut the text into abilities:** one piece per thing that works on its own. Copy its sentence word for word. That sentence is the proof.
4. **Answer the seven questions for every piece** (table below).
5. **For damage dealers, note what their own damage uses and ignores.** Starlight Billy turns Max HP into Sheer Force, and his Sheer DMG ignores DEF. So Max HP and Sheer Force buffs help him, and DEF shred does nothing.
6. **Prove it.** The app's tests check that every quote appears word for word in the game text, that every line that sounds like it needs setup has an answer to question 6, and that every character has all parts read.

### The seven questions

| # | Question | What to write down | Examples |
| --- | --- | --- | --- |
| 1 | When is it on? | The squad condition, the squad position, or a count. A condition you cannot check from profiles is unknown and never counted as met. | "Another character is Attack or Rupture" (Dialyn) · "the character directly before her" (Dialyn) · "two Stun characters" (Hugo, ATK +900) |
| 2 | What does it give? | The stat and the kit's own number | +40% DMG · +30% CRIT DMG · Sheer Force · −25% Ice RES · Daze · Energy |
| 3 | Who gets it? | Only themselves, the whole squad, the enemy (a debuff, so everyone gains), or only the character before them | Pan Yinhu's Meridian Flow goes only to the character his Quick Assist brings in |
| 4 | Any limits? | Only some attributes, all but one attribute, only some specialties, or a stat only some damage dealers use | "Ice and Fire DMG" (Lighter) · "other attributes" (Lycaon) · "non-Armorer" (Roxy) · Sheer Force only matters to Rupture |
| 5 | Does it cause or react to an event? | Quick Assist, Chain Attack, Ultimate or Ether Veil, and whose: previous, next, whoever switches in, or not said. Not said means never counted. | Dialyn's EX triggers the Quick Assist of the character before her |
| 6 | What must you set up in the fight? | A gauge, a state, a Stunned enemy, a stat threshold or an action. If nothing, write down why. | "90 Positive Reviews" (Dialyn) · "HP above 25%" (Billy) · "Perfect Dodge" |
| 7 | Which level, and does it stack? | Base kit, Mindscape 1–6 or Potential. "Does not stack with similar effects" means only one counts. A stronger version replaces the weaker one. Anything unclear is marked unverified. | Dialyn's and Roxy's +2s Stun do not stack |

### Worked example: Dialyn's Additional Ability

> "When an EX Special Attack or Ultimate is activated, all squad members gain the Overwhelmingly Positive effect. While Overwhelmingly Positive is active, DMG dealt is increased by 40% for 15s."

1. **On when:** another squad member is Attack or Rupture.
2. **Gives:** +40% DMG.
3. **Who:** the whole squad.
4. **Limits:** none, every attribute.
5. **Event:** none.
6. **Setup:** use her EX Special or Ultimate; it lasts 15s.
7. **Level:** base kit. Her Mindscape 1 makes this same buff stronger (ignore 15% RES while it is active).

### Worked example: Pan Yinhu

His EX Special "triggers the Quick Assist of the previous character in the squad". The character who comes in that way gains Meridian Flow: Sheer Force equal to 18% of his initial ATK, for 25s.

- **Event:** a Quick Assist for the character directly before him.
- **Who:** only that character.
- **Limit:** Sheer Force only matters to Rupture characters.
- **Result:** it only helps when your Rupture damage dealer stands directly before Pan Yinhu.

## Part B: checking a team by hand

Checking is a fixed checklist. The app runs exactly these nine steps; you can run them on paper the same way.

1. **Pick the damage dealer:** your Attack character; otherwise Rupture, Armorer or Anomaly, in that order.
2. **Write the squad order** as A > B > C. The character before A is C, and the character after C is A.
3. **Give every ability of every member a status:**
   - **locked:** your Mindscape or Potential is too low
   - **on:** its condition is met by the other two
   - **off:** its condition is not met
   - **unknown:** it cannot be checked, so it never counts
4. **For every buff that is on, ask whether it reaches the damage dealer.** Check who gets it, the attribute and specialty limits, the squad position, and whether their damage uses that stat.
5. **Find the chains:** who causes an event, whose kit reacts to it, and whether the direction fits this order.
6. **Cross out duplicates** the kits say do not stack.
7. **For a Rupture, Armorer or Anomaly damage dealer,** check that each teammate brings something made for them. A teammate with nothing for them is a weak fit.
8. **Count:** +1 per buff that reaches the damage dealer, +1 per ability of theirs the team switches on, +1 per chain to them; −1 per ability that is off, per duplicate and per weak fit. Team support (Daze, Energy, longer Stun) only breaks ties.
9. **Swap the two teammates and redo the steps that depend on order.** Keep the better order.

### Worked example: Starlight Billy > Dialyn > Lucia (count 9)

| Kind | Who | What | Counts |
| --- | --- | --- | --- |
| Switched on | Billy | His own Starlight: on because Dialyn is Stun and Lucia is Support | +1 |
| Buff | Dialyn | +30% Stun DMG Multiplier · +40% DMG | +2 |
| Buff | Lucia | +5% Max HP · +20% DMG · Sheer Force · +30% CRIT DMG | +4 |
| Chain | Dialyn → Billy | Free Ultimate; Billy gains a Starlight stack | +1 |
| Chain | Dialyn → Billy | Her EX triggers Billy's Quick Assist, which becomes Drive Suppression (+90% CRIT DMG). Billy must stand directly before her. | +1 |
| Team support | Dialyn | Her own EX CRIT DMG, and extra damage from Billy's Sheer Force | tie-break only |
| Possible | Lucia → Billy | A Quick Assist, but her text does not say whose | not counted |
| Locked | all three | Billy M2, M4, M6 · Dialyn M1, M2 · Lucia M2, M4 | not counted |
| **Total** |  |  | **9** |

### Why squad order matters

The same three characters can score very differently in the other order.

- In **Billy > Dialyn > Lucia**, Billy stands before Dialyn. Her EX gives *him* the Quick Assist, and her extra damage uses *his* Sheer Force.
- In **Billy > Lucia > Dialyn**, Lucia stands before Dialyn. Both of those go to Lucia or switch off, because Lucia is Support.

## How the app scores a team

The app runs Part B automatically and turns it into one number: the count. A higher count means more of the three kits connect; it does not mean more damage.

```latex
\text{count} = \text{buffs reaching the damage dealer} + \text{their abilities switched on} + \text{chains to them} - \text{abilities off} - \text{duplicates} - \text{weak fits}
```

### What each ability can be

| Status | Meaning | Counts |
| --- | --- | --- |
| On | Its condition is met in this squad | yes, if it reaches the damage dealer |
| Off | Its condition is not met; the line says what is missing | −1 |
| Locked | Your Mindscape or Potential is too low | no (shown as "locked, you have M0") |
| Unknown | The text cannot be checked from profiles | no |
| Replaced | A stronger version of the same ability is on | no (the stronger one counts) |

### Where a buff can land

| Lands on | Example | Counts |
| --- | --- | --- |
| The damage dealer | Lucia's +20% DMG on Billy | +1 |
| Team support | Daze, Energy, longer Stun, a free Ultimate for whoever switches in | tie-break only |
| Wrong attribute | Lighter's Ice and Fire DMG on a Physical damage dealer | no |
| Wrong specialty | Roxy's non-Armorer buff on an Armorer | no |
| Wrong position | Pan Yinhu's Meridian Flow when the damage dealer is not directly before him | no |
| Not used | DEF shred on Starlight Billy (his Sheer DMG ignores DEF) | no |

### Ties and order

- Equal counts are split by team support first, then by the number of chains.
- A squad of three has only two different orders. The app checks both and keeps the better one.
- Example: Billy > Pan Yinhu > Lucia counts 10, Billy > Dialyn > Lucia counts 9. Why that ranking is partly wrong is under Limits.

## Synergy % on presets

Synergy % compares your squad's count with the best count the check can find for the same damage dealer from your own characters.

```latex
\text{synergy} = \frac{\text{your squad's count}}{\text{best count for that damage dealer from your characters}} \times 100
```

**Example:** Billy > Dialyn > Lucia counts 9. The best the check finds for Billy from your characters is Billy > Pan Yinhu > Lucia at 10. So 9 ÷ 10 = **90%, Excellent**.

| Synergy | Label |
| --- | --- |
| 85% and up | Excellent |
| 65–84% | Good |
| 45–64% | Partly |
| below 45% | Weak |
| only two members | Incomplete |

- 100% means the check knows no better squad for that damage dealer from your characters.
- If you own fewer than three characters with a kit, the comparison uses every character in the game instead.
- The box also shows the best squad from every character when that one is better, and names anything that is off or a weak fit.
- If the squad is one of your own line-ups, it says "your own results come first".

## Line-ups and Who fits

Both tools use the same check; they only differ in which squads they try.

### Line-ups: your best teams with no character twice

1. For each of your damage dealers, the app checks their best squads of three, in both orders.
2. With a big roster, it first ranks every partner in pairs with the damage dealer, then combines only the best partners into trios.
3. Only teams with a count above 0 stay in.
4. It then searches for the set of teams that never share a character and has the highest total count. More teams break a tie.

### Who fits: building a team from one or two characters

1. You put in one or two characters.
2. Every other character in the game is checked in that squad, in its best order.
3. A character is suggested only if the kits really connect: they switch something on, a buff reaches the damage dealer, a chain runs between them, or they support the team.
4. Weak fits for a Rupture, Armorer or Anomaly damage dealer are never suggested.
5. Characters that connect with everyone in the team come first; after that, the higher count wins.

Each suggestion says how it connects, for example "turns on Billy's Additional Ability" or "Quick Assist for Billy".

## "If you pull…" %: what a missing character adds to your account

A character you do not own is tested at M0 in two ways, and the % is the better of the two. 0% means "No gain".

**Way 1, as a damage dealer** (only if they are one). How close their best team from your characters comes to their best team in the whole game. 100% means you already own the partners their kit wants.

```latex
\text{as a damage dealer} = \frac{\text{their best count with your characters}}{\text{their best count with every character}} \times 100
```

**Way 2, as a teammate.** For each of your damage dealers, the app compares their best team now with their best team once the new character is available. If it goes up, that is a lift. The % is the new team against that damage dealer's best possible team; the best lift wins.

```latex
\text{as a teammate} = \max_{\text{your damage dealers}} \frac{\text{their best count with the new character}}{\text{their best possible count}} \times 100
```

### Examples from your account

| Character | Way | The numbers | Result |
| --- | --- | --- | --- |
| Banyue | damage dealer | Banyue > Pan Yinhu > Lucia counts 9 from your characters, and nothing in the game does better for her | 100% |
| Sunna | teammate | Ye Shunguang goes from 6 to 9 (Ye + Sunna + Zhao), and 9 is Ye's best possible. She improves 13 of your teams. | 100% |
| Norma | teammate | Harumasa goes from 5 to 7 (Harumasa + Norma + Lucy); his best possible is 8 | 88% |
| Cissia | both | As a damage dealer: 5 with your Dialyn and Rina against 7 with Seed and Sunna = 71%. As a teammate she lifts Anton and Harumasa from 5 to 6 out of 8 = 75%. The better one counts. | 75% |

The card also says in words what the character would give each team, for example "gives Ye Shunguang ATK, DMG bonus, Stun DMG". The app runs this in the background because it checks thousands of squads.

## Limits and known issues

The check is good at finding what works and what you missed. Prydwen is still the better source for which team hits hardest.

| Limit | What it means | Status |
| --- | --- | --- |
| No damage numbers | It counts abilities, so "+5% Max HP" counts the same as "+40% DMG" | known, on the roadmap |
| Upgrades counted twice | A Mindscape that only strengthens an ability counts as a new one. Pan Yinhu's M1 and M6 give him 2 extra points, which is why Billy + Pan + Lucia (10) beats Billy + Dialyn + Lucia (9). | found 8 Oct, fix written down |
| Free Ultimates undervalued | Dialyn's free Ultimate for the damage dealer counts only as one Starlight stack, not as an extra Ultimate | found 8 Oct, fix written down |
| Same stat twice | Two supports giving the same stat (Lucia and Pan: Sheer Force) both count fully; they should show as doubling up | found 8 Oct |
| No role coverage | It does not ask whether a team has a Stun character, or about energy and rotation length | known |
| Unknown stays unknown | When the text does not say whose Quick Assist it is, the chain is shown as possible and never counted | by design |
| Beta text | Characters not released yet (Severian, Phoenix) can change before release | re-read on release |

With the two fixes, Billy > Dialyn > Lucia ranks first (10 against 8). Your own results always win: your line-ups override the check.

## Using the method for other games and the rebuild

The method works for any game; only the vocabulary changes. Part A stays slow and careful, and Part B stays a checklist.

| Piece | ZZZ | HSR | Genshin |
| --- | --- | --- | --- |
| Who someone is | Specialty, attribute, faction | Path, element | Element, weapon, region or group (Nod-Krai, Hexerei) |
| A condition | "another Stun character in the squad" | "when an ally uses a follow-up attack", "against a Weakness Broken enemy" | Aino's Burst needs 2 or more Nod-Krai characters; Varka wants an Anemo teammate and a Hexerei teammate |
| Events | Quick Assist, Chain Attack, Ultimate, Ether Veil | Follow-up attack, Ultimate, Weakness Break | Elemental Burst, reactions such as Swirl or Lunar-Charged |
| Who gets it | Self, squad, enemy, the character before | Self, one ally, the team, the enemy | Self, the active character, the party, the enemy |

For the rebuild, each game's kit check can be its own plug-in with the same three ingredients: profiles, a quote-checked cheat sheet, and the checklist. Three improvements belong in from the start:

- an upgrade counts as part of the ability it upgrades
- abilities are weighted by kind, so "+40% DMG" weighs more than "+5% Max HP"
- the check asks whether a team covers its roles, such as a Stun character in ZZZ

## Quick reference

**Reading a character (once per patch).** For every ability:

1. When is it on?
2. What does it give?
3. Who gets it?
4. Any limits?
5. Does it cause or react to an event, and whose?
6. What must you set up in the fight?
7. Which level, and does it stack?

Copy the sentence word for word, and note what the damage dealer's own damage uses and ignores.

**Checking a team (any time).**

1. Pick the damage dealer.
2. Write the order A > B > C.
3. Mark every ability: locked, on, off or unknown.
4. Check whether each buff reaches the damage dealer.
5. Find the chains.
6. Cross out what does not stack.
7. Spot weak fits.
8. Count.
9. Swap the two teammates and keep the better order.

**The numbers.**

| Number | Formula |
| --- | --- |
| Count | buffs reaching the damage dealer + their abilities switched on + chains to them − off − duplicates − weak fits |
| Synergy % | your squad's count ÷ the best count for that damage dealer from your characters |
| If you pull %, as a damage dealer | their best count with your characters ÷ their best count with every character |
| If you pull %, as a teammate | the best of: a damage dealer's new count ÷ their best possible count |
