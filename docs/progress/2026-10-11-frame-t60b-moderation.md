# 2026-10-11 · FRAME · T60b Owner console → Users (moderation)

Owner: "see who also joined … instant ban/remove or silence … not an iron fist, but as an option."

- **Migration 0015**: `account_restrictions` (silenced_until / banned_until; 'infinity' = until
  lifted / permanent; both run out on their own) and `moderation_actions` (the log). Owner reads
  both; no write policies. `is_banned()`, `is_silenced()`, `my_standing()`.
  - **Banned**: restrictive RLS (select / insert / update) on every table with people's data, so
    even a session from before the ban is refused.
  - **Silenced**: restrictive insert/update on community tables, and `profile_card` (same as 0011
    plus the check) returns nothing, so their card doesn't show with shared teams. A test makes
    every future `community_*` / `share_*` table carry the silence policy.
  - `owner_users()` (no emails: name, picture, sign-in methods, joined, last active, tester, owner,
    status), `owner_moderation_log()`, `moderate()` (owner only, never self or another owner,
    24 h / 7 days / no end). Remove = permanent ban + the normal 30-day deletion request
    ('removed-by-owner'); Undo remove cancels both. Tested on local Postgres.
- **No Supabase Auth ban, on purpose** (MANAGER: banned/removed users must still be able to
  download their data, as the privacy page promises): a banned account can still sign in,
  sees the suspended screen with **Download my data**, and nothing else works. Enforcement is
  RLS (every table) + requireUser (every server function); only export-data passes
  `allowBanned` (read-only, own rows), and a test checks no other function does.
- **requireUser** (every user-facing server function): refuses banned accounts (Auth's
  banned_until and `is_banned()` asked as the caller).
- **App**: Owner console → Users (search, sort, confirm with duration + reason, log); a calm
  "Account suspended until …" screen with the contact address and Download my data; silenced accounts see "Sharing
  is paused" in Share and a note on the Community page.
- Purge removes restrictions and log rows (and the log rows the account wrote); backups copy
  them; export includes them. Terms: new "6. Moderation". Privacy: what the owner sees, and the log.
- After merge: apply 0015 if skipped; deploy every function using requireUser (assistant,
  delete-account, evening-message, export-data, gacha-import, hoyolab), plus purge-accounts
  and backup.
