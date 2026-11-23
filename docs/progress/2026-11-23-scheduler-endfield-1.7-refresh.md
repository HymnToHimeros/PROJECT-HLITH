# 2026-11-23 · SCHEDULER · Data refresh red on Endfield 1.7 and ZZZ 3.4 dates

The timer refreshes of 22 Nov (17:48, 23:35 UTC) imported fine but their
check went red (7 tests). Causes and fixes:

- **Mimino** (Endfield 1.7, a free "welfare" operator) is on the wiki with no
  game id and on no banner, so she had no release date and counted as out
  (no kit, build or attribute yet). The import now leaves out an operator
  with no game id, no release date and no headhunting banner, with a note,
  until the wiki gives her a game id. Headhunting operators stay (their
  banner gives the date).
- **Precious Scarlet** rerun: the wiki says 2026-12-16 to 2026-01-07 (the
  end year is wrong). A banner whose end is not after its start is now left
  out with a note, as events already were. Nothing is guessed.
- **Kay** (1.7, out 25 Nov) recommends "Sweet Deal", which the wiki's weapon
  list doesn't have yet. For an operator not out yet, the build import now
  leaves such a weapon out with a note instead of stopping. Kay gets no
  build until the wiki lists it; the builds test gives a new operator 14
  days, as the kits test does.
- **ZZZ 3.4**: Sunbringer, Kafka and Robin now have official release dates,
  so the list no longer marks them as leaks. The kit test now counts "not
  out yet" as a leak or a release date still ahead.

npm run check: 2383 green. The refresh is started by hand after merge.
