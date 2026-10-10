import type { BuildStat } from '../../../core/rules/buildFit';
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
  /**
   * At least `atLeast` team members (the owner of the kit not counted when `others`) have one of these paths or
   * elements, and when `atMost` is set, no more than that ("the only Elation character": atLeast 0, atMost 0).
   */
  | { count: { paths?: Path[]; elements?: Element[]; atLeast: number; atMost?: number; others?: boolean } }
  /** Every one of these. */
  | { all: Condition[] }
  /**
   * Another member's kit does this for the team (T30 rule 1: a role counts only when a kit asks for it): an entry
   * that gives one of `gives` (to anyone but themself), and when `to` is set, one aimed at one of those recipients
   * ("a teammate who heals or shields Phainon", "a teammate whose abilities target Phainon"). Eidolons don't count.
   */
  | { teammate: { gives?: Stat[]; to?: Recipient[]; words: string } }
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
export type GameEventKind = 'follow-up' | 'summon-attack' | 'debuff' | 'dot' | 'hp-loss' | 'elation-skill' | 'extra-turn' | 'targets-ally';
// 'targets-ally' (T30): an ability aimed at one chosen ally. Never written on entries: every non-Eidolon entry given
// to a chosen ally makes it (Sunday's, Cerydra's, Dan Heng • Permansor Terrae's Skill on the damage dealer).

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
  gives: {
    stat: Stat;
    amount: string;
    /**
     * One of two branches the kit picks by the damage dealer (T30): 'atk-carry' applies when their damage scales on ATK,
     * 'other-carry' when it doesn't (Robin • Summeretto: ATK from her Max HP "if their ATK is higher", else CRIT DMG).
     */
    when?: 'atk-carry' | 'other-carry';
  }[];
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
  /**
   * The amount grows with the giver's own stat ("equal to 16% of Robin • Summeretto's Max HP"): a team where this
   * counts wants that build on them (T18, decisions 25–26). `quote` is word for word from the piece; `gives` limits it
   * to those stats of the entry (absent = all).
   */
  scales?: { stat: BuildStat; quote: string; gives?: Stat[] };
  /** Q7: unclear text; shown, never counted. Says why. */
  unverified?: string;
  /**
   * When this entry of the damage dealer's is on, their own damage also counts as these kinds (T30): Aventurine •
   * Waveflair's "Elation Skill … is considered as launching a Follow-Up ATK" when he is the only Elation character,
   * so Follow-Up ATK buffs reach him in that team.
   */
  addsKinds?: DamageKind[];
  /**
   * Attached to the damage dealer, not to the giver's own turns, so it goes with them where teammates can't act (T30):
   * Dan Heng • Permansor Terrae's Bondmate and Souldragon go with Phainon into his domain (owner, 2026-10-10). Says why.
   */
  staysWithCarry?: string;
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
  /**
   * Their main damage happens with the teammates gone (T30, owner: Phainon's domain, "other teammates depart and cannot
   * take action"): buffs from before count, but teammates' own hits, extra hits and set-off reactions don't.
   */
  alone?: { piece: string; quote: string };
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

/**
 * An equipped weapon's effect, read like a kit piece (T18 step 4): every entry's `piece` is 'effect' and quotes
 * the weapon's effect text (weapons.json) word for word. It counts for whoever has it in their saved build, when
 * their path matches the weapon's. Signature weapons are read in their character's sheet instead.
 */
export interface WeaponSheet {
  weaponId: string;
  name: string;
  entries: Entry[];
  /** Why it gives the team nothing (only the wearer's own stats…); required when there are no entries. */
  nothing?: string;
}
