# 2026-10-14 · LOGIC-CORE · Pulls → Bank log changes

Done:
- A balance check shows how much each currency changed since the balance HLITH
  expected (the last check plus earned and bought, minus spent), and about how
  many pulls that is (the game's own rules: premium currency per pull, a pass
  is one pull; a paid currency with no rule is not turned into pulls).
- A rise counts as Earned, a drop as Spent, marked "from balance check". The
  Earned / Bought / Spent tiles add them to what you logged and say how many
  came from balance checks.
- Bought, Earned and Spent change the balance right away, so the next check
  only counts what is new (a purchase is never counted as Earned too).
- Everything saved together (all currencies of one check) is one entry, listed
  under its day. Undo cancels the whole entry; it stays listed, marked undone.
- Stored entries are not changed: the groups and changes are worked out from
  them each time, so older entries show the new way too.
- Same logic for every game (src/tools/pulls/bankLog.ts). Tests in
  bankLog.test.ts and PullsScreen.test.tsx.
