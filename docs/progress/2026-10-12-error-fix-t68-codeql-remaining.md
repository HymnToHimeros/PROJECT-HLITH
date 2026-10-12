# 2026-10-12 · ERROR-FIX · T68 last 8 code scanning alerts (branch errorfix/t68-codeql-remaining)

- CI workflow: read-only permissions for every job (`permissions: contents: read`); no job writes. data-refresh.yml is unchanged.
- A picture you pick (Adjust picture/banner, Scan a screenshot) is now drawn on a canvas from the decoded picture (new core/ui BitmapImage). No address is made for the file, so nothing from it reaches the page as a URL. Checked in Chromium on PC and phone; the Profile and Scan browser tests pass.
- History link finder: the character ranges are spelled out (the same set, checked over every character), with a test for where a link ends.
