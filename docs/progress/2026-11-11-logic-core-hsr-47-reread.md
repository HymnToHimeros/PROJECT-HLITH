# 2026-11-11 LOGIC-CORE: HSR 4.7 release, Elation sheets re-read

HSR 4.7 is out (Aeon ★ Aha released today). The release files gave every Elation character a new trace, "Faces of Elation ★ …", and replaced Aha's beta text with live text. `src/games/hsr/kitcheck/sheet/groupI.ts` is re-read.

**"When the Path of Elation ascends":** Aha's own trace makes it ascend while Aha holds "Faces of Elation" (after Aha's Ultimate). So every new team line needs Aha in the team (`named` 1511, member).

**New lines for the team (all with Aeon ★ Aha):**
- Sparxie: allies ignore 20% DEF.
- Yao Guang: "Great Boon" multiplier +40%.
- Aventurine • Waveflair, when Aha is his only Elation teammate: all allies +25% SPD, and his Elation Skill counts as a Follow-Up ATK.
- Trailblazer · Elation: their Ultimate's CRIT DMG becomes +80% for all allies. It shares a noStack group with the one-ally +50% and comes first, so it counts when Aha is there.
- Pearl's, Evanescia's and Silver Wolf LV.999's new traces buff only themselves.

**Pearl:** her signature Light Cone (Colors for Tomorrow) now has text: enemies take +22% DMG, and all allies are healed for 10% of her DEF.

**Aeon ★ Aha, live text:**
- Quotes updated; numbers unchanged.
- "Elation Debt" is now 25% of HP lost, capped at 10% of Max HP. What it does is still unexplained (`unverified` stays).
- "A Prank on Aeons" extra Elation DMG: the release text says Aha's own Follow-Up deals it, so it now counts for Aha (`self`), not for the Emanator ally.
- Eidolon 2's text is still an unfilled template in the files (told SCHEDULER).

`statTargets.ts`: Aha's SPD 125/150 quote now uses the release wording.
