# E4: Endfield pull history import

**Chat:** FRAME · **Branch:** `claude/zen-clarke-up2y9d`

## What shipped

Full pull history import for Arknights: Endfield, the first non-HoYo game.

### Edge function (`endfield-gacha-import`)
- Shared module `endfieldGachaLog.ts`: `parseLink`, `fetchHistory`,
  `poolTypeToGachaType`, `toRawPull`, `LINK_ERROR_TEXT`
- Character pools: iterates all 5 pool types
  (`Special`, `Rerun`, `Joint`, `Standard`, `Beginner`) by `seq_id`
- Weapon pools: discovers pools via `/api/record/weapon/pool`, then pages each
- Filters free/gift items, sorts by seqId, deduplicates, stops at known ids
- Host allowlist: `ef-webview.gryphline.com` (global) and
  `ef-webview.hypergryph.com` (CN)
- Token from HGWebview.log URL (`u8_token` param), short-lived

### App wiring
- `contract.ts`: `historyImporters` (link + file), `historyMapping` with
  `gachaTypes` (8 types) and `rarity` (6→top, 5→mid, 4→low)
- `History.tsx`: dispatches to `endfield-gacha-import` edge function
- Import guides: Endfield-specific paste steps (HGWebview.log on PC),
  `linkLogSteps()` for the log-file flow, `guideFor` fallback to game id

### HLITH pull history file format (`src/tools/import/hlith.ts`)
- Own JSON format for games without UIGF/SRGF: `{ app, kind, version, game,
  exportedAt, timezone, list[] }` with raw gacha_type/rank_type
- Export button in History tab (downloads `hlith-<game>-pulls.json`)
- `parseHistoryFile` detects HLITH files alongside UIGF v4 and SRGF
- File importer added to Endfield contract

### 75-day import reminder
- `lastPullImportAt` field in `GameUserData`, set on every successful import
- Reminder card in History tab when ≥75 days since last import

### Tests
- `endfieldGachaLog.test.ts`: parseLink (global/CN hosts, unknown hosts,
  missing token), fetchHistory (all pool types, weapon pools, stop-at-known,
  free/gift filtering, expired token, sort order)
- `hlithExport.test.ts`: round-trip build/parse, wrong-game rejection,
  reverse mapping, format detection
- `standardPool.test.ts`: skip games without `standardTop` data

## Open follow-ups
- Web sign-in flow (account_token → u8_token exchange) is not in this PR.
  Currently only the HGWebview.log link method is supported.

## Checks
- TypeScript: clean
- ESLint: clean
- Tests: all relevant tests pass (10 files, 80 tests)
- Build: clean
