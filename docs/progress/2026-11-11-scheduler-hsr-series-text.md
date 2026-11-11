# 2026-11-11 · SCHEDULER · HSR kits: placeholder text in Eidolons filled in

- Aeon ★ Aha's Eidolon 2 came through as an unfilled game placeholder
  (`#{series_ref_skill_desc:…}`). The HSR kit import now fills it with the
  skill texts the game puts there, one line per skill ("• name: text").
- A placeholder the import can't fill now stops the import with a message,
  instead of reaching the site as raw code.
- Data: the next data refresh writes the filled text into kits.json.

## Follow-up: base level for the "Faces of Elation" traces

- These traces sit on no skill tree, so the import took their highest level
  (2). Level 2 is what Aeon ★ Aha's Eidolon 2 grants. The import now shows
  any skill an Eidolon's text points at at level 1, so numbers stay
  "without Eidolons". Aha's Eidolon 2 text itself still shows level 2.
- kits.json regenerated: 9 traces changed (LOGIC-CORE re-reads the sheets).
