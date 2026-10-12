# 2026-10-12 · FRAME · T67 Rewards: exclusive items the owner gives out

MANAGER's defaults, plus: a silenced account may claim or be given rewards (they aren't
community-facing), but its card shows nothing while silenced. Banned accounts and accounts
that haven't finished first run are refused.

- Migration 0019 (only adds; tested on a local Postgres with every migration):
  reward_items, reward_claims, reward_grants, reward_log. No write policies: only the
  functions write. People read their own grants and the items they hold; the owner reads all;
  a banned account reads nothing.
- The owner's own badges, frames and name styles can never be given: an item's picture must be
  a reward-pool key "r-<kind>-…" of the same kind (a table check).
- Owner only: add item, give by username (ignoring case), revoke (with a reason), claim codes
  (16 characters, one-time or up to N uses, optional end date; only a hash is kept, the owner
  sees the code and link once), cancel a code.
- claim_reward(code) for signed-in accounts: "already" doesn't use up a code.
- Every item, grant, claim, revoke and code goes into reward_log; owner_moderation_log() lists
  it together with moderation (Users tab: "Gave Lantern to Mira", "Mira claimed Aurora").
- profile_card() is 0018's plus rewards: a worn badge, frame or name style shows only while
  held (badge follows the badges switch). The owner's own look wins on the owner's card.
- App: Owner console → Rewards; Customise profile → Exclusive (tags "Exclusive · event ·
  date", wear one per kind, "Have a code?"); claim links /account/profile#claim=CODE (the code
  stays on the device through sign-in, like invite links).
- Starter pool: 3 badges (Lantern, Starfall, First Forge), 3 frames (Aurora Ring, Ember Crown,
  Runestone), 3 name styles (Aurora, Embers, Frost). They move with the Animations setting.
- Purge/export include reward_grants and reward_log; the backup copies all four tables.
  Privacy policy: a new "Exclusive rewards" paragraph (no version bump yet, question to the
  owner via MANAGER).
- Screenshots: docs/owner-reports/2026-10-12/t67-rewards/.
