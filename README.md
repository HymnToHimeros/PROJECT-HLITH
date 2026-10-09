# PROJECT-HLITH

**HLIÐSKJÁLF** is one command seat for your gacha games. It is named after Odin's high seat, from which he sees every world.

**Live:** https://project-hlith.hliskjlf.workers.dev

It keeps your pulls, events, roster and dailies for every game in one place, on phone and PC:

| Module | What it does |
|---|---|
| **Today** | Resets in your local time, dailies and weeklies, tonight's run, wishlist |
| **Pulls** | Planner, Calculator, Bank log, History with Luck report (official and community odds) |
| **Roster** | Every character, owned / wanted / dupes, character pages, Teams, Kit check |
| **Calendar** | Banners, events, endgame and resets on one timeline |
| **Events** | Open / done / skipped, login days, rewards still to earn |
| **Banners** | Live and upcoming banners, leaks (hideable), how each fits your roster |
| **Backlog** | Content that still pays out, counted toward your pulls if you want |
| **Farm** | Materials and stamina for the characters you are building |
| **Intel** | New content no other module covers, clearly marked unverified |

Games today: **Honkai: Star Rail** and **Zenless Zone Zero**. Any other game is one new folder, with no changes to the app itself.

## Principles

- **Honest data.** HLITH never shows a number it can't prove. Missing values say *No data yet* and how to fix it. Example data always carries an `EXAMPLE` badge.
- **Your data is never wiped.** Updates to the built-in lists never touch your progress.
- **Every game is a plug-in.** The app is a skeleton (`core/`), shared modules (`tools/`) and one folder per game (`games/`). A test fails the build if `core/` or `tools/` ever depend on a game.

## How it's built

| Part | Choice |
|---|---|
| App | React 19, Vite, TypeScript (strict), CSS Modules |
| Accounts and data | Supabase: sign-in, per-user tables with row-level security, server functions |
| Hosting | Cloudflare Workers (static assets); every merge to `main` goes live |
| Game data | [nanoka.cc](https://nanoka.cc), used with its owner's permission |
| Tests | Vitest, Testing Library, Playwright (PC and phone sizes) |

```
src/
  core/      skeleton: shell, contract, registries, saved data, look
  tools/     modules and engines: pulls, roster, events, budget, pity, …
  games/     one folder per game: contract + data
tests/       unit, architecture and browser tests
scripts/     roadmap check, game-data import
supabase/    database migrations and server functions
config/      tool settings (Vite, tests, lint, TypeScript, public env)
docs/        plan, roadmap, progress; design/ holds the design files
```

## Working on it

```bash
npm install
npm run dev        # local app
npm run check      # lint, typecheck, unit tests, build (run before every commit)
npm run e2e        # browser tests at PC and phone sizes
npm run roadmap    # refresh the self-checking roadmap
```

Adding a game: copy `src/games/_template/`, fill in the contract, register it in `src/games/index.ts`.

## Docs

- [`docs/ROADMAP.md`](docs/ROADMAP.md): what's done, which ticks itself off from the code
- [`docs/PROGRESS.md`](docs/PROGRESS.md): what happened, what's next, decisions
- [`docs/DESIGN.md`](docs/DESIGN.md) and [`docs/design/`](docs/design): how it looks
- [`docs/FEATURES.md`](docs/FEATURES.md): everything HLITH must do
- [`docs/WORKSTREAMS.md`](docs/WORKSTREAMS.md): who builds what
- [`docs/DEPLOY.md`](docs/DEPLOY.md) and [`docs/SETUP.md`](docs/SETUP.md): hosting and outside settings
