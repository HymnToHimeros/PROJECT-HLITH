/**
 * W-Engines (not signatures), read for the kit check (T18 step 4), by specialty then name.
 * As in the agents' sheets: an Attack, Anomaly, Rupture or Armorer W-Engine's own buffs are `to: 'self'` entries (shown,
 * not counted); a Stun, Support or Defense W-Engine's own stats are left out. Buffs to the squad, a teammate or whoever
 * switches in, and debuffs on enemies, are entries for everyone.
 */
import type { WeaponSheet } from '../types';

const WEAPON_SELF = "Raises the wearer's own stats; nothing for the team.";
const DAZE_SELF = "Raises the wearer's own Daze or Impact; nothing for the team.";

/** A W-Engine whose effect is all for the wearer. */
const own = (weaponId: string, name: string, nothing = WEAPON_SELF): WeaponSheet => ({ weaponId, name, entries: [], nothing });

export const WEAPONS_ALL: WeaponSheet[] = [
  // Attack
  {
    weaponId: '12002',
    name: '[Lunar] Decrescent',
    entries: [
      {
        id: 'w-dmg',
        piece: 'effect',
        quote: "Launching a Chain Attack or Ultimate increases the equipper's DMG by 15% for 6s.",
        tag: 'Wearer: +15% DMG after a Chain Attack or Ultimate',
        gives: [{ stat: 'dmg', amount: '+15%' }],
        to: 'self',
        reacts: ['chain-attack', 'ultimate'],
        setup: 'The wearer launches a Chain Attack or Ultimate; lasts 6s.',
      },
    ],
  },
  {
    weaponId: '12003',
    name: '[Lunar] Noviluna',
    entries: [
      {
        id: 'w-energy',
        piece: 'effect',
        quote: 'Launching an EX Special Attack generates 3 Energy for the equipper.',
        tag: 'Wearer: +3 Energy after an EX Special Attack',
        gives: [{ stat: 'energy', amount: '+3' }],
        to: 'self',
        setup: 'The wearer launches an EX Special Attack; once every 12s.',
      },
    ],
  },
  {
    weaponId: '12001',
    name: '[Lunar] Pleniluna',
    entries: [
      {
        id: 'w-dmg',
        piece: 'effect',
        quote: 'Basic Attack, Dash Attack, and Dodge Counter DMG increases by 12%.',
        tag: 'Wearer: +12% Basic, Dash and Dodge Counter DMG',
        gives: [{ stat: 'dmg', amount: '+12% (Basic Attack, Dash Attack, Dodge Counter)' }],
        to: 'self',
        setup: 'Nothing: always on while equipped.',
      },
    ],
  },
  {
    weaponId: '14001',
    name: 'Cannon Rotor',
    entries: [
      {
        id: 'w-atk',
        piece: 'effect',
        quote: 'Increases ATK by 7.5%.',
        tag: 'Wearer: +7.5% ATK',
        gives: [{ stat: 'atk', amount: '+7.5%' }],
        to: 'self',
        setup: 'Nothing: always on while equipped.',
      },
      {
        id: 'w-extra-hit',
        piece: 'effect',
        quote: 'Landing a critical hit on an enemy will inflict an additional 200% of ATK as DMG.',
        tag: 'Wearer: an extra hit of 200% ATK on a CRIT',
        gives: [{ stat: 'extra-hit', amount: '200% of ATK' }],
        to: 'self',
        setup: 'The wearer lands a critical hit; once every 8s.',
      },
    ],
  },
  {
    weaponId: '13111',
    name: 'Drill Rig - Red Axis',
    entries: [
      {
        id: 'w-electric-dmg',
        piece: 'effect',
        quote: 'When launching an EX Special Attack or Chain Attack, Electric DMG from Basic Attacks and Dash Attacks increases by 50% for 10s.',
        tag: 'Wearer: +50% Electric Basic and Dash Attack DMG',
        gives: [{ stat: 'dmg', amount: '+50% Electric DMG (Basic Attack, Dash Attack)' }],
        to: 'self',
        reacts: 'chain-attack',
        setup: 'The wearer launches an EX Special Attack or Chain Attack; lasts 10s, once every 15s.',
      },
    ],
  },
  {
    weaponId: '13013',
    name: 'Gilded Blossom',
    entries: [
      {
        id: 'w-atk-ex',
        piece: 'effect',
        quote: 'ATK increases by 6%, and DMG dealt by EX Special Attacks increases by 15%.',
        tag: 'Wearer: +6% ATK, +15% EX Special Attack DMG',
        gives: [
          { stat: 'atk', amount: '+6%' },
          { stat: 'dmg', amount: '+15% (EX Special Attack)' },
        ],
        to: 'self',
        setup: 'Nothing: always on while equipped.',
      },
    ],
  },
  {
    weaponId: '13106',
    name: 'Housekeeper',
    entries: [
      {
        id: 'w-energy',
        piece: 'effect',
        quote: "While off-field, the equipper's Energy Regen increases by 0.45/s.",
        tag: 'Wearer: Energy Regen off-field',
        gives: [{ stat: 'energy', amount: '+0.45/s' }],
        to: 'self',
        setup: 'The wearer is off-field.',
      },
      {
        id: 'w-physical-dmg',
        piece: 'effect',
        quote: "When an EX Special Attack hits an enemy, the equipper's Physical DMG increases by 3%, stacking up to 15 times and lasting 1s.",
        tag: 'Wearer: +3% Physical DMG per stack, up to 15',
        gives: [{ stat: 'dmg', amount: '+3% Physical DMG per stack, up to 15' }],
        to: 'self',
        setup: 'The wearer keeps hitting with an EX Special Attack; each stack lasts 1s.',
      },
    ],
  },
  {
    weaponId: '13015',
    name: 'Marcato Desire',
    entries: [
      {
        id: 'w-atk',
        piece: 'effect',
        quote:
          "When an EX Special Attack or Chain Attack hits an enemy, the equipper's ATK increases by 6% for 8s. While the target is under an Attribute Anomaly, this effect is increased by an additional 6%.",
        tag: 'Wearer: +6% ATK, +12% on an enemy with an Anomaly',
        gives: [{ stat: 'atk', amount: '+6%, +12% while the target has an Attribute Anomaly' }],
        to: 'self',
        reacts: 'chain-attack',
        setup: "The wearer's EX Special Attack or Chain Attack hits; lasts 8s. The extra 6% needs an Attribute Anomaly on the target.",
      },
    ],
  },
  {
    weaponId: '14155',
    name: 'Sol Exuvia',
    entries: [
      {
        id: 'w-crit-rate',
        piece: 'effect',
        quote: 'CRIT Rate increases by 20%.',
        tag: 'Wearer: +20% CRIT Rate',
        gives: [{ stat: 'crit-rate', amount: '+20%' }],
        to: 'self',
        setup: 'Nothing: always on while equipped.',
      },
      {
        id: 'w-eclipse',
        piece: 'effect',
        quote: 'When the equipper is Pyrois, using an Ultimate grants the Eclipse effect. When the Eclipse effect is active, DMG dealt by the equipper ignores 16% of Ether RES, lasting 45s.',
        tag: 'Wearer: ignores 16% Ether RES (only Pyrois)',
        gives: [{ stat: 'res-ignore', amount: '16% Ether RES' }],
        to: 'self',
        reacts: 'ultimate',
        setup: 'The wearer is Pyrois and uses an Ultimate (or enters combat); lasts 45s.',
        unverified:
          'Only when the wearer is Pyrois, which the sheet cannot express; the text also does not say whether "When the equipper enters combat, they gain the Eclipse effect" works for anyone else.',
      },
    ],
  },
  {
    weaponId: '13004',
    name: 'Starlight Engine',
    entries: [
      {
        id: 'w-atk',
        piece: 'effect',
        quote: "Launching a Dodge Counter or Quick Assist increases the equipper's ATK by 12% for 12s.",
        tag: 'Wearer: +12% ATK after a Dodge Counter or Quick Assist',
        gives: [{ stat: 'atk', amount: '+12%' }],
        to: 'self',
        reacts: 'quick-assist',
        setup: 'The wearer launches a Dodge Counter or Quick Assist; lasts 12s.',
      },
    ],
  },
  {
    weaponId: '13108',
    name: 'Starlight Engine Replica',
    entries: [
      {
        id: 'w-physical-dmg',
        piece: 'effect',
        quote: "Increases the equipper's Physical DMG against the target by 36% for 8s upon hitting an enemy at least 6 meters away with a Basic Attack or Dash Attack.",
        tag: 'Wearer: +36% Physical DMG from range',
        gives: [{ stat: 'dmg', amount: '+36% Physical DMG' }],
        to: 'self',
        setup: 'The wearer hits an enemy at least 6 meters away with a Basic Attack or Dash Attack; lasts 8s.',
      },
    ],
  },
  {
    weaponId: '13001',
    name: 'Street Superstar',
    entries: [
      {
        id: 'w-ultimate-dmg',
        piece: 'effect',
        quote: "Upon activating their own Ultimate, the equipper consumes all Charge stacks, and each stack increases the skill's DMG by 15%.",
        tag: 'Wearer: +15% Ultimate DMG per Charge stack, up to 3',
        gives: [{ stat: 'dmg', amount: '+15% (Ultimate) per stack, up to 3' }],
        to: 'self',
        reacts: 'ultimate',
        setup: "Any squad member's Chain Attack gives a Charge stack (up to 3); the wearer's Ultimate spends them.",
      },
    ],
  },

  // Stun
  own('12008', '[Vortex] Arrow', DAZE_SELF),
  own('12009', '[Vortex] Hatchet', DAZE_SELF),
  own('12007', '[Vortex] Revolver', DAZE_SELF),
  own('13135', 'Box Cutter', "Raises the wearer's own Physical DMG and Daze; nothing for the team."),
  own('13101', 'Demara Battery Mark II', "Raises the wearer's own Electric DMG and Energy; nothing for the team."),
  own('13006', 'Precious Fossilized Core', DAZE_SELF),
  own('14003', 'Six Shooter', DAZE_SELF),
  own('13005', 'Steam Oven', DAZE_SELF),
  own('13020', 'The Simmering Pot', "Raises the wearer's own Daze and DMG; nothing for the team."),

  // Anomaly
  {
    weaponId: '12010',
    name: '[Magnetic Storm] Alpha',
    entries: [
      {
        id: 'w-mastery',
        piece: 'effect',
        quote: "Accumulating Anomaly Buildup increases the equipper's Anomaly Mastery by 25 for 10s.",
        tag: 'Wearer: +25 Anomaly Mastery',
        gives: [{ stat: 'anomaly-buildup', amount: '+25 Anomaly Mastery' }],
        to: 'self',
        setup: 'The wearer builds up an Anomaly; lasts 10s, once every 20s.',
      },
    ],
  },
  {
    weaponId: '12011',
    name: '[Magnetic Storm] Bravo',
    entries: [
      {
        id: 'w-proficiency',
        piece: 'effect',
        quote: "Accumulating Anomaly Buildup increases the equipper's Anomaly Proficiency by 25 for 10s.",
        tag: 'Wearer: +25 Anomaly Proficiency',
        gives: [{ stat: 'anomaly-proficiency', amount: '+25' }],
        to: 'self',
        setup: 'The wearer builds up an Anomaly; lasts 10s, once every 20s.',
      },
    ],
  },
  {
    weaponId: '12012',
    name: '[Magnetic Storm] Charlie',
    entries: [
      {
        id: 'w-energy',
        piece: 'effect',
        quote: 'Whenever a squad member inflicts an Attribute Anomaly on an enemy, the equipper generates 3.5 Energy.',
        tag: 'Wearer: +3.5 Energy when the squad applies an Anomaly',
        gives: [{ stat: 'energy', amount: '+3.5' }],
        to: 'self',
        setup: 'Any squad member inflicts an Attribute Anomaly; once every 12s.',
      },
    ],
  },
  {
    weaponId: '13018',
    name: 'Boisterous Echoes',
    entries: [
      {
        id: 'w-energy',
        piece: 'effect',
        quote: 'When the equipper triggers the Vortex effect, they gain 2 Energy.',
        tag: 'Wearer: +2 Energy on Vortex',
        gives: [{ stat: 'energy', amount: '+2' }],
        to: 'self',
        setup: 'The wearer triggers Vortex; once every 10s.',
      },
      {
        id: 'w-dmg',
        piece: 'effect',
        quote: 'When attacking enemies afflicted with an Attribute Anomaly, the equipper deals 11.5% increased DMG.',
        tag: 'Wearer: +11.5% DMG on an enemy with an Anomaly',
        gives: [{ stat: 'dmg', amount: '+11.5%' }],
        to: 'self',
        setup: 'The enemy has an Attribute Anomaly.',
      },
    ],
  },
  {
    weaponId: '13009',
    name: 'Electro-Lip Gloss',
    entries: [
      {
        id: 'w-atk-dmg',
        piece: 'effect',
        quote: "When there are enemies inflicted with Attribute Anomaly on the field, the equipper's ATK increases by 10% and they deal an additional 15% more DMG to the target.",
        tag: 'Wearer: +10% ATK, +15% DMG while an enemy has an Anomaly',
        gives: [
          { stat: 'atk', amount: '+10%' },
          { stat: 'dmg', amount: '+15%' },
        ],
        to: 'self',
        setup: 'An enemy on the field has an Attribute Anomaly.',
      },
    ],
  },
  {
    weaponId: '13003',
    name: 'Rainforest Gourmet',
    entries: [
      {
        id: 'w-atk',
        piece: 'effect',
        quote: 'For every 10 Energy consumed, the equipper gains a buff that increases ATK by 2.5% for 10s, stacking up to 10 times.',
        tag: 'Wearer: +2.5% ATK per 10 Energy spent, up to 10',
        gives: [{ stat: 'atk', amount: '+2.5% per stack, up to 10' }],
        to: 'self',
        setup: 'The wearer spends Energy; each stack lasts 10s.',
      },
    ],
  },
  {
    weaponId: '13128',
    name: 'Roaring Ride',
    entries: [
      {
        id: 'w-random',
        piece: 'effect',
        quote: "Increases the equipper's ATK by 8%, increases the equipper's Anomaly Proficiency by 40, or increases the equipper's Anomaly Buildup Rate by 25%.",
        tag: 'Wearer: +8% ATK, +40 Anomaly Proficiency or +25% Buildup (random)',
        gives: [
          { stat: 'atk', amount: '+8%' },
          { stat: 'anomaly-proficiency', amount: '+40' },
          { stat: 'anomaly-buildup', amount: '+25%' },
        ],
        to: 'self',
        setup: 'The wearer hits with an EX Special Attack: one of the three at random, 5s each; repeated hits can have several on at once.',
      },
    ],
  },
  {
    weaponId: '13008',
    name: 'Weeping Gemini',
    entries: [
      {
        id: 'w-proficiency',
        piece: 'effect',
        quote: 'Whenever a squad member inflicts an Attribute Anomaly on an enemy, the equipper gains a buff that increases Anomaly Proficiency by 30, stacking up to 4 times.',
        tag: 'Wearer: +30 Anomaly Proficiency per stack, up to 4',
        gives: [{ stat: 'anomaly-proficiency', amount: '+30 per stack, up to 4' }],
        to: 'self',
        setup: 'Any squad member inflicts an Attribute Anomaly; the stacks end when the target recovers from Stun or is defeated.',
      },
    ],
  },

  // Support
  {
    weaponId: '12004',
    name: '[Reverb] Mark I',
    entries: [
      {
        id: 'w-squad-impact',
        piece: 'effect',
        quote: "Launching an EX Special Attack increases all squad members' Impact by 8% for 10s.",
        tag: 'Squad: +8% Impact',
        gives: [{ stat: 'daze', amount: '+8% Impact' }],
        to: 'squad',
        setup: 'The wearer launches an EX Special Attack; lasts 10s, once every 20s.',
        noStack: 'weapon-12004-impact',
      },
    ],
  },
  {
    weaponId: '12005',
    name: '[Reverb] Mark II',
    entries: [
      {
        id: 'w-squad-anomaly',
        piece: 'effect',
        quote: "Launching an EX Special Attack or Chain Attack increases all squad members' Anomaly Mastery and Anomaly Proficiency by 10 for 10s.",
        tag: 'Squad: +10 Anomaly Mastery, +10 Anomaly Proficiency',
        gives: [
          { stat: 'anomaly-buildup', amount: '+10 Anomaly Mastery' },
          { stat: 'anomaly-proficiency', amount: '+10' },
        ],
        to: 'squad',
        reacts: 'chain-attack',
        setup: 'The wearer launches an EX Special Attack or Chain Attack; lasts 10s, once every 20s.',
        noStack: 'weapon-12005-anomaly',
      },
    ],
  },
  {
    weaponId: '12006',
    name: '[Reverb] Mark III',
    entries: [
      {
        id: 'w-squad-atk',
        piece: 'effect',
        quote: "Launching a Chain Attack or Ultimate increases all squad members' ATK by 8% for 10s.",
        tag: 'Squad: +8% ATK',
        gives: [{ stat: 'atk', amount: '+8%' }],
        to: 'squad',
        reacts: ['chain-attack', 'ultimate'],
        setup: 'The wearer launches a Chain Attack or Ultimate; lasts 10s, once every 20s.',
        noStack: 'weapon-12006-atk',
      },
    ],
  },
  {
    weaponId: '13113',
    name: 'Bashful Demon',
    entries: [
      {
        id: 'w-squad-atk',
        piece: 'effect',
        quote: "When launching an EX Special Attack, all squad members' ATK increases by 2% for 12s, stacking up to 4 times.",
        tag: 'Squad: +2% ATK per stack, up to 4',
        gives: [{ stat: 'atk', amount: '+2% per stack, up to 4' }],
        to: 'squad',
        setup: 'The wearer launches EX Special Attacks (1 stack each); lasts 12s, repeated triggers reset it.',
        noStack: 'weapon-13113-atk',
      },
    ],
  },
  {
    weaponId: '13115',
    name: 'Kaboom the Cannon',
    entries: [
      {
        id: 'w-squad-atk',
        piece: 'effect',
        quote: "When any friendly unit in the squad attacks and hits an enemy, all friendly units' ATK increases by 2.5% for 8s, stacking up to 4 times.",
        tag: 'Squad: +2.5% ATK per stack, up to 4',
        gives: [{ stat: 'atk', amount: '+2.5% per stack, up to 4' }],
        to: 'squad',
        setup: 'Squad members hit enemies; each friendly unit gives 1 stack, each lasts 8s.',
        noStack: 'weapon-13115-atk',
      },
    ],
  },
  {
    weaponId: '13002',
    name: 'Slice of Time',
    entries: [
      {
        id: 'w-squad-decibels',
        piece: 'effect',
        quote: "Any squad members' Dodge Counter, EX Special Attack, Assist Attack, or Chain Attack respectively generates 20/25/30/35 more Decibels",
        tag: 'Squad: more Decibels',
        gives: [{ stat: 'decibels', amount: '+20/25/30/35 (Dodge Counter, EX Special Attack, Assist Attack, Chain Attack)' }],
        to: 'squad',
        setup: 'Any squad member uses a Dodge Counter, EX Special Attack, Assist Attack or Chain Attack; each type once every 12s.',
        noStack: 'weapon-13002-decibels',
      },
    ],
  },
  {
    weaponId: '13103',
    name: 'The Vault',
    entries: [
      {
        id: 'w-dmg-taken',
        piece: 'effect',
        quote: "Dealing Ether DMG using an EX Special Attack, Chain Attack, or Ultimate increases all units' DMG against the target by 15%",
        tag: 'Enemy: takes 15% more DMG',
        gives: [{ stat: 'dmg-taken', amount: '+15%' }],
        to: 'enemy',
        reacts: ['chain-attack', 'ultimate'],
        setup: 'The wearer deals Ether DMG with an EX Special Attack, Chain Attack or Ultimate; lasts 2s.',
        noStack: 'weapon-13103-dmg-taken',
      },
    ],
  },
  {
    weaponId: '14002',
    name: 'Unfettered Game Ball',
    entries: [
      {
        id: 'w-crit-rate',
        piece: 'effect',
        quote: "Whenever the equipper's attack triggers an Attribute Counter effect, all units' CRIT Rate against the struck enemy increases by 12% for 12s.",
        tag: 'Enemy: +12% CRIT Rate against it',
        gives: [{ stat: 'crit-rate', amount: '+12%' }],
        to: 'enemy',
        setup: "The wearer's attack triggers an Attribute Counter effect; lasts 12s.",
        noStack: 'weapon-14002-crit-rate',
      },
    ],
  },

  // Defense
  own('12013', '[Identity] Base', "Raises the wearer's own DEF; nothing for the team."),
  {
    weaponId: '12014',
    name: '[Identity] Inflection',
    entries: [
      {
        id: 'w-enemy-weaker',
        piece: 'effect',
        quote: "When attacked, reduces the attacker's DMG by 6% for 12s.",
        tag: 'Enemy: deals 6% less DMG',
        gives: [{ stat: 'heal', amount: 'the attacker deals 6% less DMG' }],
        to: 'enemy',
        setup: 'An enemy attacks the wearer; lasts 12s.',
      },
    ],
  },
  own('13112', 'Big Cylinder', "Lowers the wearer's own DMG taken and gives the wearer an extra hit; nothing for the team."),
  own('13010', 'Bunny Band'),
  own('13007', 'Original Transmorpher'),
  own('13127', 'Peacekeeper - Specialized', "Raises the wearer's own Energy and Anomaly Buildup; nothing for the team."),
  {
    weaponId: '13016',
    name: 'Reel Projector',
    entries: [
      {
        id: 'w-squad-less-dmg',
        piece: 'effect',
        quote: "When a squad member's HP is greater than or equal to 50%, they take 7.5% less DMG, and 10% less Miasma Contamination.",
        tag: 'Squad: 7.5% less DMG taken',
        gives: [{ stat: 'heal', amount: '7.5% less DMG taken, 10% less Miasma Contamination' }],
        to: 'squad',
        setup: 'The squad member has 50% HP or more.',
        noStack: 'weapon-13016-less-dmg',
      },
    ],
  },
  {
    weaponId: '13011',
    name: 'Spring Embrace',
    entries: [
      {
        id: 'w-switch-in-energy',
        piece: 'effect',
        quote:
          "When attacked, the equipper's Energy Generation Rate increases by 10% for 12s. When the equipper switches off-field, this buff will be transferred to the new on-field character with its duration refreshed.",
        tag: 'Whoever switches in: +10% Energy Generation Rate',
        gives: [{ stat: 'energy', amount: '+10% Energy Generation Rate' }],
        to: 'switch-in',
        setup: 'An enemy hits the wearer, then the wearer switches off-field within 12s; the buff moves to whoever comes in, refreshed.',
        noStack: 'weapon-13011-energy',
      },
    ],
  },
  own('13142', 'Tremor Trigram Vessel', "Raises the wearer's own EX Special Attack and Ultimate DMG and Energy; nothing for the team."),

  // Rupture
  {
    weaponId: '12015',
    name: '[Cinder] Cobalt',
    entries: [
      {
        id: 'w-atk',
        piece: 'effect',
        quote: "Upon becoming the active character in combat, the equipper's ATK increases by 7.2% for 10s.",
        tag: 'Wearer: +7.2% ATK on switching in',
        gives: [{ stat: 'atk', amount: '+7.2%' }],
        to: 'self',
        setup: 'The wearer becomes the active character; lasts 10s, once every 20s.',
      },
    ],
  },
  {
    weaponId: '13019',
    name: 'Cauldron of Clarity',
    entries: [
      {
        id: 'w-dmg',
        piece: 'effect',
        quote: "Each stack increases the equipper's DMG by 4%, up to 3 stacks, and lasting 20s.",
        tag: 'Wearer: +4% DMG per stack, up to 3',
        gives: [{ stat: 'dmg', amount: '+4% per stack, up to 3' }],
        to: 'self',
        setup: 'The wearer activates EX Special Attacks (1 stack each); lasts 20s.',
      },
      {
        id: 'w-crit-rate',
        piece: 'effect',
        quote: "At 3 stacks, the equipper's CRIT Rate increases by 6.5%.",
        tag: 'Wearer: +6.5% CRIT Rate at 3 stacks',
        gives: [{ stat: 'crit-rate', amount: '+6.5%' }],
        to: 'self',
        setup: '3 stacks of the DMG buff.',
      },
    ],
  },
  {
    weaponId: '13144',
    name: "Grill O'Wisp",
    entries: [
      {
        id: 'w-fire-dmg',
        piece: 'effect',
        quote: "The equipper's Fire DMG increases by 15%.",
        tag: 'Wearer: +15% Fire DMG',
        gives: [{ stat: 'dmg', amount: '+15% Fire DMG' }],
        to: 'self',
        setup: 'Nothing: always on while equipped.',
      },
      {
        id: 'w-crit-rate',
        piece: 'effect',
        quote: "When the equipper's HP decreases, their CRIT Rate increases by 15% for 5s.",
        tag: 'Wearer: +15% CRIT Rate when losing HP',
        gives: [{ stat: 'crit-rate', amount: '+15%' }],
        to: 'self',
        setup: "The wearer's HP goes down; lasts 5s.",
      },
    ],
  },
  {
    weaponId: '13012',
    name: 'Puzzle Sphere',
    entries: [
      {
        id: 'w-crit-dmg',
        piece: 'effect',
        quote: "Upon launching an EX Special Attack, the equipper's CRIT DMG increases by 16% for 12s.",
        tag: 'Wearer: +16% CRIT DMG after an EX Special Attack',
        gives: [{ stat: 'crit-dmg', amount: '+16%' }],
        to: 'self',
        setup: 'The wearer launches an EX Special Attack; lasts 12s.',
      },
      {
        id: 'w-ex-dmg',
        piece: 'effect',
        quote: "if the target's current HP is below 50% of their Max HP, EX Special Attack DMG increases by 20%.",
        tag: 'Wearer: +20% EX Special Attack DMG on a weakened enemy',
        gives: [{ stat: 'dmg', amount: '+20% (EX Special Attack)' }],
        to: 'self',
        setup: 'The target is below 50% HP.',
      },
    ],
  },
  {
    weaponId: '13014',
    name: 'Radiowave Journey',
    entries: [
      {
        id: 'w-sheer-force',
        piece: 'effect',
        quote: "Each stack increases the equipper's Sheer Force by 80, stacking up to 3 times, and lasting 12s.",
        tag: 'Wearer: +80 Sheer Force per stack, up to 3',
        gives: [{ stat: 'sheer-force', amount: '+80 per stack, up to 3' }],
        to: 'self',
        reacts: ['chain-attack', 'ultimate'],
        setup: 'The wearer launches a Chain Attack or Ultimate (1 stack each); each stack lasts 12s.',
      },
    ],
  },

  // Armorer
  {
    weaponId: '12016',
    name: '[Lunar] Semiluna',
    entries: [
      {
        id: 'w-basic-dmg',
        piece: 'effect',
        quote: 'When using an EX Special Attack, Basic Attack DMG increases by 18% for 10s.',
        tag: 'Wearer: +18% Basic Attack DMG after an EX Special Attack',
        gives: [{ stat: 'dmg', amount: '+18% (Basic Attack)' }],
        to: 'self',
        setup: 'The wearer uses an EX Special Attack; lasts 10s.',
      },
    ],
  },
  {
    weaponId: '13021',
    name: 'Bloodmarrow Coffer',
    entries: [
      {
        id: 'w-dmg',
        piece: 'effect',
        quote: "When the equipper's CRIT Rate exceeds 100%, each 1% of CRIT Rate above 100% increases DMG dealt by 0.48%, up to a maximum increase of 24%.",
        tag: 'Wearer: up to +24% DMG from CRIT Rate over 100%',
        gives: [{ stat: 'dmg', amount: '+0.48% per 1% CRIT Rate over 100%, up to +24%' }],
        to: 'self',
        scales: { stat: 'crit-rate', quote: 'each 1% of CRIT Rate above 100% increases DMG dealt by 0.48%' },
        setup: "The wearer's CRIT Rate is above 100%.",
      },
    ],
  },
  {
    weaponId: '13022',
    name: 'Candlelit Scheme',
    entries: [
      {
        id: 'w-crit-rate',
        piece: 'effect',
        quote: "When using an EX Special Attack, the equipper's CRIT Rate is increased by 8% for 40s.",
        tag: 'Wearer: +8% CRIT Rate after an EX Special Attack',
        gives: [{ stat: 'crit-rate', amount: '+8%' }],
        to: 'self',
        setup: 'The wearer launches an EX Special Attack; lasts 40s.',
      },
      {
        id: 'w-dmg',
        piece: 'effect',
        quote: 'The equipper deals 15% more DMG to enemies whose current HP is below 50% of their Max HP.',
        tag: 'Wearer: +15% DMG on a weakened enemy',
        gives: [{ stat: 'dmg', amount: '+15%' }],
        to: 'self',
        setup: 'The enemy is below 50% HP.',
      },
    ],
  },
  own('13017', 'Catty Luck', "Raises the wearer's own DEF, which the check has no stat for; nothing for the team."),
];
