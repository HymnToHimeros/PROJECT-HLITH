# 2026-10-15 · FRAME: Endfield pull history via web sign-in

Branch `claude/zen-clarke-up2y9d`.

New import method for Endfield pull history: sign in on the web account
page, copy the account token, and paste it into HLITH. Works from any
device (phone, console, PC) — no PC log file needed.

## What changed

- **`supabase/functions/_shared/endfieldWebSignin.ts`** (new): the
  three-step exchange from account_token to u8_token, following the same
  dependency-injection pattern as `skport.ts`:
  1. OAuth grant (`as.{provider}.com/user/oauth2/v2/grant`)
  2. Binding list (`binding-api-account-prod.{provider}.com/…/binding_list`)
  3. u8_token (`binding-api-account-prod.{provider}.com/…/u8_token_by_uid`)

  Supports both Global (gryphline) and CN (hypergryph). Only contacts
  the four auth/binding hosts, never anything else. The resulting
  `ParsedLink` feeds straight into the existing `fetchHistory()`.

- **`supabase/functions/endfield-gacha-import/index.ts`**: now accepts
  `{ accountToken, region }` as an alternative to `{ link }`. Extracts
  the token from raw JSON (the user might paste the whole response from
  the token URL) or a plain string. Runs the exchange, then proceeds
  with the same `fetchHistory` path.

- **`src/core/contract/game-contract.ts`**: `HistoryImporter.kind` now
  includes `'token'`.

- **`src/games/endfield/contract.ts`**: added the `endfield-token`
  importer (kind: `'token'`, label: "Web sign-in (account token)").

- **`src/tools/pulls/History.tsx`**: new "Sign in on the web" import
  way with a region picker (Global / CN) and a token paste area.
  Sends `{ accountToken, region, knownIds }` to the edge function.

- **`src/tools/pulls/importGuides.tsx`**: added `tokenSteps()` guide
  (visit account page → visit token URL → paste), `tokenUrl` and
  `accountPage` fields on the Endfield guide, and updated the
  phone/console note to mention web sign-in as an alternative.

- **`src/tools/pulls/pulls.module.css`**: `regionRow` and `radioLabel`
  styles for the region picker.

- **`tests/endfieldWebSignin.test.ts`** (new): 7 tests covering the
  exchange happy path (global + CN), expired token, no binding,
  network failure, default serverId, and host allowlist.

All Endfield tests pass. TypeScript typecheck clean.
