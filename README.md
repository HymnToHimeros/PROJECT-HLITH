<div align="center">

<img src="public/icons/hagalaz.svg" alt="" width="88">

# HLIÐSKJÁLF

**One seat, every world.**<br>
A command centre for your gacha games: what to do tonight, how many pulls you'll have, and who fits your teams.

[**Open the app**](https://project-hlith.hliskjlf.workers.dev) · [Privacy](https://project-hlith.hliskjlf.workers.dev/privacy) · [Terms](https://project-hlith.hliskjlf.workers.dev/terms) · [License](LICENSE) · [Contact](mailto:hlidskjalf.contact@gmail.com)

![React 19](https://img.shields.io/badge/React_19-20232a?logo=react&logoColor=61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript_strict-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646cff?logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-1c1c1c?logo=supabase&logoColor=3ecf8e)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-f38020?logo=cloudflare&logoColor=white)
![Tested with Vitest and Playwright](https://img.shields.io/badge/tested-Vitest_·_Playwright-6e9f18)

Honkai: Star Rail · Zenless Zone Zero · more games as plug-ins

<img src="docs/screenshots/banners.png" alt="The Banners board: one timeline for every game, live banners as big cards, what's next and later" width="920">

</div>

---

**PROJECT-HLITH** puts every banner, event, reset, saved pull and character you own in one
place, on your phone and your PC. Open it and it tells you **what to do tonight**, **how many
pulls you'll have** when the banner you want arrives, and **what's still left to earn**. It
never guesses: what it can't prove says **No data yet**.

## Highlights

- **One evening plan** for every game, on your own server's reset.
- **Pulls you can trust:** every source counted until the version ends, with your chance to win.
- **Teams that explain themselves:** every kit is read, so a synergy % comes with reasons.
- **Your data stays yours:** list updates never touch your progress; backups and export any time.
- **Installs like an app** on phone and PC, and opens offline with what's saved.

<p align="center">
  <img src="docs/screenshots/today.png" alt="Today: resets, open tasks and live banners for both games" width="49%">
  <img src="docs/screenshots/teams.png" alt="Roster → Teams: recommended teams with a synergy % that explains itself" width="49%">
</p>
<p align="center">
  <img src="docs/screenshots/pulls.png" alt="Pulls planner: pulls by each banner, chance to win and worst case" width="49%">
  <img src="docs/screenshots/calendar.png" alt="Calendar: banners, events and resets on one timeline" width="49%">
</p>

## Features

| | |
|---|---|
| **Today** | Dailies and weeklies on your server's reset, events about to end, live stamina from HoYoLAB, live banners, tonight's run and your wishlist. |
| **Banners** | One timeline for every game; live, next and later banners as big cards with countdowns and how each fits your account. Leaks are clearly marked (or hidden). |
| **Roster & Teams** | Owned, wanted, copies and saved builds; kit check; recommended teams with who fits and what to pull; team lists you can edit and share. |
| **Pulls** | Planner (Now / Next / Later, chance to win, worst case), Calculator, Bank log, and History from the in-game link or UIGF / SRGF files, with a Luck report. |
| **Calendar · Events · Farm** | Everything on one timeline (with a calendar feed), what's left in each event, and the materials each character still needs. |
| **Backlog** | Permanent content that still pays out, counted toward your pulls. Add your own items, and **import or export** your backlog as a file (below). |
| **Assistant** | Ask in plain words. It proposes plans and changes (including new backlog items); you approve or undo each one. **Attach files** (.json, .md, .txt, .csv, .pdf); an attached pull export or backlog file can be imported straight from the chat. |
| **Profile & Rewards** | A profile card with picture, banner, showcase, badges and earned titles. **Rewards** are exclusive badges, frames and name styles, given out or claimed with a code. Owner-only looks exist too and are never handed out. |
| **Make it yours** | Many themes, each with its own art; your own background; edit the layout; every screen works on a phone. |
| **Account** | Sign in with Google, Discord or an email link; sync between devices; HoYoLAB link (live stamina, daily check-in, character import, endgame records); evening message; backups; download your data or delete your account. |

<p align="center">
  <img src="docs/screenshots/theme-midnight-sakura.png" alt="Midnight Sakura theme" width="32%">
  <img src="docs/screenshots/theme-jade-whisper.png" alt="Jade Whisper theme" width="32%">
  <img src="docs/screenshots/theme-crimson-haze.png" alt="Crimson Haze theme" width="32%">
</p>
<p align="center">
  <img src="docs/screenshots/phone.png" alt="Today on a phone" width="22%">
  <img src="docs/screenshots/backlog.png" alt="Backlog: the story as a checklist, rewards still on the table" width="66%">
</p>

### Backlog file format

Backlog → Import / Export uses one JSON format, `hlith-backlog-export` version 1. Every row
becomes one of your own items, with its progress; importing the same file again never adds
duplicates and never lowers progress. The app has a "File format" card and a template to
download.

```json
{
  "format": "hlith-backlog-export",
  "version": 1,
  "dataAsOf": "2026-10-12T00:00:00.000Z",
  "backlog": [
    { "id": "my_chests", "game": "zzz", "category": "Exploration", "label": "Chests in a new area",
      "total": 40, "done": 12, "rewardEach": 5, "unit": "chest", "step": 1 }
  ]
}
```

Required per row: `id`, `game`, `label`, `total`. Optional: `category`, `done`, `rewardEach`,
`rewardUnknown`, `unit`, `step`, `where`, `note`.

## Three promises

1. **Honest numbers.** It never shows a number it can't back up. If it doesn't know, it
   says **No data yet** and tells you how to fill it in.
2. **Your data is never wiped.** Updates to the built-in lists never touch your progress.
   Sync keeps the newer copy and stores the other one.
3. **Every game is a plug-in.** Adding a game means adding one folder. A test fails the
   build if the app ever reaches into a game's folder.

## How it's built

```mermaid
flowchart LR
  you([You · phone or PC]) --> app
  subgraph app[HLITH app · Cloudflare]
    core[core<br>shell, contract, saved data] --- tools[tools<br>Today, Pulls, Roster, …]
    tools --- games[games<br>HSR · ZZZ · …]
  end
  app <-->|sign-in, sync, your data| supa[(Supabase<br>database + server functions)]
  supa -->|every 15 min| sched[Scheduler<br>backup · daily check-in · codes]
  sched <--> hoyo[HoYoLAB]
  routine[Research routine<br>finds leaks & new info] -->|findings to approve| supa
```

- **The app:** React 19 + TypeScript (strict) + Vite, served by Cloudflare Workers as an
  installable app with an offline shell. Every merge to `main` goes live within minutes.
- **Supabase** holds accounts and data (each person sees only their own rows) and runs the
  server functions: HoYoLAB, history import, backups, rewards, the Assistant.
- **The scheduler** wakes every 15 minutes for the nightly backup, the HoYoLAB check-in
  and code redemption.
- **A research routine** looks for new events, banners and leaks and hands them to the
  owner to approve before anything shows up.
- **Five workstreams** build it (FRAME, SCHEDULER, LOGIC-CORE, MANAGER, ERROR-FIX), each with
  its own files and brief; see [WORKSTREAMS](docs/WORKSTREAMS.md) and [RELEASES](docs/RELEASES.md).

```
src/
  core/      the skeleton: shell, game contract, registries, saved data, look
  tools/     the modules: Today, Pulls, Roster, Backlog, … (work for any game)
  games/     one folder per game: its contract, data and rules (+ _template/)
supabase/    database migrations and server functions
scripts/     data imports, app icons, roadmap
tests/       architecture, server and browser tests
docs/        plan, roadmap, progress, design files, workstream briefs
```

## Run it locally

Needs Node 22 or newer.

```bash
npm install
npm run dev        # the app on your machine; works in "this device only" mode without sign-in
npm run check      # lint + typecheck + unit tests + build (what CI runs)
npm run e2e        # browser tests at PC and phone sizes (Playwright)
npm run build      # production build into dist/
npm run preview    # serve that build locally
```

For sign-in and sync, copy `config/.env.example` to `config/.env.local` and fill in your own
Supabase project URL and publishable key ([SETUP](docs/SETUP.md)).

Data scripts (re-run when a game updates): `npm run data:nanoka`, `data:kits`,
`data:hsr-kits`, `data:costs`, `data:builds`, `data:schedule`. `npm run roadmap` refreshes the
self-ticking [ROADMAP](docs/ROADMAP.md).

**Add a game:** copy `src/games/_template/`, fill in the contract (names, currencies,
servers, reset times, banner rules) and register it in `src/games/index.ts`. Every screen
picks it up.

## Sources

Game data and Intel (leaks) are gathered from community data sites such as
[nanoka.cc](https://nanoka.cc), plus official game sites and announcements. A fan project,
not affiliated with HoYoverse; game names and art belong to their owners.

## Docs

Every document is listed in **[docs/README.md](docs/README.md)**.

## License

© 2026 HymnToHimeros. All rights reserved. See [LICENSE](LICENSE).
The source is visible here but it is **not open source**: copying, hosting or reusing it
needs written permission. Takedown templates are in [docs/COPYRIGHT.md](docs/COPYRIGHT.md).
Contact: [hlidskjalf.contact@gmail.com](mailto:hlidskjalf.contact@gmail.com).
