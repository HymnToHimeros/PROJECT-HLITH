# 2026-10-12 · ERROR-FIX · T72 Assistant 400 "compiled grammar is too large" (branch errorfix/t72-assistant-grammar)

- Cause: #137 made 10 strict tools; together with web search (on by default) Opus 5.5 and Sonnet 5.5 refused the request as too large a grammar. 7 strict tools (e1aa0ad) worked.
- Fix: the three backlog tools (add, edit, hide) are no longer strict, so 7 strict tools again. Their cards check every value; odd or missing values give a "can't use this" card (tested).
- A test pins the strict tools at 7 or fewer, with the error text in a comment (STRICT_TOOLS_MAX).
- That 400 now reads: "The Assistant’s tools are too big for this model right now. Turn off web search and try again." with its code.
- After merge: deploy `assistant` (FRAME).
