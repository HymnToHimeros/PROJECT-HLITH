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
  art?: string;
  /** Where this entry came from, e.g. 'nanoka.cc'. */
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
  category: string; // 'story', 'side-quests', 'exploration', 'modes', 'achievements'
  title: string;
  total: number;
  /** Premium currency for finishing it all; null = unknown. */
  reward: number | null;
  currency: string;
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

/** Owned by the roster-logic workstream; FRAME only defines the slot. */
export interface Kit {
  characterId: string;
  skills: { id: string; label: string; does: string[]; gameText: string }[];
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
