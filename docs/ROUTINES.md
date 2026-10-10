# PROJECT-HLITH · ROUTINES

How the external routine delivers what it finds to HLITH. Set the routine chat up
from this page.

## What runs where
- **Supabase scheduler** (built): one Cron job every 15 minutes starts the
  `scheduler` function, which runs the fixed jobs (nightly backup, HoYoLAB daily
  check-in and codes). Setup: `docs/SETUP.md` §4.
- **External routine** (not set up yet): a separate scheduled Claude Code chat,
  run a few times a week (Mon, Wed, Fri around 06:00 UTC), does the jobs that need
  reading and judgement. It never writes into HLITH's lists itself; it only
  delivers findings to your inbox (Owner console → Findings), where you approve or
  dismiss each one.

| Job id | What the routine looks for |
|---|---|
| `leaks-scan` | New leaks, e.g. the new-item lists in the nanoka.cc data. |
| `events-scan` | New events, banners and versions. |
| `game-data-refresh` | After a patch: new characters, items and kits. |

The list lives in `supabase/functions/_shared/jobs.ts` (jobs with
`target: { kind: 'external' }`). A new routine job = one entry there.

## The key
The routine has its **own** key, never the service key. It can add findings and
nothing else.
1. Make a long random string (at least 32 characters, e.g. from a password manager).
2. Supabase → Integrations → Vault → Add new secret → name `findings_intake_key`,
   secret = that string.
3. Give the same string to the routine (as a secret of the routine's environment,
   not in its prompt text or in the repo).

To change it: edit the Vault secret and the routine's copy. Old key stops working at once.

## The request
```
POST https://qywvnvwfsknfcxgpbivo.supabase.co/functions/v1/findings-intake
Content-Type: application/json
x-intake-key: <findings_intake_key>
```
Body:
```json
{
  "ran": ["leaks-scan", "events-scan"],
  "failed": [{ "job": "game-data-refresh", "message": "nanoka.cc answered 503" }],
  "next_at": { "leaks-scan": "2026-10-11T06:00:00Z", "events-scan": "2026-10-12T06:00:00Z", "game-data-refresh": "2026-10-11T12:00:00Z" },
  "findings": [
    {
      "job": "leaks-scan",
      "game_id": "hsr",
      "kind": "leak",
      "title": "New 5★ character in version 3.8",
      "payload": { "character": "Example", "element": "Ice", "version": "3.8" },
      "source": { "name": "nanoka.cc", "url": "https://nanoka.cc/hsr" },
      "found_at": "2026-10-09T06:00:00Z"
    }
  ]
}
```

| Field | Rule |
|---|---|
| `ran` | Optional. Job ids the routine ran this time, so a run that found nothing still shows in the log ("Delivered 0 findings"). |
| `failed` | Optional. Jobs whose run went wrong this time: `{ "job", "message" }`, message in plain words, up to 500 characters. Each is recorded as a red **error** run in Owner console → Scheduler → Run log, with the message as written. A job in `failed` is not also in `ran` and has no findings in the same delivery (one outcome per job). |
| `next_at` | Optional. When the routine runs each job next (the cadence is self-adjusting): `{ "<job>": "<ISO time>" }`, after now and at most 31 days ahead. The Owner console shows it as "Next expected" and says **Overdue** once it has passed. A job reported without a time is expected on its fallback cadence (Mon, Wed, Fri 06:00 UTC). |
| `findings` | Up to 100 per request. May be empty when `ran` or `failed` names a job. |
| `job` | One of `leaks-scan`, `events-scan`, `game-data-refresh`. |
| `game_id` | Optional. `hsr`, `zzz` … (lower-case letters, digits, `-`). Leave out for findings about no single game. |
| `kind` | `leak`, `event`, `banner`, `character` or `info`. |
| `title` | Required, up to 300 characters. Plain words: what was found. |
| `payload` | Optional object, up to 8,000 characters as JSON: the details needed to add it to the lists (names, dates, ids). See "Payload that goes straight into the lists" below. |
| `source` | Required. `name` = who or what it came from; `url` = optional http(s) link. Leaks always show their source. |
| `found_at` | Optional ISO time when it was found; not in the future, not over a year old. Missing = time of delivery. |

The whole request is at most 256 KB.

### Payload that goes straight into the lists
When the owner presses Approve, a finding whose payload has every field below is
added to that game's built-in list at once (Owner console → Lists). If anything
is missing, the Lists form opens with what the payload gave, for the owner to finish.
- `event`: `title`, `kind` (`event`, `login`, `web`, `endgame`, `bonus`), `start`,
  `end` (ISO times). Optional: `reward` (number), `currency`, `loginDays`, `id`.
- `banner`: `title`, `type` (the game's banner type id or label), `start`, `end`.
  Optional: `featured` (list of ids), `id`.
- `character`: `name` (or `character`), `rarity` (`top`/`mid` or the game's word,
  e.g. `5★`, `S`), `element`, `role` (id or label). Optional: `releasedAt`, `id`.
- `leak`: the same fields as the thing leaked; it is marked as a leak with the
  finding's source. Add `"list": "characters" | "banners" | "events"` if it is
  not obvious.
- `info`: never goes into a list.
Without `id`, a stable id is made from the name (events: name + start date).

## Answers
- `200 { "ok": true, "saved": [{ "job", "delivered", "added", "known" }] }`:
  saved. `known` = already delivered by the same job in the last 30 days (same
  game, kind, source and title), so not added again.
- `400 { "error": "Nothing saved.", "problems": [ … ] }`: something is wrong;
  **nothing** from the request was saved. Each problem names the field
  (`findings[2].kind: …`). Fix and send again.
- `401`: wrong or missing key (or the Vault secret does not exist yet).
- `413`: request larger than 256 KB; split it.

Every delivery is recorded as a run of its job (Owner console → Scheduler →
Run log, "by routine"), and each finding shows which job delivered it and when.

## Rules for the routine
- Honest data: only what a source actually says. No guesses, no filled-in numbers.
- One finding per thing found. The inbox does the de-duplication.
- Never call any other HLITH function and never send the service key.
