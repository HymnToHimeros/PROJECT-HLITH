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

**Score** = the average of the parts that have data, rounded. **Grade**: S 90+,
A 75+, B 60+, C 40+, else D. The screen shows every part with its bar and its
reason, and says how many parts had no data yet.

Not scored yet (shown, not counted): skill levels, refinement / phase, set
choice ranking (any recommended option counts the same), and how high the sub
stat values rolled. No damage maths: the score says how closely a build follows
the game's recommendation, not how much damage it does.

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
