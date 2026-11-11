# 2026-11-11 · SCHEDULER · HSR kits: placeholder text in Eidolons filled in

- Aeon ★ Aha's Eidolon 2 came through as an unfilled game placeholder
  (`#{series_ref_skill_desc:…}`). The HSR kit import now fills it with the
  skill texts the game puts there, one line per skill ("• name: text").
- A placeholder the import can't fill now stops the import with a message,
  instead of reaching the site as raw code.
- Data: the next data refresh writes the filled text into kits.json.
