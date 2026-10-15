/**
 * The Endfield cheat sheet: every kit cut into pieces, each answering the seven questions of
 * docs/logic/endfield-method.md (Part A). Plain data; the check (check.ts) applies Part B to it.
 */

/** Damage types: Physical, or one of the four Arts elements. */
export type Element = 'physical' | 'heat' | 'cryo' | 'electric' | 'nature';
export const ARTS: readonly Element[] = ['heat', 'cryo', 'electric', 'nature'];

/** Classes, as in characters.json `role`. */
export type OpClass = 'caster' | 'defender' | 'guard' | 'striker' | 'supporter' | 'vanguard';

/** The four combat skills. */
export type SkillKind = 'basic' | 'battle' | 'combo' | 'ultimate';

/**
 * What a piece gives (question 2), by stat. Zones of the wiki's damage formula (decision 3).
 * Every damage dealer uses: atk, dmg (any "… DMG Bonus"), crit-rate, crit-dmg, amp, link,
 * susceptibility, dmg-taken ("DMG Taken +x%", Electrification, Breach), res-ignore, extra-hit.
 * Only some use (counted when the damage dealer's notes say so): arts-intensity (reaction and status damage).
 * Team support (tie-break only): sp, ultimate-energy, stagger, heal, shield, protection, own-damage.
 */
export type Stat =
  | 'atk'
  | 'dmg'
  | 'crit-rate'
  | 'crit-dmg'
  | 'amp'
  | 'link'
  | 'susceptibility'
  | 'dmg-taken'
  | 'res-ignore'
  | 'extra-hit'
  | 'arts-intensity'
  | 'sp'
  | 'ultimate-energy'
  | 'stagger'
  | 'heal'
  | 'shield'
  | 'protection'
  | 'own-damage';

export const GENERAL_STATS: readonly Stat[] = ['atk', 'dmg', 'crit-rate', 'crit-dmg', 'amp', 'link', 'susceptibility', 'dmg-taken', 'res-ignore', 'extra-hit'];
export const SPECIFIC_STATS: readonly Stat[] = ['arts-intensity'];
export const SUPPORT_STATS: readonly Stat[] = ['sp', 'ultimate-energy', 'stagger', 'heal', 'shield', 'protection', 'own-damage'];

/** Question 1: when is it on? Absent = always. */
export type Condition =
  /** Another team member is one of these classes or elements, or deals Physical / Arts damage; any one is enough. */
  | { another: { classes?: OpClass[]; elements?: Element[]; arts?: boolean } }
  /** At least this many team members (this one included) have the element or class. */
  | { count: { element?: Element; opClass?: OpClass; atLeast: number } }
  /** Every one of these. */
  | { all: Condition[] }
  /**
   * The operator in Team Position 01 is (or, with `not`, isn't) one of these elements. Position 01 is read as the
   * damage dealer (decision 8: you put your main damage first). Either/or text, so not met is no loss.
   */
  | { lead: { elements: Element[]; not?: boolean; words: string } }
  /** Named operators: 'carry' (the damage dealer is one), 'member' (one is in the team), 'not-carry'. Not met is no loss. */
  | { named: { ids: string[]; as: 'carry' | 'member' | 'not-carry'; words: string } }
  /** Cannot be checked from profiles: never counted as met. */
  | { unknown: string };

/**
 * Question 3: who gets it? 'controlled' = the controlled operator, read as the damage dealer (decision 2);
 * 'teammate' = one other operator the game picks (lowest HP…), never counted as reaching the damage dealer.
 */
export type Recipient = 'self' | 'team' | 'controlled' | 'enemy' | 'teammate';

/** Question 4: limits on whose damage it helps. */
export interface Limits {
  /** Only these damage types (decision 4: `arts` = any Arts element). */
  elements?: Element[];
  arts?: boolean;
  /** Only damage from these skills ("Battle Skill DMG +20%"). */
  skills?: SkillKind[];
}

/**
 * Question 5: events a piece sets up or reacts to (decision 5). The general ones cover the specific:
 * 'physical-status' covers lift, knock-down, crush and breach; 'arts-infliction' covers the four
 * element inflictions; 'arts-reaction' covers the four reactions. Arts Susceptibility counts as every
 * Arts element's (wiki: "also considered Susceptible to all Arts Elements"), never as Physical.
 */
export type GameEvent =
  | 'vulnerable'
  | 'physical-status'
  | 'lift'
  | 'knock-down'
  | 'crush'
  | 'breach'
  | 'arts-infliction'
  | 'heat-infliction'
  | 'cryo-infliction'
  | 'electric-infliction'
  | 'nature-infliction'
  | 'arts-burst'
  | 'arts-reaction'
  | 'combustion'
  | 'solidification'
  | 'electrification'
  | 'corrosion'
  | 'physical-susceptibility'
  | 'arts-susceptibility'
  | 'heat-susceptibility'
  | 'cryo-susceptibility'
  | 'electric-susceptibility'
  | 'nature-susceptibility'
  | 'stagger'
  | 'final-strike'
  | 'link';

export interface Entry {
  /** Unique within the operator. */
  id: string;
  /** The kit piece this comes from (KitSkill id, data/kits.json). */
  piece: string;
  /** Word for word from that piece's game text: the proof. */
  quote: string;
  /** What it does, in a few plain words (shown as the tag). */
  tag: string;
  /** Q1. Absent = always on. */
  on?: Condition;
  /** Q2. Empty = gives nothing to anyone (an event or a reaction only). */
  gives: { stat: Stat; amount: string }[];
  /** Q3. */
  to: Recipient;
  /** Q4. */
  limits?: Limits;
  /** Q5: this piece sets these up… */
  causes?: GameEvent[];
  /** …or needs one of these to happen (a Combo trigger, an effect on a Vulnerable enemy). */
  reacts?: GameEvent[];
  /** Q6: what must be set up in the fight, or why nothing is needed. */
  setup: string;
  /** Q7: entries sharing this key count once ("only the strongest applies"). */
  noStack?: string;
  /** Q7: unclear text; shown, never counted. Says why. */
  unverified?: string;
}

/** Part A step 5: a damage dealer's own damage. */
export interface DamageNotes {
  element: Element;
  /** The skills their damage mainly comes from. */
  skills: SkillKind[];
  uses: Stat[];
  ignores: Stat[];
  /** The sentences that prove it. */
  quotes: { piece: string; quote: string }[];
}

export interface CharacterSheet {
  characterId: string;
  name: string;
  /** Operators who can be the damage dealer (decision 1). */
  damage?: DamageNotes;
  entries: Entry[];
  /** Pieces with nothing for the team: piece id → why. Every kit piece is either here or has entries. */
  nothing: Record<string, string>;
}
