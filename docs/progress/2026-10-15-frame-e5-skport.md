# E5: Endfield live data through SKPort

**Chat:** FRAME · **Branch:** `claude/zen-clarke-up2y9d`

## What shipped

Endfield sanity (stamina), daily check-in, and account level via
Gryphline's SKPort platform — the global counterpart of HyperGryph's
SKLand for CN.

### Edge function (`skport`)
- Shared module `_shared/skport.ts`: three-step token chain
  (ACCOUNT_TOKEN → cred via OAuth grant → salt via refresh), V2 request
  signing with `MD5(HEX(HMAC-SHA256(...)))`, card detail, check-in
- Host allowlist: `zonai.skport.com` and `as.gryphline.com` only
- Entry point: CORS, requireUser, body parsing (10 KB limit),
  Vault-backed token read/save/forget, stamina + check-in reads

### Migration (`0022_skport_links`)
- `skport_links` table with Vault token storage (same forget pattern as
  HoYoLAB: overwrite with random text, stamp forgotten_at, never delete)
- `skport_checkins` table for check-in results
- Server-only RPCs: save, secret read, forget, purge
- Gate + ban restrictive RLS policies (matching 0015/0016)

### App wiring
- `skport.ts` bridge: token reading, encrypted device storage
  (AES-GCM via deviceVault), server account loading, merge logic
- Endfield contract declares `accountLinks: [{ provider: 'skport' }]`
- `staminaSources()` extended with provider discriminator, SKPort
  sources checked before HoYoLAB
- `useLiveStamina` branches on `src.provider === 'skport'`
- `loadServer()` loads SKPort accounts in parallel with HoYoLAB
- Backup, purge, and export plans updated for new tables

### Tests (19)
- Host allowlist (2), request parsing (4), error text safety (2),
  readSkport full chain (7), findRoles (1), claimCheckin (1),
  credential non-echo (2)

### Config
- `config.toml`: entries for `skport` and `endfield-gacha-import`

## Status

Server + app wiring committed, tests green, pushed. UI (link screen,
Today stamina display, screenshots) not yet started.
