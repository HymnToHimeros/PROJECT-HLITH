/**
 * The things every game's lists are made of. Every item has a stable `id` that
 * never changes, so list updates never orphan anyone's progress.
 * Fields a game can't supply are optional; screens show "No data yet" for them.
 */
export type ISODate = string;

export interface Character {
  id: string;
  name: string;
  rarity: 'top' | 'mid';
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

export interface Banner {
  id: string;
  type: string; // GameContract.bannerTypes[].id
  title: string;
  featured: string[]; // character or weapon ids
  start: ISODate;
  end: ISODate;
  /** Leaks carry their source and show as unverified. */
  leak?: { source: string };
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
}

export interface Material {
  id: string;
  name: string;
  kind: string; // 'ascension', 'skill', 'credits', …
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
  kind?: 'skill' | 'core' | 'additional' | 'mindscape' | 'potential' | 'trace' | 'eidolon';
  /** Only active from this dupe level (1–6) or potential level; absent = base kit. */
  unlock?: { dupes?: number; potential?: number };
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

export interface CharacterBuild {
  characterId: string;
  level: number;
  dupes: number;
  weapon?: { id: string; level: number };
  gear: { slot: string; main: string; subs: Record<string, number> }[];
}
