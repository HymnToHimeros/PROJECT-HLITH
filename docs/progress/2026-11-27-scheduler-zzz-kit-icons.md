# 2026-11-27 · SCHEDULER · ZZZ kit import: Sunbringer's own button icons

- The 26 Nov 10:51 data refresh went green and merged (#255), but its ZZZ
  kit step had failed: Sunbringer's beta kit uses her own button icons
  (Icon_SpecialReady_Sunbringer, Icon_Ult_Sunbringer), which the import's
  table didn't know, so it stopped. Because the import step itself succeeded,
  later timer runs didn't retry, so the ZZZ 3.4 beta kits stayed on the
  older text.
- Both icons are now in the table ("EX Special Attack button", "Ultimate
  button", read from the text around them). kits.json re-imported: the
  latest beta text for Sunbringer, Kafka and Robin.

## Follow-up: a failed import can't pass unnoticed

- The refresh now counts a run as an import only when every import step
  succeeded. The imports carry on after an error, so GitHub reports them as
  "success" either way; a new marker step, "All imports succeeded", runs
  only when each import's outcome was success, and
  scripts/last-import.ts (tested in tests/lastImport.test.ts) looks for it.
  A run with a failed import keeps its checks due, so the next timer run
  retries it.
- A run with a failed import no longer merges by itself, even when the
  partial lists pass the check: the PR waits and says "NOT all succeeded".
- The run ends red as before, and now names each failed step as an error
  on the run page.
- Until the first run with the marker step, the lookup finds none and the
  8-hour window rule is used; a run by hand after merge sets it.
