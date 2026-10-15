# 2026-10-15 · LOGIC-CORE · Endfield test pass (logic fixes)

Went through every Endfield screen on a local build with Endfield shown. Fixed in my area:
- Luck report and History: a banner with nothing featured (Endfield's Basic and New Horizons,
  HSR's and ZZZ's Standard) no longer counts its top results as won or lost 50/50s. On HSR this
  pulled the "50/50 won" rate down, because the import marks standard-pool results "not featured".
- Odds in words: "50/50" only where it is one in two. Endfield's weapon banners say "25% featured"
  (Planner card, History's pity tile, "Know your pity?").
- Farm: an operator with no material amounts yet (Argent Flow) is named as "Not counted" instead of
  silently left out; no Sanity total while anyone is missing. With only her chosen, Farm and her
  page say "No data yet" instead of made-up example rows.
- Character page: "For your teams" says "No data yet (mark who you own in Roster)" while you own
  nobody, instead of "No gain".
- Team explanations: Endfield's chains read "sets up Combustion, which sets off …" (was "their sets
  up …"), and a chain two skills set off is said once.

Sent to FRAME and SCHEDULER (their areas): see the message to MANAGER of 2026-10-15.
