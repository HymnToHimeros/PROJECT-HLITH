# 2026-11-01 LOGIC-CORE: "beta kit, may change" for characters not out yet

MANAGER's call under the honest-data rule: a team score built on beta kit text says so for announced characters not out yet, the same as for leaks.

- `src/core/rules/leaks.ts`: `betaLines` adds "Not out yet: X: beta kit, may change (beta build …)". `betaKitLines` gives the leak lines, then the not-out-yet lines; a leak says it once.
- HSR and ZZZ libraries list `beta`: characters whose kit is beta text and who aren't leaks, with the build read.
- Teams say it everywhere a leak would: the team notes and plain words, If you pull, and the teammate list. Unlike leaks, these characters are not hidden from other teams.
- `tests/leaksInTeams.test.ts`: the core lines, HSR with Aeon ★ Aha's kit marked beta (so it keeps working after 11 Nov), and ZZZ with Lucia made not-out-yet.
