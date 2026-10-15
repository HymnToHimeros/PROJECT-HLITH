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
  /** Visible only to the owner until the game is ready for everyone. */
  ownerOnly?: boolean;

  // ── Words the shell and modules use instead of game names ─────
  terms: {
    rarity: { top: string; mid: string; low?: string }; // '5★' / '4★' / '3★' or 'S' / 'A' / 'B'
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
  /**
   * A main character the player picks once, who comes in several forms (HSR: the Trailblazer,
   * Caelus or Stelle, one entry per Path). `of` says which option and which form an entry is;
   * undefined = not the main character. Once picked, the other option's entries are hidden
   * everywhere and the picked one's count as owned. Missing = the game has no such choice.
   */
  protagonist?: { label: string; options: { id: string; name: string }[]; of: (c: Character) => { option: string; form: string } | undefined };

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
  /**
   * How many make one pull: the premium currency, and a paid currency that
   * turns into it (counted in pulls the same way). The premium currency is the
   * one with `perPull` that isn't `paid`.
   */
  perPull?: number;
  /**
   * How many make one pull on particular banner types, where that differs from
   * `perPull` or the currency only buys pulls there (Endfield: 198 Arsenal
   * Tickets a weapon pull, sold 1980 for 10).
   */
  perPullOn?: Record<string, number>;
  /** A pull item, usable on these banner types. */
  pullItemFor?: string[];
  /**
   * You also get this currency from pulls on these banner types: at least
   * `atLeastPerPull` a pull on average, by the game's own rules (Endfield:
   * Arsenal Tickets from operator pulls). Only the sure part is counted.
   */
  fromPulls?: { on: string[]; atLeastPerPull: number; why: string };
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
  /** Only these currencies buy pulls here (Endfield's weapon banner: Arsenal Tickets and Origeometry). Missing = every currency that makes pulls. */
  currencies?: string[];
}

/** Pity engine state, generic across models. */
export interface PityState {
  pulls: number; // since last top-rarity result
  guaranteed: boolean; // next top-rarity result is the featured one
  /**
   * Room for a game's own counters. Two have a shared meaning, filled from
   * history by the Pulls screens: `banner` = counted pulls on the current
   * banner so far, `got` = 1 once its featured result came on it.
   */
  extra?: Record<string, number>;
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
      /**
       * A game's own rules, written in its games/ folder (e.g. Endfield's 120
       * guarantee once per banner). The pity engine steps through `pull` and
       * never needs to know the game.
       */
      kind: 'custom';
      describe: string;
      /** Where the rules come from, shown in the Guide. */
      source: string;
      /** Every result of the next step from this state: its chance, the state after it, and the featured copies it gives (0, 1 or more). */
      pull: (state: PityState) => PullOutcome[];
      /** Pulls in one step: 1, or 10 when the game only sells pulls in tens (Endfield's weapon issues). */
      step?: number;
      /** Most pulls for `copies` featured results from this state; null = no ceiling. */
      worstCase: (state: PityState, copies: number) => number | null;
      /** The top-rarity counter's ceiling ("pity 40/80"), when the game has one. */
      hardPity?: number;
      /** The featured split, for the Luck report and History (Endfield: 50/50 with no guarantee after a loss). */
      featured?: { winRate: number; guaranteeAfterLoss: boolean };
      /** After `after` pulls on one banner, the next banner of this type starts with `pulls` free pulls that count as usual (Endfield's Headhunting Dossier). */
      carryOver?: { after: number; pulls: number; label: string };
    };

/** One result of a step in a `custom` PityModel. */
export interface PullOutcome {
  p: number;
  next: PityState;
  /** Featured copies this result gives. */
  copies: number;
}

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
  /**
   * The end stats to build a character towards (owner's job T35, LOGIC-CORE): only numbers the game text states
   * (kit, signature weapon, recommended sets), each with its quote; the saved build's totals as "you".
   */
  statTargets?: (characterId: string, build?: CharacterBuild) => StatTargets;
}

/** One stat to build towards, with the game text that sets it (LOGIC-CORE, T35). */
export interface StatTargetRow {
  /** The game's stat name, e.g. "Effect Hit Rate", "SPD", ZZZ "Impact". */
  stat: string;
  /** The target in plain words, e.g. "140%", "above 1800", "170 (steps 140 / 170)". */
  target: string;
  /** From the saved build's totals; undefined = no data yet. */
  you?: string;
  /** Whether the saved totals reach the target; undefined = no data yet. */
  met?: boolean;
  /** What reaching it does, in plain words. */
  why: string;
  /** Where the number comes from, e.g. "Kit: Trace: Hearth Kindle", "Set: Space Sealing Station (recommended)". */
  source: string;
  /** The game text, word for word. */
  quote: string;
  /** How the number follows from the text, when it isn't written as is, e.g. "80% + 4 × 15% = 140%". */
  working?: string;
  /** When it applies, e.g. "Enhanced kit", "E6", "with their signature equipped". */
  condition?: string;
}

export interface StatTargets {
  /** Empty = the game text gives no number for this character: show "No data yet". */
  rows: StatTargetRow[];
  /** The game's recommended main and sub stats: a direction to build towards, without numbers. */
  direction?: { mains: Record<string, string[]>; subs: string[]; source: string };
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
  /** The stats on the game's character stat screen, by its names: what a build's `totals` and stat targets use (T35). */
  totalStats?: string[];
  /** Skills with their highest level (bonus levels from dupes included). */
  skills: { name: string; max: number }[];
}

/** What team scoring may know about the viewer's account. Not owned = no dupes. */
export interface TeamAccount {
  owned: (id: string) => boolean;
  dupes: (id: string) => number;
  /** A game's second upgrade track (`GameContract.potential`); undefined = not saved or not owned. */
  potential?: (id: string) => number | undefined;
  /** The weapon in the character's saved build, when one is saved (signature weapons). */
  weapon?: (id: string) => { id?: string; name: string; refine?: number } | undefined;
  /** The character's saved build (owned characters only): team rules read which stats it is built for (T18). */
  build?: (id: string) => CharacterBuild | undefined;
  /**
   * The owner's own slot lists for one of the game's teams (preset id), in the order the card shows the slots;
   * undefined = the game's lists. Team rules use them for who can join that carry and for `fill` (LOGIC-CORE).
   */
  teamList?: (presetId: string) => string[][] | undefined;
  /** Characters the owner hid (the unpicked Trailblazer, FRAME's protagonist setting): never used in any team (LOGIC-CORE). */
  skip?: (id: string) => boolean;
  /**
   * Leaked characters may join teams of released ones (Roster's "Show leaked" on and Banners' "Hide leaks" off; T39).
   * A team or "If you pull" that names a leak always reads it, marked unverified.
   */
  showLeaks?: boolean;
  /**
   * The owner's "Assume signature + average build" switch (T34, saved with the account): owned characters with no
   * saved build are scored with their signature weapon and an average build. Off or missing = scored at base.
   */
  assumeAverage?: boolean;
  /** Set by the team rules, not the app: this character's weapon and build are assumed (T34), not saved (LOGIC-CORE). */
  assumed?: (id: string) => boolean;
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

/** A team score in plain words (LOGIC-CORE): the headline, one line per member, and what is missing to reach 100%. */
export interface TeamExplain {
  headline: string;
  /** Each member: what they give the damage dealer (or, for the damage dealer, what the team switches on), and the points that earns. */
  members: { id: string; text: string; points: number }[];
  /** What costs points and what the best team has that this one lacks. Empty at 100% with nothing lost. */
  missing: string[];
}

/**
 * A build this team wants on a member (LOGIC-CORE, T18): their buff to the damage dealer grows with their own stat,
 * so the team wants them built for it. `points` are already inside the verdict's count.
 */
export interface TeamWant {
  who: string;
  /** The stat in words, e.g. "HP". */
  stat: string;
  /** e.g. "HP build on Robin • Summeretto". */
  label: string;
  /** What the saved build has, e.g. "HP main stat on Body, Feet (of 4 slots that can have it), 7 HP sub-stat rolls" or "no build saved". */
  have: string;
  fit: 'built' | 'partly' | 'not' | 'no-build';
  points: number;
  /** The most a fully built member adds (the best team found assumes it). */
  max: number;
  /** The kit line that makes the buff scale, word for word, and its piece. */
  proof: { skill: string; quote: string };
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
      /** The score in plain words, before the proof list. */
      explain?: TeamExplain;
      /** Builds this team wants on its members (stat-scaling buffs), with how the saved builds fit. */
      wants?: TeamWant[];
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
  /** The team's % with this character added, against the best team found from the same pool (LOGIC-CORE). */
  percent?: number;
  /** What came from your account, in words: "E2 counted", "no Eidolons: scored at E0", "Signature weapon: not counted yet". */
  fromAccount?: string[];
  /** Not owned: scored as theory (no dupes, base kit). */
  theory?: boolean;
}

/** Who fits options: by default only characters you own; `includeUnowned` adds the rest as theory. */
export interface FitOptions {
  includeUnowned?: boolean;
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
  /** Sorted best first. Default: your own characters only; `includeUnowned` adds the rest as theory. */
  whoFits: (members: string[], account: TeamAccount, options?: FitOptions) => FitSuggestion[];
  /** Best teams from owned characters, no character twice. */
  lineUps: (account: TeamAccount) => TeamIdea[];
  /** What a character adds to the account; null = not rated. */
  ifYouPull: (id: string, account: TeamAccount) => PullValue | null;
  /**
   * The members to show for one of the game's teams: per slot, the listed character you own who gives the team the
   * highest kit value, scored as My teams scores it (LOGIC-CORE, T40). Absent = each slot's first pick.
   */
  fill?: (preset: TeamPreset, account: TeamAccount) => string[];
  /**
   * Extra cards to show after the game's teams (LOGIC-CORE, T41): for a damage dealer whose cards all stay under 90%,
   * their best team found from your characters when no card shows that line-up. `source` is 'best-found'
   * (`BEST_FOUND`): no game team list to edit.
   */
  bestCards?: (presets: TeamPreset[], account: TeamAccount) => TeamPreset[];
  /**
   * How many characters' kits are read so far, of all the game's characters (LOGIC-CORE, E6b). Present while the
   * read set is partial: teams are the best among those read only, so screens say so. Absent = every kit is read.
   */
  readSoFar?: () => { read: number; total: number };
}
