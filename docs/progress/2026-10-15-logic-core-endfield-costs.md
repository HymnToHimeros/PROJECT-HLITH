# 2026-10-15 · LOGIC-CORE · E7 Endfield materials (step 1)

Done:
- `npm run data:endfield-costs` imports what every operator needs to max from endfield.wiki.gg
  (levels, Promotions I–IV, four combat skills to 12, Ability Matrix nodes), cited per operator.
- The character page's "Materials to max", Farm and Today now use real Endfield amounts.
  Sanity per run isn't on the wiki, so runs and Sanity say "No data yet".
- Tested against the wiki's own Cost Summary: every operator matches it exactly. The one
  disagreement between wiki pages (Gear Outfitting I: 1,600 or 1,800 T-Creds) follows MANAGER's
  ruling (1,800, from the Operator page; unverified in game). The import stops on any
  disagreement nobody has ruled on.

Next: item sources and weapon costs, once MANAGER decides on the core changes.
