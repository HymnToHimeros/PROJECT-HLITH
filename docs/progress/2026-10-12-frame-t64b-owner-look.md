# 2026-10-12 · FRAME · T64 Part B1: the owner's look (badges, frames, name styles, full sets)

The owner picked from the option sheets (docs/owner-reports/2026-10-11/t64-options*) and kept
everything: owner badges 0–8, frames 1–20 (frame 16 replaced: no window shape) and name
styles 1–20, plus 8 full sets (badge N + frame N+12 + name N+12) with "Wear full set".

- **Drawings**: `src/tools/account/ownerArt/art.ts` (SVG text, from the sheets), `svgMotion.css`
  and `names.css`. They load only for the owner (`Owner.tsx` lazy-loads `OwnerArt.tsx`; its
  own download in the build). Ids are made unique per use.
- **Animations** follow Account → Theme → Animations: On moves, Reduced keeps only soft glows
  and colour, Off holds still.
- **Profile**: `ownerStyle` { badge 0–8, frame 1–20 | null, name 1–20 | null } stored with the
  card's look (`showcase.look.owner_style`). Shown only when the server says you are the owner.
- **Customise → Your owner look** (owner only): the 8 full sets with "Wear full set"
  ("Wearing this set" when all three match), then every badge, frame and name style to mix.
- **Card**: owner frame (the whole drawing fits the picture slot, the picture inside it),
  owner name style on the name (plain name kept for screen readers), chosen owner badge on
  the card and in Badges.
- **Migration 0017**: `profile_card()` = 0016's plus `owner_style`, only for the owner and only
  as numbers (a test compares it with 0016). Tested on local Postgres: owner gets it (bad
  values dropped), anyone else gets nothing, even with the same row.
- Frame 16 (the Eclipse set): the owner kept all five round-2 frames as its variants (A
  Astronomical Clock, B Two Crescents, C Sköll & Hati, D Armillary Sphere, E Compass Rose).
  `ownerStyle.frameVariant` / `nameVariant` (0–4) say which; "Wear full set" takes the first.
  Picking frame 16 in Customise opens its variants. More sets get 5 variants next (sheets first).
- Visibility: everyone who can open the owner's card sees the owner's look (0017 puts it on
  the owner's card only, so nobody else can claim it); it moves by each viewer's own
  Animations setting. Checked on local Postgres as a different account.
- Screenshots: docs/owner-reports/2026-10-12/t64b-owner-look/ (all 8 sets on the card, PC and
  phone, the Customise section, a card after "Wear full set").
- Next (B2+): showcase best team + luckiest pull, earned titles, badge shelf (pin 3), stats
  card, bio filter, favourite game, background, privacy switches, silenced lock.
