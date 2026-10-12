# 2026-10-12 · ERROR-FIX · Calendar: the last week label never runs off the page (branch `error-fix/calendar-overflow`)

- main was red: on PC the Calendar scrolled sideways by 33 px. A week label starts at its line, so a week starting near the right end of the timeline ("Mon, Nov 16" on 12 Oct) ran past it; it depended on the date.
- Now each label is measured after drawing: one that would run past the end sits to the left of its line instead (again when the width changes). As a safety net the PC timeline clips sideways overflow (`overflow-x: clip`, which keeps the sticky date scale working).
- New browser test with the clock pinned to 11, 12, 14 and 17 Oct: no sideways scroll and every date label inside the timeline, PC and phone. It failed before the fix.
