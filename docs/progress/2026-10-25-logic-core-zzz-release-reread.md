# 2026-10-25 LOGIC-CORE: Phoenix and Severian re-read from the ZZZ 3.3 release files

The kit import now reads the release text for both (scripts/import-nanoka-kits.ts, SCHEDULER's #223). The release translation renamed most of their skills, so both sheets in `src/games/zzz/kitcheck/sheet/groupI.ts` were re-read in full.

**Severian, score change:** his Core Passive DMG is now **+25%** (was +20%). The +30% with another Wind character stays.
- Wording only:
  - Chain Attack: Coldblade Reap, Optimal Setup, Mindscapes 1, 2, 4 and 6.
  - Renamed pieces, e.g. Raging Whirlwind, Azure Wind's Shadowhunt, Entry Skill: Clear Out.

**Phoenix, score changes:**
- Mindscape 2 is **+30%** DMG on Seared enemies (was +25%).
- Soul-Searching Blaze's Abloom scales with her **Chain Attack** level (was Basic Attack level).
- New: both her Ablooms (Purifying Flame, Soul-Searching Blaze) get **+40% CRIT DMG** when they crit. These are two new entries.
- "Scorch" / "Searing Corrosion" is now **Sear** throughout. Her Additional Ability names a state the game files leave blank (term 1000048). It's still read as a state on the enemy, with no name guessed (zzz-decisions 44).

**Target stats:** Phoenix's Anomaly Mastery 255 now quotes the release wording.

**Tests:** `src/games/zzz/kits.test.ts` now lists Sunbringer (1601) and Robin (1661) as leaks: kit text only, no sheet read yet. They are the only beta kits, since Severian reads from the 3.3 release files.
