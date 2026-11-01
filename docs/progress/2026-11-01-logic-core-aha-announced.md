# 2026-11-01 LOGIC-CORE: Aeon ★ Aha announced, beta sheets still guarded

The 1 Nov data refresh lists Aeon ★ Aha with her official release date (11 Nov 2026) and no leak mark. Her kit is still read from the beta files (4.6.54).

- **Kit check (T43), HSR and ZZZ libraries:** a sheet read from beta text whose text changed is set aside until it's read again. This used to apply to leaks only; it now also applies to characters announced but not out yet, so a beta change to Aha's kit can't turn the build red or score her from an old reading. `sheet.test.ts` (HSR) and `check.test.ts` (ZZZ) keep their strict word-for-word check for sheets read from live text.
- **Tests:** HSR lists no leaks today.
  - `tests/leaksInTeams.test.ts` makes Aha a leak for the test, as the ZZZ part does with Lucia.
  - `tests/staleLeaks.test.ts` tests her as announced with a beta kit. Its two "beta text changed" cases mark her kit beta themselves, so they keep working after 11 Nov.
