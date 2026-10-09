# PROJECT-HLITH · WORKSTREAMS

Several chats build HLITH at once. Each one has a name, and every branch it
creates starts with that name, so you can always tell who made what.

## Rules for every chat
1. Pick a name that says what the chat does (e.g. `frame`, `roster-logic`), not a
   fantasy name, and add yourself to the table below.
2. Name every branch `<name>/<job>`, e.g. `frame/step-02-tokens`.
3. Stay inside your area. Shared files (`src/core/contract/`, `src/core/registry/`)
   change only through the chat that owns them, or with a note here.
4. Tick roadmap items by adding their proof files, then run `npm run roadmap`.
   Never tick by hand.
5. Before starting, read `CLAUDE.md`, `docs/PLAN.md`, `docs/ROADMAP.md` and this file.

## Who's who
| Name | Branches | Builds | Roadmap items |
|---|---|---|---|
| **FRAME** | `frame/…` | The skeleton and shelves: look, shell, contract, registries, data, engines, the module screens as frames | R01–R34, R39–R61 |
| *(next chat, e.g. ROSTER-LOGIC)* | `roster-logic/…` | Roster logic core: kit check, teams, roster scoring | R35–R38, plus any new items it adds |

A new chat that adds roadmap items gives them the next free R-number and a proof file.
