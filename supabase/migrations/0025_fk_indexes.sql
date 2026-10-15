-- Performance advisor (health sweep, 15 Oct): foreign keys without a covering index (advisor 0001).
-- Each index lets Postgres find a user's (or item's, job's) rows without reading the whole table, and
-- keeps deletes on the parent row cheap. Only adds indexes; nobody's data changes.
-- skport_checkins.user_id is left to the skport migration (FRAME, 0023).
create index if not exists hoyolab_checkins_user on public.hoyolab_checkins (user_id);
create index if not exists hoyolab_redemptions_user on public.hoyolab_redemptions (user_id);
create index if not exists moderation_actions_user on public.moderation_actions (user_id);
create index if not exists plans_user on public.plans (user_id);
create index if not exists reward_claims_item on public.reward_claims (item_id);
create index if not exists reward_grants_claim on public.reward_grants (claim_id);
create index if not exists scheduler_runs_job on public.scheduler_runs (job_id);
