# PROJECT-HLITH · DESIGN.md

HLIÐSKJÁLF, Odin's high seat. A personal hub for gacha games on phone and PC. Mood: a glacier over a volcano: calm surfaces, intense data underneath.

Name rule: always PROJECT-HLITH, HLITH, HLIÐSKJÁLF (with Ð and Á). Never "Hlith", "Hlidskjalf" or "Project-Hlith". This includes code, commits and docs.

Files (in `docs/design/`): `HLITH System Diagram.dc.html` (layers) · `HLITH Tokens.dc.html` (tokens + Layer 4) · `HLITH App.dc.html` (working shell, Today, Roster, character page, Calendar) · `HLITH Theme Swap.dc.html` (one record, three screens) · `FEATURES.md` (feature map, must all ship).

---

## 1. The four layers

```
┌ L1 SHELL ─────────── same for every game · cannot move or hide ┐
│  game switcher (All / games / +) · sync status · Assistant · Account │
│  PC: left sidebar 248px      Phone: top bar + bottom bar + More sheet │
│  ┌ L2 MODULE SLOT ─────────── per game list, order, hidden set ┐ │
│  │  Today · Events · Calendar · Backlog · Pulls · Banners ·     │ │
│  │  Roster (Characters | Teams) · Farm · Intel · game-only…     │ │
│  │  ┌ L4 COMPONENTS ── shared parts, no game logic ┐           │ │
│  │  └───────────────────────────────────────────────┘           │ │
│  └──────────────────────────────────────────────────────────────┘ │
└── L3 GAME RECORD tints everything through its vent ──────────────┘
```

### Layer 1 · Shell
- Never moves, never hides, never changes between games.
- Holds: game switcher, sync status, **Assistant** (opens over any screen; PC side panel 420px, phone sheet; ⌘K / Ctrl+K), **Account** (sync, backup, notifications, game settings, guide, layout settings, theme, owner console if owner).
- Knows nothing about servers, resets or currencies; those come from the game record.

### Layer 2 · Modules
Catalog: `today, pulls, calendar, roster, banners, events, farm, backlog, intel`. **Every current game has every module.** Game exclusives are features inside a module, not separate modules: ZZZ Coffee at Coff Cafe and HSR Dispatch Assignments are dailies in Today; ZZZ Kit check is a card on the ZZZ character page; Teams is a tab in Roster.

Layout state per scope (`hsr`, `zzz`, …, `all`): `order[]`, `hidden[]`. Stored per user.

Flexibility rules:
1. **Edit layout**: PC "Edit layout" button in the sidebar opens the list with ⋮⋮ drag handles. Phone: long-press a bottom-bar tab (500 ms) or "Edit layout" in More. "Reset to default" restores the record's default order and unhides all.
2. **Per game**: each game record lists its modules and default order. The sidebar shows only that game's visible modules.
3. **Hidden vs not available**:
   - Hidden = the game has it, you turned it off. Dashed outline, "Restore" button. Section "HIDDEN · STILL IN THIS GAME".
   - Not available = the game record lacks it (only for a future game that can't support a module yet). Hatched, dimmed, "Not available for this game yet", no action. Section "NOT IN THIS GAME".
   - At least one module must stay visible.
4. **Phone bar**: first 4 visible modules in order + "More". A dashed "PHONE BAR ↑ · MORE ↓" line in Edit layout shows the cut.
5. **All games**: shows every module in its own order. Every game-specific row, tile and item carries a game tag (HSR / ZZZ in that game's vent). Tags only appear in All games.
6. **New game**: add a record; its modules appear. No shell change.

### Layer 3 · Game record
```
{
  id, short, name, vent, icon,
  currencies: [{name, perPull}], stamina: {name, max, minutesPerPoint},
  rarity labels (5★/4★ or S/A), dupe prefix + name (E Eidolon / M Mindscape),
  gear name, weapon name, skill name, elements,
  servers: [{id, label, utcOffset}], reset: {hour, weekday},
  modules: [...], defaultOrder: [...]
}
```
- Server and reset rule belong to the record, never the shell. Users pick a server per game (Today → Server chip, or Account → Game settings). The picker shows each option's reset in the user's local time.
- All times shown in the user's local time, with locale dates and numbers.

### Layer 4 · Shared components
Stat tile · progress bar · currency chip · game tag · unverified tag · character tile (rarity, element, role, owned/not, dupes) · banner card · event row · timer · calendar bar (confirmed / leak / plan) · empty state · bottom sheet · drag handle row (normal, dragging, hidden, not available) · segmented control.

---

## 2. Honest data
- A value the app can't prove is never shown. No zeros or estimates as stand-ins.
- Missing number: em dash `—` in `#3A4652` + "No data yet" in glacier `#7FB4D6` + how to fix it ("Connect account", "Import").
- Empty module: dashed card, `NO DATA YET` label, one sentence, one action.
- Leaks and datamines: dashed outline and hatch, `? UNVERIFIED` tag in ember.soft, source always shown. They live in Banners, Calendar and Intel.
- Percentages only when the data behind them is complete.

---

## 3. Tokens

### Colour · basalt (surfaces)
| token | hex | use |
|---|---|---|
| bg.void | #050607 | outside app, scrim base |
| bg.app | #08090B | page |
| bg.shell | #0B0D10 | sidebar, bars, edit panel |
| bg.card | #0E1115 | cards, sheets |
| bg.inset | #12161B | tracks, segmented control |
| bg.raised | #141920 | chips, rows in sheets |
| line.subtle | #161B21 | row dividers |
| line.default | #1E242C | card borders |
| line.mid | #232A33 | raised borders |
| line.strong | #2A333D | outlines |
| line.empty | #3A4652 | dashed/no-data, empty dash |

### Colour · glacier (text + structure)
| token | hex | use |
|---|---|---|
| ink.1 | #E6EEF3 | primary text, numbers |
| ink.2 | #CFE3EF | assistant text, All-games vent |
| ink.3 | #A9BBC8 | secondary, labels |
| ink.4 | #6F8494 | meta, captions |
| ink.5 | #56677A | section labels only |
| glacier | #7FB4D6 | links, info, "no data yet", drag handle |
| ok | #6FD3A8 | synced, complete |

### Colour · ember (heat, rare)
| token | hex | use |
|---|---|---|
| ember | #FF6A1F | Assistant only (one fill per screen) |
| ember.soft | #FF8A4C | urgent (< 72 h, stamina near full), unverified |

### Colour · vents
| token | hex |
|---|---|
| vent.all | #CFE3EF |
| vent.hsr | #A99BFF |
| vent.zzz | #D4F23A |

Vent fills: active nav marker, game tag, progress fill, primary button, header wash (10% → 3%). Text on vent is always #08090B. Never body text. A new vent must reach 7:1 with #08090B and not be orange or red.

Rarity: top (5★ / S) #E8B85C · mid (4★ / A) #7FB4D6.
Elements: Fire #E8664A · Ice #8FD3F0 · Lightning/Electric #B98AF0 · Wind #6FD3A8 · Quantum #7C7CF0 · Imaginary #E8D35C · Physical #C9CFD6 · Ether #E07AD0.

### Type
- Words: **Archivo** (variable width). Numbers, timers, labels: **JetBrains Mono** (tabular).

| role | spec |
|---|---|
| display | Archivo 800 · width 118% · 64/0.95 |
| title | Archivo 800 · 110% · 30 PC / 24 phone |
| card title | Archivo 700 · 17 |
| body / row | Archivo 400–600 · 14–15 / 1.45 |
| caption | Archivo 400 · 12–13 |
| number.xl / l / m / s | Mono 600 · 56 / 28 / 14 / 12 |
| label | Mono 600 · 10–11 · caps · +0.12em |

### Space, shape, size
- Spacing (4 base): 4 · 8 · 12 · 16 · 20 · 24 · 28.
- Radius: tag 4 · segment 7 · button/row 9–10 · card 12 · hero/empty 14 · sheet 20 top · chip pill.
- Tap target min 44 · phone tab 58 · PC nav row 42.
- Sidebar 248 · content max 1240 · phone/PC switch at 820 px · Assistant panel 420.
- Page padding: PC 24/28 · phone 16. Scrim #050607 at 55–62%.

---

## 4. Screens built
- **Shell** PC + phone, Edit layout (drag, hide, restore, reset, not-available), More sheet, Account sheet, server picker, Add game sheet, Assistant.
- **Today**: resets per game, pulls available, stamina (or no data), server chip, currencies, open tasks, live banners, coming up.
- **Calendar**: timeline (1 week back, 5 ahead, today line), lanes Banners / Events / Endgame / Your plans, date ranges on every bar, leaks dashed + unverified, list below. Phone scrolls sideways.
- **Roster**: Characters grid with filters + Teams tab. **Character page**: rarity/element/role, level, dupes, build score (or no build data), if you pull, team fit, materials.
- **Pulls**: Planner (per banner: have now, by end, worst case, verdict; chance locked until history), Calculator (budget to version end by source, paid extras + Backlog toggles, rows with no data left out), Bank log, History (import: link, file, HoYoLAB), Luck report (locked until history).
- **Theme swap**: HSR / ZZZ / ALL on Today, Pulls, Character page, PC website.
- **Product**: a website, PC first, also usable on a phone browser.

- **Banners**: live + upcoming cards, leak toggle, owned/dupes, team fit from presets (else no data yet), Plan pulls.
- **Events**: open / done / skipped per event, login days claimed, rewards left feed the Pulls budget.
- **Farm**: pick characters → materials (have/need, runs, stamina), stamina total, days to finish, gear to farm.
- **Backlog**: done/total per category, rewards left, per-category switch; total feeds Pulls → Calculator.
- **Intel**: new content by type, always unverified, source + reliability.
- **Owner console** (Account → Owner console): game records, built-in lists, leak sources on/off, announcements, user stats (no data yet until backend).
- **Login**: Google, Discord, email link (Account → Sign out to see it).

### Themes (Account → Theme)
A theme is a full set of colour tokens plus its own background art. Picked in Account → Theme (a card per theme with a live preview), applied at once as `<html data-theme data-tone>`, saved in settings (synced). Unknown saved values show Glacier.

| id | Name | Mood | Main colours |
|---|---|---|---|
| `dark` (default) | Glacier | Ice over dark stone; rings, the nine worlds, ravens | #08090B · #0E1115 · #E6EEF3 · #7FB4D6 |
| `candlelight` | Candlelight | Candle glow over near-black; wings, halo, rays (owner's palette A) | #110706 · #1C0D0A · #F4D59F · #B78861 · #B2493E |
| `crimson` | Crimson Rose | Dark roses, crown of thorns, sigil (owner's palette B) | #130F0D · #1D1413 · #C4C1B8 · #551F22 · #E0959A |
| `bifrost` | Bifröst | Starry night, aurora, astrolabe rings, ravens | #060A16 · #0C1428 · #EAF0FF · #8FB8FF · #6B5BD6 |
| `noctune-bloom` | Noctune Bloom | Mystical, deep, feminine; crescent moon, night flowers, drifting petals | #110A19 · #1A1026 · #EDE6EE · #B79AB4 · #7E496B |
| `astral-lagoon` | Astral Lagoon | Calm, oceanic, dreamy; moon over still water, its reflection, ripples, waves | #061A22 · #0D2B36 · #A6D6C9 · #4CA7A1 · #E6D6EA |
| `crimson-haze` | Crimson Haze | Bold, rare, intense; an eclipse with a corona, red smoke wisps | #18050D · #2B0A12 · #E7D7D9 · #C77D8B · #9E3F57 |
| `jade-whisper` | Jade Whisper | Fresh, calm, refined; a carved jade disc, bamboo, bands of mist | #0F1C18 · #1B2E28 · #ECF3E9 · #B6D8C7 · #71A897 |
| `velvet-twilight` | Velvet Twilight | Luxurious, moody, royal; velvet drapes and tassels, crescent moon, crown | #110C22 · #1A1331 · #D8C8E6 · #9A78A6 · #6B3F7C |
| `midnight-sakura` | Midnight Sakura | Mysterious, soft, enchanting; full moon, blossoming branches, falling petals | #0B0E1A · #141424 · #F3E6EC · #B47A9A · #5E3A5C |
| `ascendant` | Ascendant (light) | Marble and gold; wings, halo, light rays through clouds | #EFEBE3 · #FBF9F5 · #17130D · #75560F |
| `ethereal-dune` | Ethereal Dune (light) | Soft, earthy, elegant; low sun, wind-drawn dunes and ripples | #F4EFE6 · #FCF9F4 · #1C1D16 · #6B705C · #85493A |
| `amber-mirage` | Amber Mirage (light) | Warm, exotic, timeless; sun in an eight-point star, heat shimmer, an arch | #FBF0DE · #FFF6E6 · #1F130A · #A35C1E · #D99A4E |
| `light` | Light | Cool paper, dark ink, faint rings | #F3F6F8 · #FFFFFF · #0B1117 · #1D5F8C |

Rules: every theme defines every colour token tokens.css defines (tests/themes.test.ts); text colours reach 4.5:1 on every surface (ink.5 on bg.app, bg.card, bg.shell: Override 4); game vents stay readable on every dark theme; light themes (`data-tone='light'`) show game names in ink. Background art (`src/core/theme/ThemeArt.tsx`) is drawn in code (no image files), fixed behind the page right of the sidebar, at `--art-opacity`; the test checks text still reaches 4.5:1 where the art is strongest. Cards keep solid backgrounds. Motion is very slow and stops with reduced motion. The sidebar's empty space shows the theme's emblem; the account row is a profile card (banner fading into the sidebar, picture, name).

## 5. Product rules
- Multi-user, worldwide. Each user's data is separate. Community features (public plans, shared teams) possible later.
- Proper login (email, Google, Discord).
- Owner console: owner-only. Manages game records, built-in lists, leak sources, announcements. Never touches user progress.
- User data is never wiped by list updates.
- English only for now; leave room for longer labels.
