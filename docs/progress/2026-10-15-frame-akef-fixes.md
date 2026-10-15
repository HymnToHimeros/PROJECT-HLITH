# 2026-10-15 · FRAME · AKEF test-pass fixes (a–h) + migration 0026

PR [#197](https://github.com/HymnToHimeros/PROJECT-HLITH/pull/197), branch `fix/akef-test-pass`.

Items from LOGIC-CORE's Endfield test pass, plus the server-side migration:

- **(a)** Events login-days tile: "No data yet" instead of "no login event running".
- **(b)** Calculator: ended events get `'ended'` status (was `'skipped'`), shown with label.
- **(c)** Banners rail: always-open rows show the banner title so permanent banners are
  distinguishable.
- **(d)** Roster: hide HoYoLAB import on Endfield (no `hoyolab` provider).
- **(e) client**: `cardExtras.ts` passes `guaranteeAfterLoss` to `luck()` from the banner
  type's pity model.
- **(e) server**: migration 0026 — `pull_numbers(p, rules)` accepts per-banner-type
  `guarantee` and `featured` flags; `profile_card` passes `gd -> 'bannerRules'`.
  Client stores `bannerRules` in synced game data via `bannerRulesOf()` (pity.ts) +
  `setBannerRules()` (userData.ts) + an App.tsx startup effect. Old data without
  `bannerRules` falls back to the previous behaviour.
- **(f)** Example history: filter unreleased characters from `newestTops`; weapon step
  size from `hardPityOf(type.pity)`.
- **(h)** Intel + character page: confirmed upcoming banners get "Official banner" label;
  `UnverifiedTag` only when `c.leak` is set.
- **(i)** handled by SCHEDULER.
