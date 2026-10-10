# MANAGER handover (2026-10-10, 13:00 UTC)

Why: after the owner made the repo public (GitHub Actions minutes ran out), the old
MANAGER session's GitHub tool returned 404 for every request about PROJECT-HLITH
(merge, list PRs), even after the owner reconnected GitHub. Plain git still worked.
A new MANAGER session gets fresh access. Start with docs/briefs/MANAGER.md, then this.

## Waiting to merge
- **#76** LOGIC-CORE: owner's own team lists (logic) + hidden Trailblazer never used.
  All checks green on 00a1f78 (the "check" job passed on re-run once the repo was
  public). Merges cleanly. Merge it first.

## In progress (chats report READY to MANAGER)
- FRAME: HoYoLAB check (are stamina reads / check-ins succeeding? no secrets), then
  T29b: the screen to edit the owner's team lists ("Edit team list" on a card,
  per slot ordered list, "Reset to the game's list"). Owner wants Robin • Summeretto
  addable to Phainon's team.
- ERROR-FIX: secret scan done. Clean (only the public Supabase key and fake test logins).
  Owner was told their personal email is in 74 commit author lines and given options;
  no answer yet. Suggested GitHub Secret scanning + Push protection.

## Owner rules learned today (also in MANAGER.md / RELEASES.md / WORKSTREAMS.md)
- MANAGER approves and merges every PR. Never ask the owner "may this go live";
  double-check (green check, diff does what was asked, screenshots for big screen
  changes), merge, then tell the owner.
- Branch names start with `manager/` for MANAGER.
- HSR and ZZZ logic mirror each other except game-specific facts.
- Teams: only each carry's own game team, filled from the roster; never mix-match.
  Owner's test: Phainon + Sunday + Cerydra + Dan Heng PT is Phainon's top team.
- End tasks (after everything else): list-refresh schedule, research routine,
  phone notifications, Resend.
- Plain, short words to the owner; no pronouns assumed (use "they").

## Session ids
FRAME session_01JhX321c2CZBUjDK5Z6yXKX · LOGIC-CORE session_01BA3zSGcxmptiKVhzJkBkaP ·
SCHEDULER session_01AYGjoovgX3AtCHtQ3TvW5T · ERROR-FIX session_01HQ51Y69kZRzfNsM6jQyQ7j ·
old MANAGER session_01GimxkMJzEydgMJauGc9J4o (replace in WORKSTREAMS with the new id).
