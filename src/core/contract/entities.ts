/**
 * The things every game's lists are made of. Every item has a stable `id` that
 * never changes, so list updates never orphan anyone's progress.
 * Fields a game can't supply are optional; screens show "No data yet" for them.
 */
export type ISODate = string;

export interface Character {
  id: string;
  name: string;
  rarity: 'top' | 'mid' | 'low';
  element: string; // GameContract.elements[].id
  role: string; // GameContract.roles[].id
  releasedAt?: ISODate;
  /** Full splash art (banners, character page). */
  art?: string;
  /** Small portrait (tiles, team slots). */
  portrait?: string;
  /** Where this entry came from, e.g. 'nanoka.cc'. */
  source?: string;
  /** A leaked, not yet released character: shown only when the user asks for leaks, always marked unverified. */
  leak?: { source: string };
}

/** A weapon (Light Cone, W-Engine): what weapon banners feature (LOGIC-CORE). */
export interface Weapon {
  id: string;
  name: string;
  rarity: 'top' | 'mid' | 'low';
  /** Picture (full URL), when the source has one that loads. */
  icon?: string;
  /** The character it is made for (their signature weapon), when the game data says so. */
  madeFor?: string;
  /** The path (HSR) or specialty (ZZZ) whose wearers get its effect, as `Character.role` (LOGIC-CORE, T18). */
  role?: string;
  /** Its effect at the first refinement, in the game's words (LOGIC-CORE: the kit check reads it). */
  effect?: { name: string; text: string };
  source?: string;
}

export interface Banner {
  id: string;
  type: string; // GameContract.bannerTypes[].id
  title: string;
  featured: string[]; // character or weapon ids
  start: ISODate;
  end: ISODate;
  /** Leaks carry their source and show as unverified. */
  leak?: { source: string };
  /**
   * Times the game gives in "server time" (the same clock time on every server). `base` is the
   * UTC offset the times above are written in (e.g. 8 for the Asia server); `start`/`end` say
   * which of the two follow the server clock. Screens shift them to the user's chosen server.
   */
  serverTime?: { base: number; start?: boolean; end?: boolean };
  /** Banner art (e.g. a weapon banner's light cone / W-Engine picture). Missing = the lead character's art. */
  art?: string;
  /**
   * Always available (e.g. a permanent collaboration warp). `end` then only says how long it is
   * announced; screens show "Permanent" instead of a countdown and leave it off timelines and plans.
   */
  permanent?: boolean;
}

export interface GameEvent {
  id: string;
  title: string;
  kind: 'event' | 'login' | 'web' | 'endgame' | 'bonus';
  start: ISODate;
  end: ISODate;
  reward: number | null; // premium currency left to earn; null = unknown
  currency: string;
  loginDays?: number;
  leak?: { source: string };
  /**
   * Times the game gives in "server time" (the same clock time on every server). `base` is the
   * UTC offset the times above are written in (e.g. 8 for the Asia server); `start`/`end` say
   * which of the two follow the server clock. Screens shift them to the user's chosen server.
   */
  serverTime?: { base: number; start?: boolean; end?: boolean };
}

export interface BacklogItem {
  id: string;
  category: string; // 'story', 'side-quests', 'permanent-events', 'exploration', 'modes', 'achievements'
  title: string;
  /** How much there is to do (chapters, chests, points…). 1 = a single tick box. With `steps`: the number of steps. */
  total: number;
  /** Premium currency for finishing it all; null = unknown; 0 = gives no reward. */
  reward: number | null;
  currency: string;
  /** Shown under a heading inside its category (e.g. the region of a side quest). */
  group?: string;
  /** An ordered checklist (e.g. story chapters): you tap the step you are on and everything before it counts as done. */
  steps?: string[];
  /** Unit after the numbers, e.g. "%" for exploration. Missing = a plain count. */
  unit?: string;
  /** A short note shown under the title (where a number came from, a timer the game shows…). */
  note?: string;
  /** How much one − / + changes a counter (default 1), e.g. 100 for points. */
  step?: number;
}

export interface Material {
  id: string;
  name: string;
  kind: string; // 'ascension', 'skill', 'credits', …
  /** Picture of the item (full URL), when the source has one (LOGIC-CORE). */
  icon?: string;
  /** Stamina per run and expected drops per run, when known. */
  staminaPerRun?: number;
  dropsPerRun?: number;
}

export interface MaterialNeed {
  material: string;
  amount: number;
}

export interface TeamPreset {
  id: string;
  name: string;
  slots: { characters: string[] }[]; // each slot lists acceptable characters, best first
  source: string;
}

/** One piece of a kit: a skill, a passive, or a dupe level (Mindscape, Eidolon). */
export interface KitSkill {
  /** Stable within the kit; tags and scores point at it. */
  id: string;
  label: string;
  /** What sort of piece it is; screens group by it. */
  kind?: 'skill' | 'core' | 'additional' | 'mindscape' | 'potential' | 'trace' | 'eidolon' | 'weapon';
  /** Only active from this dupe level (1–6) or potential level; absent = base kit. */
  /** `weapon`: only with this weapon (id) equipped in the saved build: the character's signature weapon (LOGIC-CORE). */
  unlock?: { dupes?: number; potential?: number; weapon?: string };
  /** No longer applies from this level: a stronger version (`unlock` at the same level) replaces it. */
  replacedAt?: { potential: number };
  /** What it does, in a few words. Empty until the kit has been read. */
  does: string[];
  /** Each tag with the exact words of `gameText` that prove it. */
  proof?: { tag: string; quote: string; note?: string }[];
  /** When read and nothing in it matters for the team: why, in words. */
  note?: string;
  /** The game's own text, markup turned into plain words. */
  gameText: string;
}

/** Owned by the LOGIC-CORE workstream (docs/WORKSTREAMS.md); FRAME only defines the slot. */
export interface Kit {
  characterId: string;
  /** Where the text came from, e.g. 'nanoka.cc', and the game data version read. */
  source?: string;
  version?: string;
  /** Not released yet: the text can change before release. */
  beta?: boolean;
  skills: KitSkill[];
}

/** A recommended build for one character, with who recommends it (LOGIC-CORE). */
export interface RecommendedBuild {
  characterId: string;
  /** Who recommends it, shown with it. */
  source: string;
  /** Gear sets: each with how many pieces and the options, best first. */
  sets: { pieces: number; options: string[] }[];
  /** Main stats by gear slot, e.g. { 'Disc 4': ['CRIT Rate'] }. */
  mainStats: Record<string, string[]>;
  subStats: string[];
  /** Weapons, best first. Empty = none recommended. */
  weapons: string[];
  /** Skills to level first, tier by tier. Empty = the source doesn't say. */
  skillsFirst: string[][];
  /** Read from the game's beta files: the character isn't out yet and the recommendation may change (LOGIC-CORE, T54). */
  beta?: boolean;
  /** The game data build a beta recommendation was read from. */
  version?: string;
  /** Picture and game text for each set and weapon named above, by name (LOGIC-CORE). */
  items?: Record<string, BuildItem>;
}

/** A gear set or weapon in a recommended build: its picture and what it does, in the game's words. */
export interface BuildItem {
  /** Full URL of its picture. */
  icon?: string;
  /** Rarity as the game counts it (ZZZ: 2 B, 3 A, 4 S; HSR: 3–5 stars). */
  rarity?: number;
  /** Its effects, e.g. { label: '2-piece', text: 'CRIT Rate +8%' }. */
  effects: { label: string; text: string }[];
}

export interface Version {
  id: string; // '3.6'
  start: ISODate;
  end: ISODate;
}

export interface PullRecord {
  /** The game's own pull id, so re-imports never duplicate. */
  id: string;
  bannerType: string;
  itemId: string;
  name: string;
  rarity: 'top' | 'mid' | 'low';
  time: ISODate;
  /** For top-rarity results: was it the banner's featured item? Unknown = undefined. */
  featured?: boolean;
}

export interface BuildLevel {
  level: number;
  skills?: number[];
}

/**
 * A build you saved for one character (character page, screenshot scan, later HoYoLAB).
 * Names are as the game writes them; gear slot ids are `GameContract.build.slots[].id`.
 * Every field can be missing: HLITH shows only what you entered.
 */
export interface SavedBuild {
  level?: number;
  /** Weapon by name; `id` when it matches the game's list. `refine`: Superimposition / Phase. */
  weapon?: { name: string; id?: string; level?: number; refine?: number };
  gear: { slot: string; set?: string; main?: string; level?: number; subs: { stat: string; value: number; rolls?: number }[] }[];
  /** Skill name → level. */
  skills?: Record<string, number>;
  /** Total stats as the game's stat screen shows them (BuildRules.totalStats names; % as plain numbers). Missing = not saved (T35). */
  totals?: Record<string, number>;
  source: 'manual' | 'scan' | 'hoyolab';
  updatedAt: string;
}

export interface CharacterBuild {
  characterId: string;
  level: number;
  dupes: number;
  /** The weapon by name; `id` when it matches the game's list, `level` when entered. `refine`: Superimposition / Phase. */
  weapon?: { name: string; id?: string; level?: number; refine?: number };
  /** Each piece: its slot, main stat, sub stats (stat → value), and when known its set and how many rolls went into each sub stat (LOGIC-CORE). */
  gear: { slot: string; main: string; subs: Record<string, number>; set?: string; rolls?: Record<string, number> }[];
  /** Skill name → level, when entered (LOGIC-CORE). */
  skills?: Record<string, number>;
  /**
   * The character's total stats as the game's stat screen shows them, by the game's stat names ("CRIT Rate", "SPD");
   * % stats as plain numbers (72.5 = 72.5%). From the scan, HoYoLAB or typed in; undefined = not saved (T35).
   */
  totals?: Record<string, number>;
}

/** One checked part of a build score, shown on screen with how it was worked out (LOGIC-CORE). */
export interface BuildScorePart {
  label: string;
  /** 0–100; null = no data yet (not counted). */
  value: number | null;
  /** In plain words: what was compared and what was found. */
  detail: string;
}
