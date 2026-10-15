# E1: Endfield game skeleton

**Date:** 2026-10-15
**Branch:** `frame/endfield-skeleton`
**Status:** PR ready

## What shipped

- `src/games/endfield/contract.ts` — full game contract with:
  - Currencies: Origeometry (paid), Oroberyl (500/pull), HH Permits, Arsenal Tickets
  - 8 banner types: Chartered, RE-Factor, Joint, Basic, New Horizons, 3 weapon pools
  - Pity: hard 80, soft from 65 (+5%/pull), 0.8% base rate, 50/50 with no guarantee after loss
  - Stamina: Sanity (135 max, 6 min/point)
  - Endgame: Contingency Contract
  - Servers: Global (UTC-5), CN (UTC+8)
  - All 9 modules enabled (Override 1)
  - All data loaders empty ("No data yet")
- `ownerOnly` flag on `GameContract` — owner sees the game, public users don't
- `App.tsx` filters owner-only games before passing to Shell
- Tests updated, all 1945 passing, build clean

## What's next

- E2 (SCHEDULER): data import and Intel
- E3 (LOGIC-CORE): pity and odds
- E4 (FRAME): pull history import edge function
- E5 (FRAME): SKPort live data
