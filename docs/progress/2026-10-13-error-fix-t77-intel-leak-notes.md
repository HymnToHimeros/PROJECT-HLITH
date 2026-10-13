# 2026-10-13 · ERROR-FIX · T77 every approved finding reaches Intel (branch errorfix/t77-intel-leak-notes)

- Cause: approving an `info` finding did nothing (planApproval only knew event, banner, character and leak findings), and Intel only reads the lists, never findings.
- Owner's rule: "Intel is for all games info, doesn't matter what kind of leak it is." Every approved finding, any kind or source, now also shows in that game's Intel under "News and leaks": newest first, game tag in the all-games view, kind (Leak, Event, Banner, Character, News), date, credit and link; leaks marked UNVERIFIED; posts with English first ("Translated, may be inexact", "Show original"), images as links only. Stored as a catalog row of the existing `leak` kind (everyone signed in reads it; no migration), source `finding:<id>`.
- Findings that fit a list still go into it (events, banners, characters, leaks with list fields). An info finding about a new event is checked against the game's Events: already listed (Data Bounty: Combat Simulation is), nothing more; not listed, the Lists form opens with its name and dates.
- Every Approve says where it went ("Added to HSR · Intel. Added “X” to HSR · Events."). "Move back to new" retires both the note and the list item; nothing is deleted.
- Backfill: when the Owner console loads, approved findings without a note get one (once; a retired note stays retired). Nobody's data is touched.
- Tests: src/tools/owner/LeakNotes.live.test.tsx, src/tools/intel/leakNotes.test.ts; Lists and Scheduler live tests updated for the extra Intel row.
