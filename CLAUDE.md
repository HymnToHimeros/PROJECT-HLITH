# Project rules
- The name is always in capitals: PROJECT-HLITH, HLITH, HLIÐSKJÁLF
  (with Ð and Á). Never "Hlith", "Hlidskjalf" or "Project-Hlith".
- Read docs/FEATURES.md (everything in it must ship) and docs/DESIGN.md
  (look, layout, tokens) before building. Follow them, except where
  OVERRIDES below says otherwise. OVERRIDES always wins.
- Stack: TypeScript, one framework. Structure: core/ (shell, module
  registry), tools/ (generic features), games/<name>/ (one contract file
  + data + rules), games/_template/. core/ and tools/ never import from
  games/; a test fails the build if they do.
- Honest data: never show a value the app can't prove; show "no data yet".
- User data is never wiped. List updates never touch anyone's progress.
- Plain language when talking to me. No model names in commits or code.
- Work in small steps. After each: tests green, commit, push, update
  docs/PROGRESS.md. If I say my usage limit is reached, finish the step,
  update PROGRESS.md and stop. I resume with "continue from PROGRESS.md".
- Few pushes (free hosting rate limits). Branch names describe the job.
- Ask questions in chat, not in a form.

## OVERRIDES
1. Every game has the same modules. Game-only things are features inside
   a module. Kit check is NOT ZZZ-only: it lives in Roster -> Teams and
   the character page, and any game shows it when kit data exists (ZZZ
   now, HSR later); otherwise "No data yet".
2. Pull history comes only from the in-game history link and export
   files (UIGF/SRGF). HoYoLAB does not provide it. HoYoLAB gives live
   stamina, check-in, character import and endgame records.
3. Pulls has four tabs: Planner, Calculator, Bank log, History. The Luck
   report is a card inside History.
4. ink.5 must reach at least 4.5:1 on bg.app and bg.card; lighten it.
5. These features from FEATURES.md have no design yet. Build them with
   the same tokens and components, and show me each one: Edit mode (add,
   change, hide my own events, banners, backlog items), screenshot scan
   of a character screen, Today's "tonight's run" and wishlist, the
   Assistant's proposals with approve/undo, evening message and calendar
   feed settings, setup checklist and Guide, HoYoLAB link, share a team,
   delete my account and export my data.
