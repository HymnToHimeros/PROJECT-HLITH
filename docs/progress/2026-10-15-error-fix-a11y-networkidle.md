# 2026-10-15 · ERROR-FIX · flaky accessibility timeout on HSR Farm (branch errorfix/a11y-no-networkidle)

- Cause: the accessibility scans waited for `networkidle`. HSR Farm loads 12 character pictures from an outside host (static.nanoka.cc); one slow picture there keeps a page from ever going idle, so the wait timed out at 30 s (#182, phone, e2e 3) though the screen was long finished. Reproduced: with that host made to hang, `networkidle` times out and the new wait is ready in ~20 ms.
- Fix (tests only): `readyToScan()` in tests/e2e/settle.ts: no "Loading…", web fonts ready (served by the app), short animations finished. Used at all four scan points in accessibility.spec.ts. examples.spec.ts keeps its `networkidle`, which is the point of that test (a page that never stops loading) and names what is still open.
- All 86 accessibility tests pass on PC and phone.
