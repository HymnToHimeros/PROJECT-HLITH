/**
 * The game contract: the one shape every game fills in (src/games/<id>/contract.ts).
 * core/ and tools/ read only this. Nothing here may assume one company's rules:
 * where games differ there is a shared option or a slot for the game's own rule
 * (docs/PLAN.md §2b).
 */
import type {
  BacklogItem,
  Banner,
  BuildLevel,
  Character,
  CharacterBuild,
  GameEvent,
  ISODate,
  Kit,
  Material,
  MaterialNeed,
  PullRecord,
  TeamPreset,
  Version,
} from './entities';
import type { Known } from './known';

export const MODULE_IDS = [
  'today',
  'events',
  'calendar',
  'backlog',
  'pulls',
  'banners',
  'roster',
  'farm',
  'intel',
] as const;
export type ModuleId = (typeof MODULE_IDS)[number];

export type GameId = string;
export type Hex = `#${string}`;

export interface GameContract {
  // ── Identity (Layer 3) ─────────────────────────────────────────
  id: GameId;
  short: string; // 'HSR'
  name: string;
  /** Must reach 7:1 with #08090B and not be orange or red. Checked on register. */
  vent: Hex;
  icon?: string;

  // ── Words the shell and modules use instead of game names ─────
  terms: {
    rarity: { top: string; mid: string }; // '5★' / '4★' or 'S' / 'A'
    gear: string;
    weapon: string;
    skill: string;
    character: string; // 'Character' / 'Agent'
    endgame: string[];
  };
  elements: { id: string; label: string; color: Hex }[];
  roles: { id: string; label: string }[];
  /** Absent = the game has no dupe system; Roster hides the column. */
  dupes?: { prefix: string; name: string; max: number };

  // ── Economy ────────────────────────────────────────────────────
  currencies: Currency[];
  stamina: StaminaPool[];

  // ── Servers and resets (never in the shell) ───────────────────
  servers: { id: string; label: string; utcOffset: number }[];
  /** Daily reset hour and weekly reset weekday (0 = Sunday … 1 = Monday), server time. */
  reset: { hour: number; weekday: number };

  // ── Modules ────────────────────────────────────────────────────
  modules: ModuleId[];
  defaultOrder: ModuleId[];

  // ── Pulls ──────────────────────────────────────────────────────
  bannerTypes: BannerType[];
  income: IncomeRow[];
  historyImporters: HistoryImporter[]; // [] = no import; History offers manual entry
  /** How this game's history exports and links map onto HLITH (data, read by tools/import). */
  historyMapping?: HistoryMapping;

  // ── Built-in lists (seed data; the owner can update them later) ─
  data: GameDataLoaders;

  // ── Optional abilities. Missing = the feature shows "No data yet". ─
  accountLinks?: AccountLink[];
  scan?: { screen: 'character'; fields: string[] };
  rules: GameRules;

  /** Where the numbers in this record come from, shown in the Guide. `verified` = someone checked it in game. */
  sources: { what: string; source: string; entered: ISODate; verified: boolean }[];
}

export interface Currency {
  id: string;
  name: string;
  /** Premium currency: how many make one pull. */
  perPull?: number;
  /** A pull item, usable on these banner types. */
  pullItemFor?: string[];
  paid?: boolean;
}

export interface StaminaPool {
  id: string;
  name: string;
  max: number;
  minutesPerPoint: number;
}

export interface BannerType {
  id: string;
  label: string;
  /** Currency id of the pull item this banner uses. */
  pullItem: string;
  /** What the top-rarity result is for chance and worst case. */
  target: 'character' | 'weapon' | 'other';
  pity: PityModel;
}

/** Pity engine state, generic across models. */
export interface PityState {
  pulls: number; // since last top-rarity result
  guaranteed: boolean; // next top-rarity result is the featured one
  extra?: Record<string, number>; // room for a game's own counters
}

/**
 * How a banner's luck works. Shared models plus `custom`, so a game with new
 * rules needs no change in core/ or tools/.
 */
export type PityModel =
  | {
      kind: 'hard-pity';
      hardPity: number;
      /** Official per-pull rate of a top-rarity result; null = not published. */
      baseRate: number | null;
      featured?: { winRate: number; guaranteeAfterLoss: boolean };
      /** Community-measured rising odds. Shown as a second, labelled number. */
      softPity?: { from: number; stepPerPull: number; source: string };
    }
  | { kind: 'spark'; sparkAt: number; baseRate: number | null }
  | { kind: 'none'; baseRate: number | null }
  | {
      kind: 'custom';
      describe: string;
      topRate: (state: PityState) => number;
      next: (state: PityState, gotTop: boolean, gotFeatured: boolean) => PityState;
      worstCase: (state: PityState) => number;
    };

export interface IncomeRow {
  id: string; // stable: 'hsr.daily-training'
  source: 'daily' | 'weekly' | 'endgame' | 'monthly' | 'events' | 'login' | 'one-time' | 'paid';
  label: string;
  currency: string;
  /** Per occurrence. null = unknown → left out of totals and listed as "no data". */
  amount: number | null;
  schedule:
    | { kind: 'per-reset' }
    | { kind: 'weekly' }
    | { kind: 'cycle'; anchor?: ISODate; days: number }
    | { kind: 'pass'; perDay: number }
    | { kind: 'from-events' }
    | { kind: 'from-login-events' }
    | { kind: 'once'; at?: ISODate };
  /** Backlog category that, when switched on, already counts this income. */
  coveredByBacklog?: string;
  paid?: boolean;
}

export interface HistoryImporter {
  id: string; // 'uigf-v4', 'srgf'
  kind: 'file' | 'link';
  label: string;
  /** file: parsed in the browser · link: sent to the gacha-import server function. */
  parse?: (input: string) => Promise<PullRecord[]>;
}

export interface HistoryMapping {
  /** Section name inside a UIGF v4 file: 'hkrpg' (HSR), 'nap' (ZZZ), 'hk4e' (Genshin). */
  uigfKey?: string;
  /** The game's gacha_type → our BannerType id. Unlisted types are skipped and counted. */
  gachaTypes: Record<string, string>;
  /** The game's rank_type → rarity. */
  rarity: Record<string, 'top' | 'mid' | 'low'>;
  /** Item ids of standard-pool top results: getting one on a featured banner = lost 50/50. */
  standardTop?: string[];
}

export interface AccountLink {
  provider: string; // 'hoyolab' today; other services later
  supports: ('stamina' | 'checkin' | 'roster' | 'endgame')[];
  config: Record<string, string>;
}

export interface GameDataLoaders {
  characters: () => Promise<Character[]>;
  banners: () => Promise<Banner[]>;
  events: () => Promise<GameEvent[]>;
  backlog: () => Promise<BacklogItem[]>;
  materials: () => Promise<Material[]>;
  teams: () => Promise<TeamPreset[]>;
  versions: () => Promise<Version[]>;
  /** Override 1: Kit check shows for any game that has this. */
  kits?: () => Promise<Kit[]>;
}

/** Game maths. Every member is optional: absent = that feature shows "No data yet". */
export interface GameRules {
  materialsFor?: (characterId: string, from: BuildLevel, to: BuildLevel) => MaterialNeed[];
  scoreBuild?: (build: CharacterBuild) => Known<{ score: number; grade: string }>;
}
