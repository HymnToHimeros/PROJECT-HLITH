# PROJECT-HLITH · PLAN.md

The build plan for HLIÐSKJÁLF V2. It sits on top of `FEATURES.md` (what must
ship) and `DESIGN.md` (how it looks). Where they disagree, the OVERRIDES in
`CLAUDE.md` win; this plan already follows them.

Status: **answers to §9 received 2026-10-09; waiting for go on step 1.** No app code exists yet.

**The shape in one line:** `core/` is the skeleton, `tools/` are the shelves and
nerves (modules that work for any game), `games/` is the flesh. A new game,
including one nobody has listed yet, is a new folder in `games/` and nothing else.
See §2b.

---

## 0. Decisions in one screen

| Topic | Choice | Why |
|---|---|---|
| Language | TypeScript, strict mode | Required by CLAUDE.md |
| Framework | **React 19 + Vite**, React Router | The design files (`*.dc.html`) already run on React, so screens port across almost 1:1. One framework only. |
| Styling | CSS variables from `DESIGN.md` tokens + CSS Modules | No second UI framework. Tokens live in one file. |
| Tests | Vitest (logic), Testing Library (components), Playwright (a few end-to-end smoke tests) | Fast, all TypeScript |
| Database + login + server code | **Supabase** (Postgres, Auth, Edge Functions, Cron) | One service covers email link, Google and Discord login, per-user data walls (row-level security), scheduled jobs and the small server functions HoYoLAB / pull import / Assistant need |
| Hosting | **Cloudflare Pages** (static site) | Free, unlimited traffic, 500 builds a month is plenty with "few pushes" |
| Email (sign-in links only) | **Resend** | Supabase's built-in mailer is for testing only (a handful of emails an hour) |
| Evening message | **Phone notification** (web push) | Free, built into browsers |
| Assistant | Claude API with **each user's own key** (Account → Assistant). Stored encrypted, used only by a server function | Users pay for their own use; HLITH has no AI bill. Every reply shows its cost |

Costs are in section 7.

---

## 1. Folder map

```
PROJECT-HLITH/
├─ CLAUDE.md · README.md
├─ docs/
│  ├─ PLAN.md · PROGRESS.md · FEATURES.md · DESIGN.md
│  └─ HLITH *.dc.html · support.js        design files (reference only, not shipped)
│
├─ src/
│  ├─ main.tsx                 COMPOSITION ROOT. The only file that imports games/
│  │                           and hands them to the registry. Nothing else does.
│  │
│  ├─ core/                    the shell + the rules every game obeys. No game names.
│  │  ├─ contract/             GameContract types (section 2). Types only, no data.
│  │  ├─ registry/             games.ts · modules.ts · features.ts · layout.ts (section 3)
│  │  ├─ shell/                Sidebar, phone top/bottom bar, More sheet, game switcher,
│  │  │                        sync status, Account sheet, Edit layout, Assistant host
│  │  ├─ ui/                   Layer 4 components: StatTile, ProgressBar, CurrencyChip,
│  │  │                        GameTag, UnverifiedTag, CharacterTile, BannerCard,
│  │  │                        EventRow, Timer, CalendarBar, EmptyState, NoData,
│  │  │                        BottomSheet, DragHandleRow, Segmented
│  │  ├─ theme/                tokens.css (DESIGN.md §3), vent handling
│  │  ├─ data/                 Known<T> / "no data yet" type, store, sync queue,
│  │  │                        repositories (one per table), local cache
│  │  ├─ auth/                 sign-in screens, session, owner check
│  │  └─ time/                 server resets, next-reset maths, local time, locale formats
│  │
│  ├─ tools/                   generic features. Read the contract, never a game name.
│  │  ├─ today/  events/  calendar/  backlog/  pulls/  banners/  roster/  farm/  intel/
│  │  │                        one folder per module: screen + its tabs + its features
│  │  ├─ budget/               the one pull-budget engine (section 4). Pure functions.
│  │  ├─ pity/                 pity + 50/50 from history, odds, worst case. Pure.
│  │  ├─ import/               UIGF / SRGF parsers, in-game history link reader
│  │  ├─ account-links/        generic "linked game account" client; HoYoLAB is
│  │  │                        the first provider, others plug in by name
│  │  ├─ scan/                 screenshot scan of a character screen
│  │  ├─ assistant/            chat UI, proposals, approve / undo
│  │  ├─ feeds/                calendar feed (.ics) + evening message builders (shared
│  │  │                        by the app and the server functions)
│  │  ├─ edit-mode/            add / change / hide my own events, banners, backlog items
│  │  ├─ share/                share-a-team links
│  │  ├─ account/              setup checklist, Guide, export my data, delete account
│  │  └─ owner/                owner console
│  │
│  └─ games/
│     ├─ _template/            copy this to add a game
│     │  ├─ contract.ts        the ONE contract file
│     │  ├─ data/              built-in lists as JSON (characters, banners, income…)
│     │  ├─ rules.ts           game maths: pity numbers, history parsing hints, kit text
│     │  └─ README.md          how to fill it in
│     ├─ hsr/                  Honkai: Star Rail (same three parts)
│     ├─ zzz/                  Zenless Zone Zero (same three parts)
│     └─ index.ts              export const games = [hsr, zzz]
│
├─ supabase/
│  ├─ migrations/              SQL, add-only (never drops a user column or row)
│  └─ functions/               server functions (Deno, TypeScript):
│     hoyolab · gacha-import · assistant · ics-feed · evening-message ·
│     export-data · delete-account · scan
│
├─ tests/
│  ├─ architecture.test.ts     FAILS THE BUILD if core/ or tools/ import from games/
│  ├─ fixtures/fake-game/      made-up non-HoYoverse game; proves new games need no core change
│  └─ e2e/                     Playwright smoke tests
└─ package.json · tsconfig.json · vite.config.ts · eslint.config.js
```

**Import rule, enforced twice:**
1. `tests/architecture.test.ts` walks every file under `src/core` and `src/tools`,
   reads its imports with the TypeScript compiler, and fails if any resolves into
   `src/games`. Also fails if `src/core` imports `src/tools` (core is the lowest layer).
2. An ESLint `no-restricted-imports` rule gives the same error in the editor.

Allowed direction: `games → core`, `tools → core`, `main.tsx → everything`.

---

## 2. The game contract

> The code is now the source of truth: `src/core/contract/game-contract.ts`
> (types) and `src/core/contract/entities.ts` (list items). This section is the
> outline it was built from.

One file per game: `src/games/<id>/contract.ts`, typed against
`src/core/contract/game-contract.ts`. A game is data plus a few pure functions,
never screens. Every module reads only this.

```ts
// src/core/contract/game-contract.ts  (types only)

export type ModuleId =
  | 'today' | 'events' | 'calendar' | 'backlog' | 'pulls'
  | 'banners' | 'roster' | 'farm' | 'intel';

export type GameId = string;          // 'hsr', 'zzz', …
export type ISODate = string;         // '2026-10-09T04:00:00Z'

/** Honest data: a value is either proven or missing, never guessed. */
export type Known<T> =
  | { known: true; value: T; source: DataSource; at: ISODate }
  | { known: false; fix?: FixAction };            // UI shows "—  No data yet · <fix>"

export type DataSource = 'official' | 'hoyolab' | 'import' | 'scan' | 'user' | 'assistant' | 'leak';
export type FixAction = 'connect-account' | 'import-history' | 'import-build'
                      | 'enter-manually' | 'scan-screenshot';

export interface GameContract {
  // ── Identity (Layer 3) ───────────────────────────────────────────
  id: GameId;
  short: string;                       // 'HSR'
  name: string;                        // 'Honkai: Star Rail'
  vent: `#${string}`;                  // must pass 7:1 with #08090B (checked by a test)
  icon: string;                        // path to icon asset

  // ── Words the shell and modules use instead of game names ────────
  terms: {
    rarity: { top: string; mid: string };          // '5★' / '4★' or 'S' / 'A'
    gear: string;                                  // 'Relics' / 'Drive Discs'
    weapon: string;                                // 'Light Cone' / 'W-Engine'
    skill: string;                                 // 'Traces' / 'Skills'
    endgame: string[];                             // ['Memory of Chaos', 'Pure Fiction', …]
  };
  elements: { id: string; label: string; color: `#${string}` }[];
  roles: { id: string; label: string }[];

  // ── Economy ──────────────────────────────────────────────────────
  currencies: Currency[];
  stamina: StaminaPool[];              // zero, one or several pools
  dupes?: { prefix: string; name: string; max: number };   // absent = game has no dupe system

  // ── Servers and resets (never in the shell) ──────────────────────
  servers: { id: string; label: string; utcOffset: number }[];   // one server = one entry
  reset: { hour: number; weekday: number };        // daily hour + weekly reset day, server time

  // ── Modules ──────────────────────────────────────────────────────
  modules: ModuleId[];                 // every current game lists all nine (Override 1)
  defaultOrder: ModuleId[];

  // ── Pulls ────────────────────────────────────────────────────────
  bannerTypes: BannerType[];
  income: IncomeRow[];                 // this game's income table (section 4)
  historyImporters: HistoryImporter[];  // [] = no import; History offers manual entry

  // ── Built-in lists (seed data; owner can update them later) ──────
  data: GameDataLoaders;

  // ── Optional per-game abilities. Missing = feature shows "No data yet". ──
  accountLinks?: AccountLink[];        // HSR/ZZZ: [{ provider: 'hoyolab', … }]
  scan?: { screen: 'character'; fields: string[] };   // what a screenshot scan can read
  rules: GameRules;
}

export interface Currency {
  id: string;
  name: string;                        // 'Stellar Jade'
  perPull?: number;                    // 160 for premium currency
  isPullItem?: boolean;                // true for 'Star Rail Pass', 'Encrypted Master Tape'
  forBanner?: BannerType['id'][];      // which banners a pull item works on
  paid?: boolean;                      // Oneiric Shard / Monochrome
}

export interface BannerType {
  id: string;                          // 'character', 'weapon', 'standard', 'bangboo'
  label: string;
  pullItem: Currency['id'];
  /** How this banner's luck works. One of the shared models, or the game's own
   *  (see PityModel in §2b), so games with different rules need no core change. */
  pity: PityModel;
}

export interface IncomeRow {
  id: string;                          // stable: 'hsr.daily-training'
  source: 'daily' | 'weekly' | 'endgame' | 'monthly' | 'events' | 'login' | 'one-time' | 'paid';
  label: string;
  currency: Currency['id'];
  amount: number | null;               // null = unknown → left out, listed as "no data"
  schedule:
    | { kind: 'per-reset' }                                    // every daily reset
    | { kind: 'weekly' }                                       // every weekly reset
    | { kind: 'cycle'; anchor: ISODate; days: number }         // endgame rotations
    | { kind: 'pass'; perDay: number }                         // monthly card, while active
    | { kind: 'from-events' }                                  // amounts come from Events data
    | { kind: 'from-login-events' }
    | { kind: 'once'; at?: ISODate };
  coveredByBacklog?: string;           // backlog category id; if that category is on, skip this row
  paid?: boolean;                      // counted only when "paid extras" is on
}

export interface GameDataLoaders {
  characters: () => Promise<Character[]>;
  banners: () => Promise<Banner[]>;
  events: () => Promise<GameEvent[]>;
  backlog: () => Promise<BacklogItem[]>;
  materials: () => Promise<Material[]>;
  teams: () => Promise<TeamPreset[]>;
  kits?: () => Promise<Kit[]>;         // Override 1: Kit check shows for any game that has this
  versions: () => Promise<Version[]>;  // version start/end → Calculator horizon
}

export interface GameRules {
  /** Materials for one character from level a → b, used by Farm. */
  materialsFor(charId: string, from: BuildLevel, to: BuildLevel): MaterialNeed[];
  /** Turn a parsed history row into the shared pull record. */
  normalisePull(raw: unknown): PullRecord | null;
  /** Optional: score a character's build. Absent → "No build data yet". */
  scoreBuild?(build: CharacterBuild): Known<{ score: number; grade: string }>;
}

export interface StaminaPool { id: string; name: string; max: number; minutesPerPoint: number }

export interface HistoryImporter {
  id: string;                          // 'uigf-v4', 'srgf', 'hsr-link'
  kind: 'file' | 'link';
  label: string;
  /** file: parse in the browser · link: sent to the gacha-import server function */
  parse: (input: string | ArrayBuffer) => Promise<PullRecord[]>;
}

export interface AccountLink {
  provider: string;                    // 'hoyolab' today; other companies' services later
  supports: ('stamina' | 'checkin' | 'roster' | 'endgame')[];
  config: Record<string, string>;      // e.g. { gameBiz: 'hkrpg_global' }
}

// Character, Banner, GameEvent, BacklogItem, Material, TeamPreset, Kit, Version,
// PullRecord, CharacterBuild, BuildLevel, MaterialNeed live in core/contract/entities.ts.
// Every list item has a stable `id` that never changes, so updates never orphan progress.
```

Game-only things are **features inside modules**, declared by data, not by a
game-name check: Coffee at Coff Cafe and Dispatch are dailies in the income /
task data; Kit check appears wherever `data.kits` exists.

---

## 2b. New games, including ones not listed anywhere yet

HSR and ZZZ are the first two games, not the shape of the app. Nothing in
`core/` or `tools/` may assume HoYoverse rules. Where games differ, the contract
offers a **shared option or a slot for the game's own rule**:

| Games differ in | How the contract handles it |
|---|---|
| Luck rules: hard pity + 50/50, rising odds, spark/exchange after N pulls, no pity at all | `PityModel` (below): shared models plus `custom` |
| Number of premium currencies, pull items, stamina pools | Lists, not single fields |
| Dupe systems (Eidolons, Mindscapes, none) | `dupes?` optional; Roster hides the column when absent |
| Pull history (link, file, nothing) | `historyImporters` list; empty → manual entry |
| Account services (HoYoLAB, others, none) | `accountLinks` list with a `provider` name; one server function per provider |
| Servers and resets | Data in the record, never in the shell |
| Rarity words, elements, roles, gear words | Data in `terms`, `elements`, `roles` |

```ts
/** Every banner's luck is a small state machine. The pity engine (tools/pity)
 *  steps through it generically, so chance and worst case work for any game. */
export type PityModel =
  | { kind: 'hard-pity'; hardPity: number; baseRate: number;
      featured?: { winRate: number; guaranteeAfterLoss: boolean };
      softPity?: { from: number; stepPerPull: number; source: 'community' } }
  | { kind: 'spark'; sparkAt: number; baseRate: number }          // pick the unit after N pulls
  | { kind: 'none'; baseRate: number }
  | { kind: 'custom'; step: (state: PityState) => { topRate: number; next: (won: boolean, featured: boolean) => PityState };
      worstCase: (state: PityState) => number };                  // written in games/<id>/rules.ts
```

**Proof it works:** `tests/fixtures/fake-game/` is a made-up game that is
nothing like HoYoverse (spark instead of pity, no dupes, two stamina pools, no
history import, no account link). A test registers it and renders every
module. If adding it ever needs a change in `core/` or `tools/`, the structure
is wrong and gets fixed there.

Modules stay the shared nine (Override 1). A game that truly can't fill one
leaves it out of `modules`; the shell shows "Not available for this game yet".
Anything game-only becomes a **feature** inside a module, switched on by data.

---

## 3. The module registry

Three small registries in `src/core/registry/`. Games and modules never know
about each other; `main.tsx` wires them.

```ts
// modules.ts
export interface ModuleDef {
  id: ModuleId;
  label: string;                         // 'Today'
  glyph: string;                         // 'TD'
  tabs?: { id: string; label: string }[];  // Pulls: Planner · Calculator · Bank log · History
                                           // Roster: Characters · Teams
  screen: () => Promise<{ default: ModuleScreen }>;   // lazy-loaded from tools/<module>
}
export type ModuleScreen = React.FC<{ games: GameContract[]; scope: GameId | 'all' }>;

// features.ts — things that live inside a module and switch on by data
export interface FeatureDef {
  id: string;                            // 'kit-check'
  module: ModuleId;                      // 'roster'
  places: ('teams-tab' | 'character-page' | 'today-card' | 'history-card' | …)[];
  available(game: GameContract): boolean;           // e.g. g => !!g.data.kits
  component: () => Promise<{ default: React.FC<FeatureProps> }>;
}
// Luck report is a FeatureDef in pulls → history-card (Override 3).
// Kit check is a FeatureDef in roster → teams-tab + character-page (Override 1).

// games.ts
registerGame(contract: GameContract): void   // validates vent contrast, module ids, unique ids
listGames(): GameContract[]

// layout.ts — per user, per scope ('hsr' | 'zzz' | 'all')
interface LayoutState { order: ModuleId[]; hidden: ModuleId[] }
slot(game, layout)   = game.modules − layout.hidden, sorted by layout.order
slotAll(games, layout) = ∪ game.modules, own order, rows tagged by game
phoneBar(slot)       = slot.slice(0, 4) · more = slot.slice(4)
notAvailable(game)   = MODULE_CATALOG − game.modules       // hatched, no action
// Rules: at least one module stays visible; "Reset to default" = game.defaultOrder, hidden = [].
```

The shell renders `slot(...)` and nothing else. Adding a game = add a folder +
one line in `games/index.ts`. No shell change.

---

## 4. The shared pull-budget engine

`src/tools/budget/` — pure functions, no React, no database. Planner,
Calculator, Today ("pulls available"), Banners ("Plan pulls"), the evening
message and the Assistant all call the same `budget()`. That is Connection 1.

### Inputs
```ts
interface BudgetInput {
  game: GameContract;
  now: ISODate;
  until: ISODate;                        // Planner: banner start · Calculator: version end
  bank: Known<Record<CurrencyId, number>>;   // latest Bank log balance (or HoYoLAB)
  bankAt?: ISODate;
  income: IncomeRow[];                   // game rows + user's own rows (Edit mode)
  events: { id; reward: Known<number>; currency; ends: ISODate;
            state: 'open' | 'done' | 'skipped' }[];
  logins: { id; perDay: Known<number>[]; daysClaimed: number; ends: ISODate }[];
  backlog: { category; enabled: boolean; rewardLeft: Known<number>; currency }[];
  passes: { incomeRowId; activeUntil: ISODate }[];      // monthly card
  tasksDoneToday: Set<IncomeRow['id']>;  // from Today: today's daily already claimed?
  settings: { paidExtras: boolean };
}
```

### Rules (each one has a test)
1. **Only the future counts.** An occurrence counts only if it becomes claimable
   in `(now, until]`. Past rewards never count; they are already in the bank.
2. **Today's daily** counts only if its task is not marked done today.
3. **Done events** count zero (already in the bank). **Skipped** count zero.
   **Open** events count their reward only if they end after `now`.
4. **Login events** count `remaining days = total − daysClaimed`, limited by
   the days left before the event ends or `until`, whichever is first.
5. **Endgame cycles** count each reset falling inside the window.
6. **Monthly pass** counts per day while active, never past `activeUntil`.
7. **Paid rows** count only when `paidExtras` is on.
8. **Backlog**: enabled categories add their `rewardLeft` (available any time,
   so they count for both horizons). An income row with `coveredByBacklog`
   pointing at an enabled category is **skipped** → never counted twice.
9. **Unknown amounts** (`known: false`) are left out and listed by name.
   Never a zero, never an estimate.
10. **No bank → no total.** If the bank is unknown, the engine still returns
    the income rows, but `total` and `pulls` are `known: false`
    ("Add your current Stellar Jade").
11. **Currency → pulls**: `floor(premium / perPull) + pull items usable on that
    banner`. Fractions never shown as pulls.

### Output
```ts
interface Budget {
  rows: { rowId; label; source; occurrences: number; amount: number;
          status: 'counted' | 'already-earned' | 'skipped-backlog' | 'off-paid' | 'no-data' }[];
  bySource: Record<IncomeRow['source'] | 'backlog', number>;
  bank: Known<number>;
  total: Known<number>;                   // bank + counted rows
  pulls: Known<number>;
  leftOut: string[];                      // labels of rows with no data
  backlogPotential: Known<number>;        // pulls from DISABLED categories →
}                                         // "your Backlog could add about N pulls"
```

### How the screens use it
- **Calculator** → `budget({ until: versionEnd })`, shows `rows` by source.
- **Planner** → per banner `budget({ until: banner.start })` for "have by start",
  `until: banner.end` for "by end", plus the pity engine for chance + worst case,
  plus `backlogPotential` as the link back to Backlog. Chain: Backlog → Calculator → Planner.
- **Today** → `budget({ until: now })` = pulls available now.

### Pity engine (Connection 2) — `src/tools/pity/`
- `pityState(history, bannerType)` → `Known<{ pity; guaranteed }>` from imported pulls.
- `worstCase(state, bannerType)` → pulls to a guaranteed featured item.
  Uses only official hard pity, so it is shown even without history
  (assumes pity 0 and a 50/50 still to play; labelled as such).
- `chance(state, pulls, bannerType)` → exact probability by stepping through
  pity states. **Locked until history exists** (DESIGN.md). Shows **two
  numbers** when the game has soft-pity data: "official rates" (published,
  pessimistic) and "with community soft-pity data" (labelled as community,
  since the games don't publish it).
- `luck(history, ledger)` → avg pity, 50/50 record, free vs paid, cost per top-rarity.
  Lives as a card in History (Override 3).

---

## 5. Database (Supabase Postgres)

Every user table has `user_id`, row-level security `user_id = auth.uid()`, and
`created_at / updated_at`. Built-in lists and user progress are **separate
tables**: the owner can upsert lists all day without touching progress.

| Table | Holds | Never-wipe rule |
|---|---|---|
| `catalog_items` | owner-maintained lists: characters, banners, events, backlog items, materials, teams, kits, versions, leaks (`game_id, kind, id, data jsonb, status: active/retired, source`) | Items are retired, never deleted, so progress keeps pointing at a valid id |
| `user_items` | Edit mode: my own events / banners / backlog items, my changes and hides on built-in ones | Owner updates never touch it |
| `user_games` | chosen games, server per game, settings (paid extras, backlog switches) | |
| `layouts` | `scope, order[], hidden[]` | |
| `roster` | owned / wanted, dupes, level, build, source per field | Imports merge field by field; a newer import never blanks a filled field |
| `progress` | events (open/done/skipped), login days claimed, backlog done counts, task done per reset period | |
| `bank_ledger` | have / earned / bought / spent, append-only | Append-only |
| `pulls` | imported history, unique on `(user, game, game_pull_id)` | Re-import adds missing rows only |
| `plans` | own plans + Assistant proposals (`proposed / approved / undone`) | |
| `assistant_messages` | chat, model, tokens in/out, cost | |
| `assistant_actions` | each change the Assistant made, with the before-value, for **undo** | |
| `teams`, `shared_teams` | presets; share link token | |
| `connections` | HoYoLAB link (encrypted with Supabase Vault), feed token, evening-message settings | |
| `owner_*` | announcements, leak sources, game-record overrides | Owner only |

Migrations are add-only. A test checks no migration contains `DROP TABLE`,
`DROP COLUMN` or `DELETE FROM` on a user table. "Delete my account" is the only
path that removes a user's rows, and it offers **Export my data** (one JSON
file) first.

**Sync:** the app keeps a local copy (IndexedDB) so it opens instantly and
works on a bad connection; writes queue locally and push to Supabase. Sync
status in the shell shows the last successful sync. Ledger and pulls are
append-only so they never conflict; other rows use "newest edit wins" per row.

**Backups:** the free plan has no automatic backups. A nightly Supabase cron
job dumps user tables to Cloudflare R2 (free up to 10 GB), kept 14 days.
On the Pro plan this is replaced by Supabase's own daily backups.

---

## 6. Login and outside connections

- **Login**: Supabase Auth with Google, Discord and email sign-in link
  (FEATURES V2 decision, replaces name + PIN). Owner = a flag on your profile,
  checked on the server; the Owner console route doesn't exist for others.
- **HoYoLAB** (Override 2): live stamina, daily check-in, character import,
  endgame records. Uses your HoYoLAB cookie, stored encrypted, used only by the
  `hoyolab` server function (browsers can't call HoYoLAB directly). This is an
  unofficial API: when it fails the app shows "No data yet · Reconnect", never
  old numbers as if fresh.
- **Pull history** (Override 2): only from the in-game history link (pasted,
  read by the `gacha-import` server function) or a UIGF / SRGF file (read in
  the browser). Not from HoYoLAB.
- **Assistant**: each user pastes their own Claude API key in Account →
  Assistant. It's stored encrypted (Supabase Vault), never sent back to the
  browser, and used only by the `assistant` server function. No key → the
  Assistant shows the setup step instead of a chat. The function calls Claude with web search; tools are the
  same actions the UI has (propose plan, update bank, update backlog, mark
  done). Every write becomes a **proposal** you approve; approved ones can be
  undone. Each message shows its cost from the API's token counts.
- **Calendar feed**: `ics-feed` function, private link with a token you can reset.
- **Evening message**: phone notification (web push) at your chosen local
  time, sent by a cron job and built from the same data as Today (Connection 5).
  On iPhone, web push needs HLITH added to the home screen first; the setup
  checklist says so.

---

## 7. What each service costs

Prices as of October 2026; check each pricing page before signing up.

| Service | Free plan covers | When you'd pay | Paid price |
|---|---|---|---|
| **Supabase** (database, login, server functions, cron) | 500 MB database, 50,000 monthly users, 1 GB files, 5 GB traffic, 500,000 function calls/month. **Pauses after 7 days with no use**; no backups | Real users, or you don't want pausing / want backups | **Pro $25/month** (8 GB database, 100,000 users, daily backups, no pausing) |
| **Cloudflare Pages** (hosting) | Unlimited traffic, 500 builds/month, free `*.pages.dev` address | Practically never for this app | Pro $20/month |
| **Cloudflare R2** (nightly backups) | 10 GB stored | Over 10 GB | ~$0.015 per GB/month |
| **Google login** | Free | — | — |
| **Discord login** | Free | — | — |
| **Resend** (sign-in emails) | 3,000 emails/month, 100/day | More than 100 emails a day | $20/month for 50,000 |
| **Web push** (evening message as phone notification) | Free (built into browsers) | — | — |
| **Claude API** (Assistant) | Paid by **each user on their own key**, not by HLITH | Every message they send | Per million tokens in / out: Haiku 5.5 $0.10 / $0.50 · Sonnet 5.5 $2 / $10 · Opus 5.5 $4 / $20. Web search about $10 per 1,000 searches. A typical chat turn on Sonnet with your data attached: roughly $0.01–0.03. |
| **Own domain** (optional) | — | If you want `hlith.something` | ~$10–15/year |

**Likely bill:** **$0/month** to start (decided: free Supabase plan, free
`pages.dev` address). **$25/month** once real users rely on it. Assistant use is
always on each user's own key.

---

## 8. Build order

Each step ends with tests green, a commit, and a PROGRESS.md update. Pushes
are batched (about one per finished step or two) to stay under hosting limits.
Steps marked ★ are new screens without a design (Override 5): I show you each
before moving on.

**Foundation**
1. Project setup: Vite + React + TS strict, ESLint, Vitest, Playwright,
   architecture test (`core/tools` ↛ `games`), migration safety test, CI.
2. Tokens (`tokens.css`, ink.5 fixed for Override 4: `#56677A` → **`#6C7F93`**,
   4.83:1 on bg.app, 4.59:1 on bg.card) and Layer 4 components with a preview page.
3. Game contract types, registries, `_template`, HSR and ZZZ records
   (identity, currencies, servers, resets, banner types, income table). Vent
   contrast test. Fake-game test (§2b) proving a new game needs no core change.
4. Time: server reset maths, local time, locale formatting.
5. Shell: PC sidebar, phone bars, More sheet, game switcher, All games, Edit layout
   (drag, hide, restore, reset, not available), server picker. Local data only.

**Accounts and data**
6. Supabase project, schema, row-level security, login (Google, Discord, email link),
   local cache + sync status. Owner flag.
7. Built-in lists loader (catalog seeds from `games/*/data`), never-wipe tests.

**The shared engines**
8. Budget engine with the full rule tests (section 4).
9. Pity engine + UIGF/SRGF import + in-game link import (server function).

**Modules** (in order of what feeds what)
10. Events (states, login days).
11. Backlog (categories, switches).
12. Pulls: Bank log → Calculator → Planner → History + Luck report card.
13. Roster: Characters grid, character page, Teams tab, Kit check feature.
14. Banners (fit, leaks toggle, Plan pulls).
15. Farm (materials, stamina plan, gear).
16. Calendar (lanes, leaks dashed, own plans).
17. Today (resets, stamina, tasks, live banners, coming up) + ★ tonight's run + ★ wishlist.
18. Intel.

**Connections and extras**
19. ★ Edit mode (add / change / hide my events, banners, backlog items).
20. ★ HoYoLAB link + stamina, check-in, character import, endgame records.
21. ★ Assistant: own-key setup, chat, cost per message, model picker, ★ proposals with approve / undo.
22. ★ Screenshot scan of a character screen.
23. ★ Evening message + calendar feed settings, the feed and the cron job.
24. ★ Share a team.
25. ★ Setup checklist and Guide.
26. ★ Export my data + delete my account.
27. Owner console.
28. Polish: accessibility pass, phone pass, performance, light theme when designed.

---

## 9. Answers (2026-10-09)

1. **Assistant bill** → each user puts their own Claude key in their account.
2. **Evening message** → phone notification.
3. **Pull chances** → show both: official rates and community soft-pity data, labelled.
4. **Supabase** → free plan for now.
5. **Web address** → the free `project-hlith.pages.dev`-style address for now;
   a bought domain (~$10–15/year) can be added later without changing anything else.

## 10. Conflicts I found and how I resolved them

- `FEATURES.md` V2 decisions say "ZZZ adds Kit check as a game-only module".
  Override 1 wins: Kit check is a feature in Roster → Teams and the character page.
- `FEATURES.md` lists Luck report next to the Pulls tabs. Override 3 wins: four
  tabs, Luck report is a card inside History.
- `DESIGN.md` §4 lists HoYoLAB as a History import source ("History (import:
  link, file, HoYoLAB)"). Override 2 wins: link and files only.
- `HLITH System Diagram.dc.html` still shows Teams and Bangboo as modules and
  per-game module gaps. It's an older step; DESIGN.md §1 and Override 1 win.
- The docs were at the repo root; CLAUDE.md expects `docs/`. I moved them
  (design files included) so links inside DESIGN.md still work.
