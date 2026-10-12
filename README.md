<div align="center">

<img src="public/icons/hagalaz.svg" alt="The HLIÐSKJÁLF mark: the hail rune Hagalaz inside a ringed dial" width="96">

# HLIÐSKJÁLF

**One seat, every world.**

*In the old Norse stories, Hliðskjálf is Odin's high seat. From it he could look out over all
nine worlds at once.* PROJECT-HLITH is that seat for your gacha games: one place that sees
every banner, event, reset, saved pull and character you own, and tells you what to do next.

[**Open the app →**](https://project-hlith.hliskjlf.workers.dev)

[Privacy](https://project-hlith.hliskjlf.workers.dev/privacy) · [Terms](https://project-hlith.hliskjlf.workers.dev/terms) · [License](LICENSE) · [Docs](docs/README.md) · Contact: hlidskjalf.contact@gmail.com

![React 19](https://img.shields.io/badge/React_19-20232a?logo=react&logoColor=61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript_strict-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646cff?logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-1c1c1c?logo=supabase&logoColor=3ecf8e)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-f38020?logo=cloudflare&logoColor=white)
![Tested with Vitest and Playwright](https://img.shields.io/badge/tested-Vitest_·_Playwright-6e9f18)

**Honkai: Star Rail · Zenless Zone Zero** · more games on the way

<img src="docs/screenshots/tour.webp" alt="A short tour: Today, the Pulls planner, recommended teams, the Banners board and the Assistant" width="880">

</div>

---

### Contents

[What it is](#what-it-is) · [Feature tour](#feature-tour) · [How it keeps itself current](#how-it-keeps-itself-current) · [Theorycraft](#theorycraft-for-zzz-and-hsr) · [Themes, frames and badges](#themes-frames-and-badges) · [Three promises](#three-promises) · [Ambitions](#ambitions-and-roadmap) · [How it's built](#how-its-built) · [Run it locally](#run-it-locally) · [Credits](#credits-and-contact)

## What it is

Gacha games spread what you need to know across a dozen places: the in-game mail, a wiki, a
spreadsheet, a leak channel, a calculator site, your own memory of what's still unfinished.
**HLIÐSKJÁLF pulls all of it into one seat.** Open it and it tells you:

- **what to do tonight**, in order, on your own server's reset;
- **how many pulls you'll have** when the banner you want arrives, and your chance to win it;
- **who fits your teams**, with a score that explains itself;
- **what's still left to earn** in events and permanent content.

It works on your phone and your PC, installs like an app, and opens offline with what's saved.
It never guesses: anything it can't back up says **No data yet** and tells you how to fill it in.

It is built and run by **Himeros** ([HymnToHimeros](https://github.com/HymnToHimeros)), and it
is meant to grow into the one hub you keep open for every game you play.

## Feature tour

> The pictures below are the real app. Anything marked **EXAMPLE** is the built-in example
> data you see before adding your own.

### Today: your evening, planned

Daily and weekly resets on your server's clock, live stamina from HoYoLAB, open tasks for
every game, banners about to end, and **tonight's run**: the order to do things in.

<img src="docs/screenshots/today.webp" alt="Today: reset timers for both games, open tasks and live banners" width="100%">

### Pulls: four tabs, one honest number

| | |
|:---:|:---:|
| <img src="docs/screenshots/pulls-planner.webp" alt="Pulls planner: banners now, next and later with the pulls you'll have by each one"> | <img src="docs/screenshots/pulls-calculator.webp" alt="Calculator: every income source counted up to the end of the version"> |
| **Planner:** pulls by each banner, chance to win, worst case | **Calculator:** every source counted until the version ends |
| <img src="docs/screenshots/pulls-bank-log.webp" alt="Bank log: what you earned, bought and spent"> | <img src="docs/screenshots/pulls-history.webp" alt="History: pity, 50/50 state and a luck report from your pull history"> |
| **Bank log:** what you earned, bought and spent | **History:** from the in-game link or UIGF / SRGF files, with a Luck report |

### Roster, Teams and kit check

Your characters, copies and saved builds. **Recommended teams** for every damage dealer, each
with a synergy % and the reason behind it. **Kit check** shows what every skill actually does,
with the game's own text as proof.

| | |
|:---:|:---:|
| <img src="docs/screenshots/teams.webp" alt="Recommended teams with synergy percentages and the reasons behind them"> | <img src="docs/screenshots/kit-check.webp" alt="Kit check: every skill of a team member with the effect it adds"> |
| **Teams:** who fits, who you own, what to pull | **Kit check:** each skill and the effect it adds |

### Banners, Calendar and Events

| | |
|:---:|:---:|
| <img src="docs/screenshots/banners.webp" alt="Banners board: one timeline for every game, live and upcoming banners as big cards"> | <img src="docs/screenshots/calendar.webp" alt="Calendar: banners, events and resets on one timeline"> |
| **Banners:** one timeline for every game; leaks clearly marked | **Calendar:** everything on one timeline, with a calendar feed |
| <img src="docs/screenshots/events.webp" alt="Events: what's left to claim in each event"> | <img src="docs/screenshots/intel.webp" alt="Intel: upcoming characters and content, each marked unverified until confirmed"> |
| **Events:** what's left in each one, and what it's worth | **Intel:** what's coming, marked unverified until the game confirms it |

### Backlog: rewards you haven't picked up yet

Permanent content that still pays out (story, exploration, achievements), counted toward
your pulls. Add your own items and **import or export** your backlog as a file.

<img src="docs/screenshots/backlog.webp" alt="Backlog: the story as a checklist, rewards still on the table" width="100%">

<details>
<summary><b>Backlog file format</b> (<code>hlith-backlog-export</code>, version 1)</summary>

Every row becomes one of your own items, with its progress. Importing the same file again
never adds duplicates and never lowers progress. The app has a "File format" card and a
template to download.

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

</details>

### The Assistant: ask, then approve

Ask in plain words: "plan my session tonight", "how much can I still earn this patch?". It
reads your screens and **proposes** changes: a bank log entry, a plan, a new backlog item.
Nothing changes until you press **Approve**, and every change can be undone. You can attach
files (.json, .md, .txt, .csv, .pdf); an attached pull export or backlog file can be imported
straight from the chat.

<img src="docs/screenshots/assistant.webp" alt="The Assistant panel: an example chat with a proposal to approve or dismiss" width="100%">

### On your phone

Every screen is built for both. Install it from the browser and it opens like an app.

<p align="center">
  <img src="docs/screenshots/phone-today.webp" alt="Today on a phone" width="23%">
  <img src="docs/screenshots/phone-planner.webp" alt="Pulls planner on a phone" width="23%">
  <img src="docs/screenshots/phone-teams.webp" alt="Recommended teams on a phone" width="23%">
  <img src="docs/screenshots/phone-banners.webp" alt="Banners on a phone" width="23%">
</p>

## How it keeps itself current

Game data goes stale every patch, and leaks come out in many places at once. HLIÐSKJÁLF keeps
up on its own, but **a person always has the last word**.

```mermaid
flowchart LR
  subgraph auto[Automatic, every 2 hours]
    rhythm[Patch rhythm<br>is a check due?] --> imports[Re-import game data<br>characters, kits, costs, schedule]
    imports --> checks[Full test run]
    checks --> merge[Data-only update<br>goes live]
  end
  subgraph leaks[Leak finder]
    sites[Community data sites<br>e.g. nanoka.cc] --> routine
    channels[Community leak channels<br>e.g. Seele on Telegram] --> translate[Mandarin posts<br>translated to English] --> routine[Research routine<br>new characters, banners, events]
  end
  routine --> inbox[(Findings inbox)]
  checks -. anything odd .-> inbox
  inbox --> human{{Himeros verifies<br>each finding}}
  human -->|approve| app([Shows in the app<br>marked unverified until confirmed])
  human -->|dismiss| gone([Never shown])
```

- **Automatic data refresh.** Every two hours a GitHub Action asks whether a check is due,
  counted from each game's patch day. When one is, it re-imports the lists (characters, kits,
  materials, the banner and event schedule), runs the full test suite and publishes a
  data-only update. Your own progress is never touched by it.
- **The leak finder.** A research routine reads community data sites and community leak
  channels, recognises which game a post is about, translates Mandarin posts to English, and
  skips anything the app already shows.
- **A human in the loop.** Every find lands in an inbox. **Himeros reads and verifies each one**
  before it can appear. Leaks stay clearly marked as unverified until the game confirms them,
  and you can hide them entirely.

## Theorycraft for ZZZ and HSR

Team scores in HLIÐSKJÁLF aren't tier-list opinions. Each recommended team is worked out from
the characters' kits:

- **Kit value.** Every skill, talent and passive is read from the game text and turned into
  what it adds (damage, buffs, debuffs, energy, shields), at the level you actually have.
- **Synergy %.** How much of the damage dealer's kit value a team unlocks when fully built,
  compared with their best possible partners. "87% · Excellent" comes with the sentence that
  explains it, and the source it was worked out from.
- **Kit check.** Open any team to see every skill of every member, the effect it adds, and the
  game's own wording as proof.
- **Your builds count.** Saved builds, copies and signature gear change the numbers; without a
  saved build it can assume an average one, and it tells you when it does.

The methods are written down openly in [`docs/logic/`](docs/logic): the
[ZZZ kit check method](docs/logic/zzz-method.md), [HSR theory](docs/logic/hsr-theory.md) and the
[build score](docs/logic/build-score.md).

> [!NOTE]
> **This is theory, and it is far from perfect.** Himeros works on it daily to improve and
> tighten the logic behind the core, but it's a long, hard job. Treat a score as a well-argued
> suggestion, not a verdict, and if a team plays better than its number says, trust your hands.

## Themes, frames and badges

Make it yours: many themes, each with its own art and motion, your own background, and a
layout you can rearrange.

<p align="center">
  <img src="docs/screenshots/theme-midnight-sakura.png" alt="Midnight Sakura theme" width="32%">
  <img src="docs/screenshots/theme-jade-whisper.png" alt="Jade Whisper theme" width="32%">
  <img src="docs/screenshots/theme-crimson-haze.png" alt="Crimson Haze theme" width="32%">
</p>

Your **profile card** carries a picture, a banner, a showcase, badges and earned titles.
**Rewards** are exclusive badges, frames and name styles, given out or claimed with a code.

### The owner's looks

> [!IMPORTANT]
> **Not publicly available yet.** These are Himeros's own looks, drawn for the app. Some cool
> public ones are planned.

Forty full looks across eight Norse sets, each with its own scene, card frames, sidebar art,
headings and motion:

<p align="center">
  <img src="docs/screenshots/owner-looks.webp" alt="Four of the owner looks in motion" width="880">
</p>

Animated badges, picture frames and name styles:

<p align="center">
  <img src="docs/screenshots/owner-badges.webp" alt="Nine animated owner badges" width="880"><br>
  <img src="docs/screenshots/owner-frames.webp" alt="Twelve animated picture frames" width="880"><br>
  <img src="docs/screenshots/owner-names.webp" alt="Animated name styles" width="880">
</p>

## Three promises

1. **Honest numbers.** It never shows a number it can't back up. If it doesn't know, it says
   **No data yet** and tells you how to fill it in.
2. **Your data is never wiped.** Updates to the built-in lists never touch your progress. Sync
   keeps the newer copy and stores the other one. Backups run nightly; you can download all
   your data or delete your account at any time.
3. **Every game is a plug-in.** Adding a game means adding one folder. A test fails the build
   if the app ever reaches into a game's folder.

## Ambitions and roadmap

HLIÐSKJÁLF is meant to be the seat you sit in for **every** game you play, not just two.

- **More games.** Wuthering Waves next, then Genshin Impact, then Arknights: Endfield. Each
  arrives as its own plug-in with its banners, currencies, resets and kits
  ([what it would take](docs/research/2026-10-11-new-games.md)).
- **Sharper theorycraft.** Deeper kit reading, more team shapes, and scores that learn from
  how teams actually perform.
- **Community.** Share teams and profiles, a community space, and public looks, badges and
  frames for everyone.
- **Less work for you.** More of your account read in automatically, and an Assistant that
  plans further ahead.

The live checklist ticks itself: [ROADMAP](docs/ROADMAP.md).

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
  refresh[Data refresh<br>every 2 h] -->|data-only updates| app
  routine[Research routine] -->|findings to verify| supa
```

- **The app:** React 19 + TypeScript (strict) + Vite, served by Cloudflare Workers as an
  installable app with an offline shell. Every merge to `main` goes live within minutes.
- **Supabase** holds accounts and data (each person sees only their own rows) and runs the
  server functions: HoYoLAB, history import, backups, rewards, the Assistant.
- **The scheduler** wakes every 15 minutes for the nightly backup, the HoYoLAB check-in and
  code redemption.
- **Five workstreams** build it (FRAME, SCHEDULER, LOGIC-CORE, MANAGER, ERROR-FIX), each with its
  own files and brief; see [WORKSTREAMS](docs/WORKSTREAMS.md) and [RELEASES](docs/RELEASES.md).

```
src/          the app: index.html, main.tsx and
  core/         the skeleton: shell, game contract, registries, saved data, look
  tools/        the modules: Today, Pulls, Roster, Backlog, … (work for any game)
  games/        one folder per game: its contract, data and rules (+ _template/)
public/       icons and the app manifest
config/       tool settings: Vite, TypeScript, ESLint, Playwright, legal pages
supabase/     database migrations and server functions
scripts/      data imports, leak finder, app icons, roadmap
tests/        architecture, server and browser tests
docs/         plan, roadmap, progress, design files, logic, workstream briefs
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

Data scripts (re-run when a game updates): `npm run data:nanoka`, `data:kits`, `data:hsr-kits`,
`data:costs`, `data:builds`, `data:schedule`; the leak finder is `npm run leaks:seele`.
`npm run roadmap` refreshes the self-ticking [ROADMAP](docs/ROADMAP.md).

**Add a game:** copy `src/games/_template/`, fill in the contract (names, currencies, servers,
reset times, banner rules) and register it in `src/games/index.ts`. Every screen picks it up.

## Credits and contact

- Made by **Himeros** ([HymnToHimeros](https://github.com/HymnToHimeros)).
- Game data and Intel (leaks) are gathered from community data sites such as
  [nanoka.cc](https://nanoka.cc) and community leak channels, plus official game sites and
  announcements. Thank you to everyone who documents these games.
- A fan project, **not affiliated with HoYoverse**. Game names and art belong to their owners.
- Contact: **hlidskjalf.contact@gmail.com**

Every document is listed in **[docs/README.md](docs/README.md)**.

## License

© 2026 HymnToHimeros. All rights reserved. See [LICENSE](LICENSE).
The source is visible here but it is **not open source**: copying, hosting or reusing it needs
written permission. Takedown templates are in [docs/COPYRIGHT.md](docs/COPYRIGHT.md).
