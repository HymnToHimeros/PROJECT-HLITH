# 2026-10-12 · ERROR-FIX · T68 code scanning alerts (branch error-fix/code-scanning)

- A HoYoLAB login remembered on this device is now stored encrypted (AES-GCM; the key is a browser key that can't be read out, kept in IndexedDB): src/core/data/deviceVault.ts, src/tools/account-links/hoyolab.ts.
- Existing users: the first time the accounts load, their plain-text logins (both older formats) are moved into the encrypted list. The plain copy is removed only after the encrypted one is written, so nobody loses a link. An encrypted list the browser can no longer open is set aside, not deleted.
- A browser without encryption no longer writes the login in plain text: "Remember on this device" then lasts until the page closes, and the form says so.
- Privacy policy: one sentence now says the device copy is encrypted (dated 12 October; wording only, no new consent).
- Markup cleaning: one shared helper (src/core/text/markup.ts: stripTags, stripComments, unwrapComments) repeats until nothing is left, used by the roster, the profile and every import script that stripped tags or comments.
- Tests: src/core/text/markup.test.ts, src/tools/account-links/deviceSecrets.test.ts (encrypted save, move from both plain formats, failed write keeps plain copy, early change, Forget, unreadable list, no-encryption browser). Checked in Chromium that the key survives a reload.
