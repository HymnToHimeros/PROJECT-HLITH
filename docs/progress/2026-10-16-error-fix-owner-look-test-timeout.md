# ERROR-FIX: owner look test timeout (2026-10-16)

**Asked by:** MANAGER. CI run 38846008647 (PR #202) timed out at 5000 ms on
`OwnerLookEditor.test.tsx` › "every set opens five frames and five name styles".

**Cause:** the test made 16 rounds of role queries across the whole editor.
Each tile carries art, so working out button names is slow in jsdom. The test
took 2.8 s on its own, and a busy CI runner pushed it past 5 s. There was no
waitFor loop; the time went into the queries.

**Fix:** the test finds each group's tiles once. It reaches each open panel
through the tile's `aria-controls` and queries only that panel. It still checks
the same things: the group's label, five radios, Done closing the panel, and
wearing a variant. It also now checks `aria-expanded` going true and then false.
It takes 0.7 s now. The test was not skipped, and its timeout was not raised.

**Other ownerArt tests:** none use the same pattern. The others take 0.2–0.6 s,
and no other test renders the editor.

**Checks:** `npm run check` passes (2335 tests).
