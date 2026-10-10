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
