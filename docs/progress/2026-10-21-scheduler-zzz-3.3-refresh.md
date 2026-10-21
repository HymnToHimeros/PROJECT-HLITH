# 2026-10-21 SCHEDULER: ZZZ 3.3 patch day refresh

- `data:nanoka` + `data:schedule` after the ZZZ 3.3 notices:
  - ZZZ version 3.3: 2026-10-21 06:00 (UTC+8) to 2026-12-02 06:00 (UTC+8).
  - Events: All-New Program, The Final Callback, Spooky Funhouse Tales, Cyber Miracle Healer, Trails of the Hobbling Crow, Repair! Drifting Art, "En-Nah" Into Your Lap (official periods).
  - Phoenix and Severian are announced, so they're no longer leaks.
  - HSR: the Bygone Reminiscence end comes from the official notice.
- Banners: the 3.3 Phase I banners show only their S-Rank. The official notice no longer names A-Ranks: from 3.3 the player picks the 2 rate-up A-Ranks ("A-Rank Rate Up"), and the defaults aren't stated. Told LOGIC-CORE.
- HSR "Interastral Peace Gala: One Take": 500 Stellar Jade (from the import, unchanged).
- ZZZ main story: Season 3 Chapter 4 "Journey to the Sky" is official (news 166928), but the wiki's Season 3 page doesn't list it yet. The 2-hourly refresh adds it when the wiki does.
- `data:builds` (scripts/import-nanoka-builds.ts): a character whose official release date has passed while nanoka still lists the previous version as live (patch day) is read from the newest files without the "beta" mark. tests/recommendedBuilds.test.ts follows the release date instead of a fixed list.
- Not in this PR: zzz/hsr `weapons.json`. The release files renamed and re-worded several W-Engines and one Light Cone (e.g. Nirvana's First Plume → Plume of Rebirth). LOGIC-CORE's sheets quote the beta text, so LOGIC-CORE re-reads them first.
