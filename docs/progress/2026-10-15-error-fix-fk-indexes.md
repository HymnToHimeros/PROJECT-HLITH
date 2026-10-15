# 2026-10-15 · ERROR-FIX · indexes for unindexed foreign keys (branch errorfix/fk-indexes)

- From the live health sweep (Supabase performance advisor 0001, ×8).
- Migration 0025_fk_indexes.sql adds 7 indexes: hoyolab_checkins.user_id, hoyolab_redemptions.user_id, moderation_actions.user_id, plans.user_id, reward_claims.item_id, reward_grants.claim_id, scheduler_runs.job_id. skport_checkins.user_id is left to FRAME's 0023.
- Additive only (`create index if not exists`); merge after 0023 and 0024.
