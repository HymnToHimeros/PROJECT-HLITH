# 2026-10-15 · ERROR-FIX · flaky "theme light" accessibility test (branch errorfix/flaky-theme-a11y)

- Cause: tests/e2e/accessibility.spec.ts wrote the theme into localStorage after the first page had loaded. The app keeps its settings in memory and saves the whole object on its next change (Shell records the last opened module), which put its own theme back. Whether that save landed after the test's write depended on timing: a flaky "dark" (#179, phone, e2e 3). Reproduced deterministically: write "light", one in-app navigation, reload → "dark".
- Fix (test only): the theme goes in with page.addInitScript, before any app code runs, on every page load. 18 runs of light, dark and crimson on PC and phone pass.
- Not a user bug: the app only changes the theme through its own settings.
