# PROJECT-HLITH · ROUTINES

How the external routine delivers what it finds to HLITH. Set the routine chat up
from this page.

## What runs where
- **Supabase scheduler** (built): one Cron job every 15 minutes starts the
  `scheduler` function, which runs the fixed jobs (nightly backup, HoYoLAB daily
  check-in and codes). Setup: `docs/SETUP.md` §4.
- **Data refresh** (GitHub Action `.github/workflows/data-refresh.yml`, SCHEDULER):
  every 2 hours it asks `npm run schedule:due` whether a check is due (counted
  from patch day, `scripts/schedule/rhythm.ts`). When one is, it re-imports the
  lists and leak kits, runs the full check, merges a data-only PR by itself and
  delivers `ran` / `failed` / `next_at` and `info` findings for the three jobs
  below.
- **Research routine** (a scheduled Claude Code chat, see "Research routine"
  below): at key moments only, it does what needs reading and judgement and
  delivers for the `research-routine` job.
- Neither writes user data. Findings go to your inbox (Owner console → Findings),
  where you approve or dismiss each one.

| Job id | What the routine looks for |
|---|---|
| `leaks-scan` | New leaks, e.g. the new-item lists in the nanoka.cc data. |
| `events-scan` | New events, banners and versions. |
| `game-data-refresh` | After a patch: new characters, items and kits. |
| `research-routine` | The research routine: official notices the importers don't read, a second leak source (Hakushin), gaps in the lists. |

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
| `job` | One of `leaks-scan`, `events-scan`, `game-data-refresh`, `research-routine`. |
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

## Research routine
The instructions the scheduled chat follows. Its trigger prompt only says: "Read
docs/ROUTINES.md § Research routine in PROJECT-HLITH and do it." Changing what it
does = a reviewed PR to this section.

**When it runs.** At key moments only (`node scripts/schedule-due.ts --key`):
patch day after maintenance, the expected special-program announcement and
pre-download notice, new banner starts, and the first check of each quiet
middle. Both games share a run when they fall within 12 hours. A weekly heartbeat
(Mondays about 08:50 UTC) only checks that the next run is set.

**Each run, in order.**
1. `git pull` on main, `npm ci`. Note the time.
2. Official notices the importers don't read (official news list and in-game
   notice board, both games, since the last run):
   - special program / livestream date and time → `info` finding;
   - redeem codes from the program → `info` finding (the HoYoLAB job tries codes);
   - a new version's announced characters, banners and events → if a leaked
     character now has its official name, a data PR that fixes the name, plus an
     `info` finding.
3. A second leak source next to nanoka.cc: Hakushin (hsr.hakush.in,
   zzz.hakush.in; for HSR also the DimbreathBot data). Something there that our
   lists don't have → a `leak` finding with the source named and the payload
   fields from "Payload that goes straight into the lists". Never into the lists
   directly.
4. Gaps: run `npm run data:schedule` and read its notes ("left out: no start
   yet", rewards unknown). Fill only what a source proves (official notice, wiki,
   game8), as a small data PR.
5. Data refresh health: read the last runs of the Data refresh Action. When an
   import broke because a source changed, fix the importer in a PR.
6. Deliver: one request to findings-intake with `ran: ["research-routine"]` (or
   `failed` with what went wrong), the findings, and
   `next_at: { "research-routine": <next key moment + 30 min> }`.
7. Re-arm: set this routine's trigger to run once at the next key moment + 30
   minutes (`update_trigger`, `run_once_at`, `enabled: true`).

**Its PRs.** Branch `scheduler/research-<date>`. `npm run check` green before
pushing. READY to MANAGER like every other chat's PR. Never merged by itself
(judgement was involved).

**Rules.**
- Honest data only: what a source says, with the source named. A leak is marked
  as a leak. No guesses.
- The intake key never appears in the routine's text: its cloud environment's
  network proxy adds it to requests to findings-intake by itself (the Action uses
  the FINDINGS_INTAKE_KEY GitHub secret). Never ask for it in a chat, never put it
  in the repo.
- Never touches user data, never sends a key in text, never edits another chat's
  files except through a PR.
- When it can't decide something, it delivers an `info` finding with the question
  and leaves it.
- A missed re-arm is caught by the heartbeat, which re-arms the routine and
  delivers `failed` for `research-routine` ("missed its re-arm; re-armed for …").

