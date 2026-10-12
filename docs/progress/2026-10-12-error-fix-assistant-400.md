# 2026-10-12 · ERROR-FIX · T69 Assistant answered 400 to every message (branch error-fix/assistant-strict-tools)

- Cause (found by MANAGER against the real API): the Assistant's strict tool schemas used `minimum: 0`, which strict mode rejects, so Claude refused every request that carried tools.
- Fix: `minimum` removed from the four number fields; the rule is in their descriptions. The app already refused negative bank amounts and backlog counts; negative login days, dupes and route minutes are now refused too, as an error card.
- A test walks every tool schema for keywords strict mode can't take, for every model, so this can't come back (tests/assistantTools.test.ts).
- A Claude 400 now says its real cause: no credit left, a model the request can't use, a chat too long, a bad picture. Anything else keeps the old text plus a short code (E400-xxxxxx). The function logs Claude's error type, message and that code; it never logs the key or the request.
- After merge: deploy the `assistant` function.
