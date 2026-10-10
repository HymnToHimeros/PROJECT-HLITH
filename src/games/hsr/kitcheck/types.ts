/**
 * The HSR cheat sheet: every kit cut into pieces, each answering the seven
 * questions of docs/logic/hsr-theory.md (Part A). Plain data; the check
 * (check.ts) applies the rules of Part B to it.
 */

/** Paths, as `role` in characters.json. */
export type Path = 'destruction' | 'hunt' | 'erudition' | 'harmony' | 'nihility' | 'preservation' | 'abundance' | 'remembrance' | 'elation';
/** Elements, as in characters.json. */
export type Element = 'physical' | 'fire' | 'ice' | 'lightning' | 'wind' | 'quantum' | 'imaginary';

/**
 * Kinds of damage a damage dealer deals (Part A step 5). A buff limited to a
 * kind ("Follow-Up ATK DMG", "Break DMG") only reaches damage dealers who deal it.
 */
export type DamageKind =
  | 'basic'
  | 'skill'
  | 'ultimate'
  | 'follow-up'
  | 'dot'
  | 'break'
  | 'super-break'
  | 'additional'
  | 'memosprite'
  | 'elation'
  | 'true';

/**
 * What a piece gives (question 2), by stat.
 * GENERAL: every damage dealer uses them: dmg (DMG Boost / DMG dealt), crit-rate,
 * crit-dmg, atk, def-shred (enemy DEF down or DEF ignored), res-pen (RES PEN or
 * enemy RES down), vulnerability (enemy takes more DMG), spd, action-advance
 * (SPD and turns are HSR's main currency), extra-dmg (an extra hit or Additional
 * DMG counted as the damage dealer's own, e.g. Super Break for them).
 * SPECIFIC: only when the damage dealer's notes list it in `uses`: hp, def,
 * break-effect, break-efficiency (Weakness Break Efficiency / Toughness reduction),
 * effect-hit-rate, elation, energy-regen (an Ultimate-based carry), skill-points
 * (a Skill-Point-hungry carry).
 * SUPPORT (tie-break only, and they keep a teammate from being a weak fit):
 * heal, shield, cleanse, energy, skill-point-gain (when the carry does not use
 * skill-points), delay (enemy action delayed), taunt, revive, own-damage.
 */
export type Stat =
  | 'dmg'
  | 'crit-rate'
  | 'crit-dmg'
  | 'atk'
  | 'def-shred'
  | 'res-pen'
  | 'vulnerability'
  | 'spd'
  | 'action-advance'
  | 'extra-dmg'
  | 'hp'
  | 'def'
  | 'break-effect'
  | 'break-efficiency'
  | 'effect-hit-rate'
  | 'elation'
  | 'energy-regen'
  | 'skill-points'
  | 'heal'
  | 'shield'
  | 'cleanse'
  | 'energy'
  | 'delay'
  | 'taunt'
  | 'revive'
  | 'own-damage';

export const GENERAL_STATS: readonly Stat[] = ['dmg', 'crit-rate', 'crit-dmg', 'atk', 'def-shred', 'res-pen', 'vulnerability', 'spd', 'action-advance', 'extra-dmg'];
export const SPECIFIC_STATS: readonly Stat[] = ['hp', 'def', 'break-effect', 'break-efficiency', 'effect-hit-rate', 'elation', 'energy-regen', 'skill-points'];
export const SUPPORT_STATS: readonly Stat[] = ['heal', 'shield', 'cleanse', 'energy', 'delay', 'taunt', 'revive', 'own-damage'];
/** Support that counts as sustain for the sustain check. */
export const SUSTAIN_STATS: readonly Stat[] = ['heal', 'shield'];

/** Question 1: when is it on? Absent = always (no team condition). */
export type Condition =
  /** At least `atLeast` team members (the owner of the kit not counted when `others`) have one of these paths or elements. */
  | { count: { paths?: Path[]; elements?: Element[]; atLeast: number; others?: boolean } }
  /** Every one of these. */
  | { all: Condition[] }
  /** Cannot be checked from profiles (HP thresholds, enemy state is not a condition but setup): never counted as met. */
  | { unknown: string };

/**
 * Question 3: who gets it?
 * self · allies (all allies, the owner included) · teammates (all allies but the owner) ·
 * chosen-ally (one ally the player picks: the damage dealer) · enemy (the enemies the
 * damage dealer hits).
 */
export type Recipient = 'self' | 'allies' | 'teammates' | 'chosen-ally' | 'enemy';

/** Question 4: limits on who can use it. */
export interface Limits {
  elements?: Element[];
  paths?: Path[];
  /** Only this kind of damage ("Follow-Up ATK DMG", "Break DMG", "Ultimate DMG"…). */
  kinds?: DamageKind[];
}

/**
 * Question 5: events a kit makes on purpose. A plain Basic ATK, Skill or
 * Ultimate is never an event: every kit does those.
 * follow-up (a Follow-Up ATK) · summon-attack (a summon's or memosprite's attack) ·
 * debuff (inflicts a debuff on enemies) · dot (inflicts DoT: Burn, Shock, Bleed,
 * Wind Shear) · hp-loss (makes allies lose or consume HP) · elation-skill (an
 * Elation Skill / Punchline) · extra-turn (gives allies an extra turn or "Aha Instant").
 */
export type GameEventKind = 'follow-up' | 'summon-attack' | 'debuff' | 'dot' | 'hp-loss' | 'elation-skill' | 'extra-turn';

/** Whose events a reaction reacts to: the owner only, teammates, or any ally / any unit. */
export type From = 'self' | 'teammates' | 'any';

export interface Entry {
  /** Unique within the character, e.g. 'proof-of-debt'. */
  id: string;
  /** The kit piece this comes from (Kit skill id in kits.json). */
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
  /** Q5: this entry makes an event happen… */
  causes?: GameEventKind;
  /** …or reacts when someone (`from`) makes that event. */
  reacts?: { event: GameEventKind; from: From };
  /** Q6: what must be set up in the fight, or why nothing is needed. */
  setup: string;
  /** Q7: the same buff from two sources does not stack: entries sharing this key count once. */
  noStack?: string;
  /** Q7: unclear text; shown, never counted. Says why. */
  unverified?: string;
}

/** Part A step 5: what a damage dealer's damage is and uses. */
export interface DamageNotes {
  /** The kinds of damage they deal. */
  kinds: DamageKind[];
  /** Specific stats their damage scales with or needs (see SPECIFIC_STATS). */
  uses: Stat[];
  /** General stats that do nothing for them (e.g. crit for a DoT or Break carry). */
  ignores: Stat[];
  /** The sentences that prove it. */
  quotes: { piece: string; quote: string }[];
}

export interface CharacterSheet {
  characterId: string;
  name: string;
  /** Only for characters who can carry a team's damage. */
  damage?: DamageNotes;
  entries: Entry[];
  /** Pieces with nothing for the team: piece id → why. Every kit piece is either here or has entries. */
  nothing: Record<string, string>;
}
