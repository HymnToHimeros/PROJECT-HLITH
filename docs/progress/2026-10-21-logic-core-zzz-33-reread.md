# 2026-10-21 LOGIC-CORE: kit sheets re-read for the ZZZ 3.3 release files

The release files re-worded four weapon lines the Kit check quotes (SCHEDULER's #211 left `weapons.json` out until this re-read).

- **Severian's W-Engine (Incarcerating Grip):** CRIT Rate is now **+20%** (was +24%). Wind RES ignore is now **15%** (was 16%). These are score changes.
- **Phoenix's W-Engine (Plume of Rebirth):** wording only. "Attribute Anomaly DMG … CRITs" now reads "Anomaly DMG … triggers a critical hit". Same +90 Anomaly Proficiency, same +40% Fire DMG.
- **Candlelit Scheme (was Candlelight Conspiracy):** wording only; same 8% CRIT Rate and 15% DMG.
- **See You at the World's End! (HSR):** "additionally increases by 12%"; same numbers.
- **Aeon ★ Aha's signature Light Cone (HSR beta 4.6.53):** the DEF-ignore trigger is now "at most once every interval of 1 turn" (was every 2 turns). Only the setup text changed; nothing quoted changed.
- `npm run data:builds` brings in the new `weapons.json` and the 3.3 `builds.json`. nanoka now lists 3.3 as live, so Severian (out 11 Nov) is read from the release files without the beta mark. Phoenix's sub stats lost "ATK".
- `tests/recommendedBuilds.test.ts`: a character not out yet may have the live files' recommendation, unmarked. A beta mark still needs its build and is never on a released character.
- 3.3 banners now list only the S-Rank. Nothing in pity or Luck counts A-Rank featured items, so nothing to change.
