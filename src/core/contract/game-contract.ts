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
  BuildScorePart,
  GameEvent,
  ISODate,
  Kit,
  Material,
  MaterialNeed,
  PullRecord,
  RecommendedBuild,
  Weapon,
  TeamPreset,
  Version,
} from './entities';
import type { Known } from './known';

/** Every module, in the default sidebar order. Every game uses this same order (so the bar mirrors between games) until the viewer changes it. */
export const MODULE_IDS = ['today', 'pulls', 'roster', 'calendar', 'events', 'banners', 'backlog', 'farm', 'intel'] as const;
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
  /**
   * A second upgrade track some characters have (ZZZ Agent Potential 0–6, HSR Enhanced
   * kit: max 1 = on/off). The character page offers it only for characters whose kit has
   * pieces that need it. Saved per character; not set = team rules treat it as unknown.
   */
  potential?: { name: string; max: number };
  /** What a saved build holds for this game (character page form, scan). Missing = builds can't be saved. */
  build?: BuildRules;

  // ── Economy ────────────────────────────────────────────────────
  currencies: Currency[];
  stamina: StaminaPool[];
  /** How many characters fit in one team (e.g. 4 or 3). */
  teamSize: number;

  // ── Servers and resets (never in the shell) ───────────────────
  servers: { id: string; label: string; utcOffset: number }[];
  /** Daily reset hour and weekly reset weekday (0 = Sunday … 1 = Monday), server time. */
  reset: { hour: number; weekday: number };

  // ── Modules ────────────────────────────────────────────────────
  modules: ModuleId[];

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

/** A few characters' art, used ONLY to illustrate example (EXAMPLE-badged) data. Real art comes from the data workstream. */
export interface SampleArt {
  characterId: string;
  art: string;
  portrait: string;
}

export interface GameDataLoaders {
  /** Sample art for example data only. */
  sampleArt?: () => Promise<SampleArt[]>;
  characters: () => Promise<Character[]>;
  banners: () => Promise<Banner[]>;
  events: () => Promise<GameEvent[]>;
  backlog: () => Promise<BacklogItem[]>;
  materials: () => Promise<Material[]>;
  teams: () => Promise<TeamPreset[]>;
  versions: () => Promise<Version[]>;
  /** Override 1: Kit check shows for any game that has this. */
  kits?: () => Promise<Kit[]>;
  /** Recommended builds (gear, weapon, stats, skills first), source named. */
  builds?: () => Promise<RecommendedBuild[]>;
  /** Weapons (Light Cones, W-Engines): names and pictures for weapon banners. */
  weapons?: () => Promise<Weapon[]>;
}

/** Game maths. Every member is optional: absent = that feature shows "No data yet". */
export interface GameRules {
  materialsFor?: (characterId: string, from: BuildLevel, to: BuildLevel) => MaterialNeed[];
  /** What the material amounts include or leave out, in plain words (shown with them). */
  materialsNote?: string;
  scoreBuild?: (build: CharacterBuild) => Known<{ score: number; grade: string; parts?: BuildScorePart[]; basis?: string }>;
  /** Team scoring from kits (LOGIC-CORE). Every score explains itself with kit text. */
  teams?: TeamRules;
}

/** The game facts the build form needs. Stat lists are suggestions; any name the game uses can be typed. */
export interface BuildRules {
  levelMax: number;
  weaponLevelMax: number;
  /** What extra weapon copies are called (Superimposition, Phase) and their max. */
  refine: { name: string; max: number };
  /** Gear slots in game order, with the main stats each can roll. */
  slots: { id: string; label: string; mains: string[] }[];
  subStats: string[];
  /** Skills with their highest level (bonus levels from dupes included). */
  skills: { name: string; max: number }[];
}

/** What team scoring may know about the viewer's account. Not owned = no dupes. */
export interface TeamAccount {
  owned: (id: string) => boolean;
  dupes: (id: string) => number;
  /** A game's second upgrade track (`GameContract.potential`); undefined = not saved or not owned. */
  potential?: (id: string) => number | undefined;
}

/** One reason behind a team score. */
export interface TeamReason {
  /** What it adds to the count; 0 = shown but not counted. */
  points: number;
  group: 'counted' | 'tie-break' | 'not-counted';
  text: string;
  /** The kit text that proves it. */
  proof?: { who: string; skill: string; quote: string };
}

export type TeamVerdict =
  | {
      rated: true;
      /** 0–100: this team against the best the rules find for its damage dealer. */
      percent: number;
      label: string;
      count: number;
      best: number;
      bestMembers: string[];
      /** The order the score is for, e.g. A > B > C; the damage dealer first. */
      order: string[];
      /** The game's teams have no order (HSR): `order` is only "damage dealer first". */
      unordered?: boolean;
      reasons: TeamReason[];
      notes: string[];
    }
  | { rated: false; why: string };

export interface TeamIdea {
  members: string[];
  count: number;
  why: string;
}

export interface FitSuggestion {
  id: string;
  count: number;
  /** How it connects, in words ("turns on Billy's Additional Ability"). */
  how: string[];
  withEveryone: boolean;
}

export interface PullValue {
  /** 0 = no gain. */
  percent: number;
  why: string[];
}

/** Team logic for one game (filled by LOGIC-CORE in the game's folder). */
export interface TeamRules {
  /** Where the rules are written, shown with every score. */
  method: string;
  /** Can this character be rated yet (their kit has been read)? */
  rated: (id: string) => boolean;
  verdict: (members: string[], account: TeamAccount) => TeamVerdict;
  whoFits: (members: string[], account: TeamAccount) => FitSuggestion[];
  /** Best teams from owned characters, no character twice. */
  lineUps: (account: TeamAccount) => TeamIdea[];
  /** What a character adds to the account; null = not rated. */
  ifYouPull: (id: string, account: TeamAccount) => PullValue | null;
}
