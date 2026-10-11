# Build score

Written by LOGIC-CORE. Code: `src/core/rules/buildScore.ts` (game-free; each game passes its
facts), tests in `tests/buildScore.test.ts`. Same rules for HSR and ZZZ.

A saved build (FRAME's build store: entered by hand, from a scan or from
HoYoLAB) is checked against **the game's own recommended build** for that
character (`builds.json`, the recommendation the game itself shows). Each part
is a plain check that says what it compared and what it found. A part with
nothing entered is **"No data yet"** and is left out of the score, never
guessed.

| Part | Check | Value |
| --- | --- | --- |
| Level | level ÷ level cap (HSR 80, ZZZ 60) | 0–100 |
| Weapon | one of the game's recommended weapons | 100 or 0 |
| Weapon level | weapon level ÷ cap | 0–100 (only when entered) |
| 4-piece set / 2-piece set | one of the recommended sets on enough pieces. HSR: cavern relic sets count on Head, Hands, Body, Feet; planar sets on Planar Sphere and Link Rope. ZZZ: any disc. | 100 or 0 |
| Main stat, per slot the game names (HSR Body, Feet, Planar Sphere, Link Rope; ZZZ Disc 4–6) | one of the recommended main stats | 100 or 0 |
| Sub stats | share of sub stats on all entered pieces that are recommended; weighed by rolls when the rolls are known | 0–100 |

**Score** = the average of the parts that have data, rounded, once at least 3 parts have data (fewer: "No data yet", so the level alone never reads as a perfect build; the card says to add sets, main stats or sub stats. T54: only when the game has no recommendation at all does it say "no recommended build"). **Grade**: S 90+,
A 75+, B 60+, C 40+, else D. The screen shows every part with its bar and its
reason, and says how many parts had no data yet.

Not scored yet (shown, not counted): skill levels, refinement / phase, set
choice ranking (any recommended option counts the same), and how high the sub
stat values rolled. No damage maths: the score says how closely a build follows
the game's recommendation, not how much damage it does.

## Who has a recommendation (owner's job T54, both games)

Every released character in both games has the game's own recommended build (sets, main stats, sub stats; the
weapon where the game names one: ZZZ A-rank agents have none, so that part isn't counted). A test lists anyone
released without one (`tests/recommendedBuilds.test.ts`; empty today). Characters not out yet (ZZZ Severian and
Phoenix; HSR's leaked Aeon ★ Aha) get the recommendation from nanoka.cc's beta files, marked `beta` with the build it
came from: "the game's own recommendation in beta build X (nanoka.cc), beta, may change". The score's basis names
that source. They are re-imported with `npm run data:builds` (generated, nothing hand-read to go stale).

## Assumed builds (owner's job T34, both games)

The owner, word for word: "if a build is not aviable for a charchter i should have
the option to turn n assume said charchter as their signautre and also a avrage
build nothing to extrra odrinary but nothing bnad either."

With the switch on (saved with the account, `TeamAccount.assumeAverage`), an
**owned character with nothing saved** is scored in team checks with:

- their **signature weapon** (the game's own link in `weapons.json`) at the first
  refinement, so kit lines that need it unlock;
- an **average build** made from the game's own recommended build above: level
  cap, the first option of each recommended set on the slots the game puts it
  on, the first recommended main stat on every slot that has a choice, and each
  recommended sub stat once per piece (at most 4, never the main stat), 1 roll
  each with no upgrades on top. Roll values are not assumed.

That is right sets and main stats with ordinary sub stats. The usual build check
reads it like any saved build, so it can still be "not built for it" when a
team wants a stat the game doesn't recommend for that character. Every place
the build or weapon is used says "assumed: signature …, average build (…)".
A saved build always wins; characters you don't own are never assumed; with the
switch off nothing changes ("no build saved, scored at base"). Code:
`src/core/rules/averageBuild.ts`, each game's `assumed.ts`; tests in
`tests/averageBuild.test.ts`.
## Target stats (owner's job T35, both games)

The owner: "the best or remconded stats each ahcrhter should end up with in the
end for the roaster charchter profile thing so like u know what to build
towards." The numbers had to be found, not handed over, and every one needs a
source. So a target is shown **only when the game text states it**:

1. **The character's kit** (traces, talents, Eidolons / Mindscapes, core
   passives). Example: Jiaoqiu's "For every 15% of Jiaoqiu's Effect Hit Rate that
   exceeds 80%, additionally increases ATK by 60%, up to 240%". The bonus is at
   its maximum at 80% + 4 × 15% = **140% Effect Hit Rate**.
2. **Their signature weapon.** Example: Ruan Mei's Past Self in Mirror,
   "Break Effect exceeds or equals 150%".
3. **The sets the game recommends for them.** Example: Glamoth "SPD is equal to
   or higher than 135/160".

Each target shows:
- the stat;
- the number, with its steps, and whether the text says "initial" or "current";
- what reaching it does;
- the source;
- the quote, word for word (a test checks every quote against the game data);
- the working, when the number isn't written as is;
- when it applies (Enhanced kit, E6, Core Skill level 7, "with their signature
  equipped", "with <set>").

When the text gives a start and no cap, the target reads "above X (no cap in the
text)". When the game text gives no number for a character, there are no rows and
the page says "No data yet". The game's recommended main and sub stats are shown
as a **direction** with no numbers. No community numbers are used.

**You:** the saved build's `totals`, i.e. the character's stat screen, from the
scan, HoYoLAB or typed in. Without totals, "you" is "No data yet".

Not covered yet, because the text gives no number: CRIT Rate caps from traces,
SPD breakpoints from the turn formula, Energy Regen for an Ultimate every N
turns, and Effect Hit Rate against enemy Effect RES. These need maths or numbers
the app can't cite yet; each can be added later with its working shown.

Code:
- `src/core/rules/statTargets.ts`;
- each game's `statTargets.ts` (the read facts);
- tests in `tests/statTargets.test.ts`.
