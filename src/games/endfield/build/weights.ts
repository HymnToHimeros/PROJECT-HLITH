/**
 * Every weight HLITH's Endfield build logic uses, in one place so the owner can correct them (like the Kit
 * check's decisions 8–11). Each is a judgement call, listed as a numbered decision in docs/logic/endfield-builds.md.
 * Scores are in "points": roughly one point per 1% more damage for a damage dealer, or per 1% of a team buff.
 */

/** B1. Only gear sets made at this level or higher are endgame picks (lower sets are stepping stones). */
export const ENDGAME_LEVEL = 70;

/** B2. A set's timed buff ("for 15s after …") counts at this share of its size: it isn't up all the time. */
export const TIMED_UPTIME = 0.7;

/** B3. A damage dealer values a team buff at this share (it reaches them too, but so does any buff). */
export const DD_TEAM_BUFF = 1;
/** B3. A support values its own damage bonuses at this share: their damage isn't the team's main damage. */
export const SUPPORT_OWN_DAMAGE = 0.3;
/** B3. A support values team buffs at this share (the main thing a support's gear can add). */
export const SUPPORT_TEAM_BUFF = 1.5;

/** B3. A damage dealer values a buff that reaches only the *other* teammates at this share (Eternal Xiranite). */
export const DD_OTHERS_BUFF = 0.3;

/** B4. Defensive set effects (HP, DMG Reduction, Treatment) count only for these classes or kits, at this share. */
export const DEFENSIVE_WEIGHT = 0.6;

/** B4. Points for +1000 HP in a set effect (for the classes and kits B4 counts). */
export const HP_1000_POINTS = 10;

/** B5. Points for 1 Arts Intensity in a set effect, for an operator whose kit applies Arts Inflictions or reactions (reaction and status damage). */
export const ARTS_INTENSITY_POINT = 0.3;
/** B5. Points for 1% Critical Rate (1% more crits is worth less than 1% more damage). */
export const CRIT_RATE_POINT = 0.75;
/** B5. Points for 1% ATK. */
export const ATK_POINT = 1;
/** B5. Points for 1% combo cooldown cut: more combo casts, at the combo's share of the kit's value. */
export const COOLDOWN_POINT = 1;
/** B5. Points for 1% Ultimate Gain Efficiency, for kits whose damage or buffs ride on the ultimate. */
export const ULT_GAIN_POINT = 0.8;
/** B5. Points for 1 Stagger-efficiency % or a Stagger hit (Swordmancer): small, Stagger is shared. */
export const STAGGER_POINT = 0.3;

/**
 * B6. Gear stat ranking. Weights per stat (before the kit's shares), scaled by how big the stat is on a piece
 * against the biggest of that stat on any endgame piece.
 */
export const STAT_WEIGHT = {
  mainAttribute: 10,
  secondaryAttribute: 6,
  elementDmg: 8,
  skillDmg: 8,
  allSkillDmg: 7,
  attack: 6,
  artsIntensity: 5,
  criticalRate: 5,
  staggered: 2,
  ultimateGain: 5,
  treatment: 7,
  hp: 5,
  dmgReduction: 5,
} as const;
/** B6. A support's damage stats (Attack, element DMG, skill DMG, Critical Rate) count at this share. */
export const SUPPORT_DAMAGE_STATS = 0.4;
/** B6. Piece stats only break ties between sets: a set's effect decides, its pieces' stats add this share. */
export const PIECE_TIEBREAK = 0.1;
/** B6. At most this many stats are listed, best first. */
export const STAT_LIST_MAX = 6;
/** B6. A stat at or below this share of the top stat's score isn't listed (it barely matters to this kit). */
export const STAT_LIST_MIN = 0.25;

/**
 * B7. Uses per minute, estimated from the kit's costs: these are what the estimate assumes about a fight.
 * Basic attack chains a minute when nothing else is cast.
 */
export const BASIC_CHAINS_PER_MINUTE = 8;
/** B7. SP a minute the team earns for battle skills (a 100-SP battle skill about 4 times a minute). */
export const SP_PER_MINUTE = 400;
/** B7. Most combo casts a minute: a combo also needs its trigger. */
export const COMBO_MAX_PER_MINUTE = 4;
/** B7. Ultimate Energy a minute (a 100-cost ultimate about twice a minute). */
export const ULT_ENERGY_PER_MINUTE = 200;
/** B7. Seconds one basic attack chain takes (for an ultimate that powers up basic attacks for N seconds). */
export const BASIC_CHAIN_SECONDS = 3;

/** B8. Two skills whose estimated shares are within this ratio share a tier (the estimate can't separate them). */
export const SKILL_TIE_RATIO = 0.8;
/** B8. A support's skill carrying the buffs the Kit check counts for them gets this many points per counted kit line. */
export const SUPPORT_LINE_POINTS = 25;

/** B9. Weapon order inside the game's list: points for the weapon's attribute boost matching the main / secondary attribute. */
export const WEAPON_MAIN_ATTR = 3;
export const WEAPON_SECONDARY_ATTR = 1;
/** B9. Points for each match between the weapon's own skill text and the kit (element, skill type, status it applies). */
export const WEAPON_KIT_MATCH = 2;
