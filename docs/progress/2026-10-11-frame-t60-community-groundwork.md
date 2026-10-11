# 2026-10-11 · FRAME · T60 community groundwork

The owner wants a closed community later (Discord inside HLITH, share cards, Linked Roles,
a bot, picture rights, leaderboards, polls): that is Phase 8 in the ROADMAP, planned.
Built now, only the frame, so the owner can start inviting members:

- **Migration 0014** (`community_members`, `community_invites`): tester role on the server,
  `is_member()` / `is_tester()` (the owner counts as everything), one-time invite links
  (only a sha256 fingerprint of the secret is stored; the link is shown once), owner-only
  `create_invite`, `cancel_invite`, `owner_invites`, `owner_members`, `remove_member`, and
  `invite_status`, `accept_invite`, `community_home` (members only). RLS on, no write
  policies; remove = `removed_at`, cancel = `cancelled_at`. Tested on a local Postgres as
  owner, tester and stranger; `tests/community.test.ts` checks the SQL's guarantees.
- **Invite links**: `/community#invite=<secret>` (after the #, so the host never sees it).
  The app takes it out of the address and keeps it on the device until it's accepted, refused
  or found unusable, so it survives signing in. The sign-in screen says "You've been invited".
- **Owner console → Members**: create invite (optional note), copy link once, invites with
  UNUSED / USED (by whom, when) / CANCELLED and Cancel; testers with Remove (asks twice).
- **Community page** (`/community`): menu link (sidebar and phone More) only for testers and
  the owner; the server refuses its data to anyone else. Placeholder: "The community is being
  built. You're one of the first." plus real numbers and the empty place for the Discord.
- **Email sign-in unlock**: when signed in, the server's role decides (tester/owner keeps it on
  the device, anyone else loses it). Signed out, "Owner or tester? Use email" stays (the device
  can't ask the server), and an invite link also opens it.
- **Deletion**: purge removes membership and the invites the account used or made; backups
  copy both tables; export includes your membership row. Privacy page says what's kept.
- Screenshots: `docs/owner-reports/2026-10-11/community/`.
- After merge: apply 0014 if the integration skips it, deploy purge-accounts, backup,
  export-data and delete-account if stale.
