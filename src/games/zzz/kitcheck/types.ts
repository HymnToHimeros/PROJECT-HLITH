import type { BuildStat } from '../../../core/rules/buildFit';
/**
 * The ZZZ cheat sheet: every kit cut into pieces, each answering the seven
 * questions of docs/logic/zzz-method.md (Part A). Plain data; the check
 * (check.ts) applies the rules of Part B to it.
 */

/** Specialty ids, as in characters.json / profiles.json. */
export type Specialty = 'attack' | 'stun' | 'anomaly' | 'support' | 'defense' | 'rupture' | 'armorer';

/**
 * What a piece gives (question 2), by stat.
 * Damage stats every damage dealer uses: dmg, crit-dmg, crit-rate, atk,
 * res-ignore, def-shred, dmg-taken, stun-dmg-multiplier, pen, extra-hit (an
 * extra hit counted as the damage dealer's own, e.g. Sunna's Cat's Gaze).
 * Stats only some use (counted only when the damage dealer's notes say so):
 * sheer-force, sheer-dmg, max-hp, anomaly-proficiency, anomaly-buildup,
 * anomaly-dmg (Attribute Anomaly, Disorder, Assault, Burn, Corruption DMG only),
 * aftershock-dmg (Aftershock DMG only).
 * Team support (tie-break only): daze, energy, stun-duration, decibels,
 * free-ultimate, heal, duration, own-damage (the giver's own damage).
 */
export type Stat =
  | 'dmg'
  | 'crit-dmg'
  | 'crit-rate'
  | 'atk'
  | 'res-ignore'
  | 'def-shred'
  | 'dmg-taken'
  | 'stun-dmg-multiplier'
  | 'pen'
  | 'extra-hit'
  | 'sheer-force'
  | 'sheer-dmg'
  | 'max-hp'
  | 'anomaly-proficiency'
  | 'anomaly-buildup'
  | 'anomaly-dmg'
  | 'aftershock-dmg'
  | 'daze'
  | 'energy'
  | 'stun-duration'
  | 'decibels'
  | 'free-ultimate'
  | 'heal'
  | 'duration'
  | 'own-damage';

export const GENERAL_STATS: readonly Stat[] = ['dmg', 'crit-dmg', 'crit-rate', 'atk', 'res-ignore', 'def-shred', 'dmg-taken', 'stun-dmg-multiplier', 'pen', 'extra-hit'];
export const SPECIFIC_STATS: readonly Stat[] = ['sheer-force', 'sheer-dmg', 'max-hp', 'anomaly-proficiency', 'anomaly-buildup', 'anomaly-dmg', 'aftershock-dmg'];
export const SUPPORT_STATS: readonly Stat[] = ['daze', 'energy', 'stun-duration', 'decibels', 'free-ultimate', 'heal', 'duration', 'own-damage'];

/** Question 1: when is it on? Absent = always (no squad condition). */
export type Condition =
  /** Another squad member is one of these specialties, shares the attribute or faction, has one of these attributes or assist types ('defensive', 'evasive'); any one is enough. */
  | { another: { specialties?: Specialty[]; sameAttribute?: boolean; sameFaction?: boolean; attributes?: string[]; assistTypes?: string[] } }
  /** The character directly before this one in the squad order is one of these. */
  | { previous: { specialties: Specialty[] } }
  /** At least this many squad members (this one included) have the specialty. */
  | { count: { specialty: Specialty; atLeast: number } }
  /** Every one of these. */
  | { all: Condition[] }
  /**
   * Named characters (mirrors HSR decision 38): 'carry', the damage dealer is one of them; 'member', one of them is in
   * the squad besides the kit's owner; 'not-carry', the damage dealer is none of them. Not met is no loss.
   */
  | { named: { ids: string[]; as: 'carry' | 'member' | 'not-carry'; words: string } }
  /** Cannot be checked from profiles: never counted as met. */
  | { unknown: string };

/** Question 3: who gets it? `teammate` = one other squad member the game picks (Seed's "Vanguard"), never the giver. */
export type Recipient = 'self' | 'squad' | 'enemy' | 'previous' | 'next' | 'switch-in' | 'teammate';

/** Question 4: limits on who can use it. */
export interface Limits {
  attributes?: string[];
  notAttributes?: string[];
  specialties?: Specialty[];
  notSpecialties?: Specialty[];
}

export type GameEventKind = 'quick-assist' | 'chain-attack' | 'ultimate' | 'ether-veil';
/** Question 5: whose event. `unsaid` = the text does not say, never counted. `squad` = a field everyone is in. */
export type Whose = 'previous' | 'next' | 'switch-in' | 'squad' | 'unsaid';

export interface Entry {
  /** Unique within the character, e.g. 'overwhelmingly-positive'. */
  id: string;
  /** The kit piece this comes from (Kit skill id). */
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
  /** Q5: this entry makes an event happen for someone… */
  causes?: { event: GameEventKind; whose: Whose };
  /** …or reacts when this character does that event (or any of these events). */
  reacts?: GameEventKind | GameEventKind[];
  /** Q6: what must be set up in the fight, or why nothing is needed. */
  setup: string;
  /** Q7: "does not stack with similar effects": entries sharing this key count once. */
  noStack?: string;
  /** Q7: this strengthens another entry (id). Counted as its own entry, as the method is written. */
  upgrades?: string;
  /** Q7: unclear text; shown, never counted. Says why. */
  /**
   * The amount grows with the giver's own stat ("equal to 16% of Robin • Summeretto's Max HP"): a team where this
   * counts wants that build on them (T18, decisions 25–26). `quote` is word for word from the piece; `gives` limits it
   * to those stats of the entry (absent = all).
   */
  scales?: { stat: BuildStat; quote: string; gives?: Stat[] };
  unverified?: string;
}

/** Part A step 5: what a damage dealer's own damage uses and ignores. */
export interface DamageNotes {
  uses: Stat[];
  ignores: Stat[];
  /** The sentences that prove it. */
  quotes: { piece: string; quote: string }[];
}

export interface CharacterSheet {
  characterId: string;
  name: string;
  /** For characters who can be the damage dealer. */
  damage?: DamageNotes;
  entries: Entry[];
  /** Pieces with nothing for the squad: piece id → why (e.g. "Deals Physical DMG only"). Every kit piece is either here or has entries. */
  nothing: Record<string, string>;
}

/**
 * An equipped weapon's effect, read like a kit piece (T18 step 4): every entry's `piece` is 'effect' and quotes
 * the weapon's effect text (weapons.json) word for word. It counts for whoever has it in their saved build, when
 * their specialty matches the weapon's. Signature weapons are read in their character's sheet instead.
 */
export interface WeaponSheet {
  weaponId: string;
  name: string;
  entries: Entry[];
  /** Why it gives the team nothing (only the wearer's own stats…); required when there are no entries. */
  nothing?: string;
}
