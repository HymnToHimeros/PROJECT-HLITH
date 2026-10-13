# 2026-10-13 · ERROR-FIX · T77 approved leak posts reach Intel (branch errorfix/t77-intel-leak-notes)

- Cause: approving an `info` finding did nothing (planApproval only knew event, banner, character and leak findings), and Intel only reads the lists, never findings.
- Leak posts (an info finding marked as a leak, with its post) now become a "Leak notes" entry in that game's Intel: newest first, title, date, credit and post link, UNVERIFIED, English first with "Translated, may be inexact" and "Show original", images as links only. Stored as a catalog row of the existing `leak` kind (everyone signed in reads it; no migration), source `finding:<id>`; "Move back to new" retires it.
- An info finding about a new event is checked against the game's Events: already listed, the inbox says so; not listed, the Lists form opens with its name and dates. Data Bounty: Combat Simulation is already in ZZZ Events (data refresh), so that approval correctly adds nothing.
- Every Approve says where it went ("Added to HSR · Intel · Leak notes"), or that it went nowhere and why.
- Backfill: when the Owner console loads, approved leak posts without a note get one (once; a retired note stays retired). Nobody's data is touched.
- Tests: src/tools/owner/LeakNotes.live.test.tsx (approve → Intel, backfill, event check, plain message, undo), src/tools/intel/leakNotes.test.ts.
