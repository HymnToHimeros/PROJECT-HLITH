# 2026-10-11 · FRAME · T62 first run: accept the Terms and Privacy policy, choose a username

Owner: before using the site after making an account, choose a username; the Terms and
Privacy policy are shown again and must be confirmed as read, understood and agreed.

- **Migration 0016**: `account_identity` (username, username_changed_at, terms_version +
  terms_accepted_at, privacy_version + privacy_accepted_at). Read your own row; no write
  policies at all, only `accept_legal` and `set_username`, so the rules can't be skipped.
  - Versions: `public.terms_version()` / `privacy_version()` = `config/legal/versions.ts`
    (a test keeps them equal). Raising one asks everyone again (only step 1).
  - Usernames: 3–20 letters, numbers, _ . ; unique ignoring case; reserved names (owner, admin,
    mod, moderator, hlith, hlidskjalf, hliðskjálf, project-hlith, support, staff, official,
    system, anywhere in the name, also with dots/underscores/look-alike digits) and a short
    slur/swearing list are refused. Words that hide short slurs (therapist, peacock…) pass.
    Change at most once every 30 days (the first change after choosing is free); old names free.
  - Until both are done: restrictive policies stop adding/changing app data and files; reading,
    the deletion request and Export my data stay possible. `requireUser` refuses too, except
    export-data and delete-account (`allowUnaccepted`), checked by a test.
  - `my_gate()` (where you stand, suggested username = your display name if valid and free),
    `username_status()` for the live check. Owner lists, Members, invites, the log and the
    profile card show the username (functions redefined from 0014/0015 with the username only;
    tests compare them).
- **App**: `FirstRun` (step 1 summaries + links + required checkbox, Continue disabled until
  ticked; step 2 username with live available/taken/reserved check). Sign out and Delete my
  account (type DELETE, the normal 30-day deletion) stay available. Sync starts only after the
  gate. Profile → Username card (change, 30-day note); profile card shows @username.
- Buttons now look disabled when they are (opacity), app-wide.
- Privacy: one paragraph on the username and which versions you accepted, when.
- Tested on local Postgres: writes refused before, allowed after; old versions refused; reserved,
  look-alike and blocked names refused; case-insensitive uniqueness; freed names reusable; the
  30-day rule; a version bump re-prompts step 1 and blocks writes until accepted.
- After merge: apply 0016 if skipped; deploy every requireUser function (assistant,
  delete-account, evening-message, export-data, gacha-import, hoyolab) plus purge-accounts and
  backup (table lists).
