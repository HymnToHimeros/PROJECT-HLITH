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
